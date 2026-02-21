const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const PORT = Number(process.env.PORT || 8080);
const PLAYER_COLORS = ['red', 'green', 'yellow', 'blue'];
const TOKENS_PER_PLAYER = 4;
const TRACK_LENGTH = 52;
const HOME_LENGTH = 6;
const FINISH_PROGRESS = TRACK_LENGTH + HOME_LENGTH;
const START_OFFSETS = { red: 0, green: 13, yellow: 26, blue: 39 };
const SAFE_ZONES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const rooms = new Map();
const presence = new Map();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling']
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/room=:roomId', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.post('/api/bot/play', (req, res) => {
  try {
    const token = String(req.headers['x-internal-token'] || '');
    const internalToken = String(process.env.INTERNAL_API_TOKEN || '');
    if (!internalToken || token !== internalToken) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const user = normalizeUser(req.body || {});
    if (!user.userId || !user.name) {
      return res.status(400).json({ ok: false, error: 'userId and name required' });
    }

    const room = createRoomForUser(user);
    return res.status(201).json({ ok: true, room: viewRoom(room) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

io.on('connection', (socket) => {
  socket.on('room:create', (payload, cb) => {
    try {
      const user = normalizeUser(payload);
      if (!user.userId || !user.name) throw new Error('name required');

      const room = createRoomForUser(user);
      leaveCurrentRoomIfNeeded(socket);
      socket.join(room.roomId);
      socket.data.userId = user.userId;
      socket.data.roomId = room.roomId;
      markConnected(room, user.userId, socket.id);
      cb?.({ ok: true, room: viewRoom(room) });
      io.to(room.roomId).emit('room:state', viewRoom(room));
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on('room:join', (payload, cb) => {
    try {
      const user = normalizeUser(payload);
      const roomId = String(payload.roomId || '').toUpperCase();
      const room = rooms.get(roomId);
      if (!room) throw new Error('room not found');

      const existing = room.players.find((p) => p.userId === user.userId);
      if (!existing && room.status !== 'waiting') throw new Error('Game already started');
      if (!existing && room.players.length >= room.maxPlayers) throw new Error('room full');

      if (existing) {
        existing.name = user.name;
      } else {
        const color = PLAYER_COLORS.find((c) => !room.players.some((p) => p.color === c));
        room.players.push(createPlayer(user, color));
        room.moveVersion += 1;
      }

      leaveCurrentRoomIfNeeded(socket);
      socket.join(roomId);
      socket.data.userId = user.userId;
      socket.data.roomId = roomId;
      markConnected(room, user.userId, socket.id);

      io.to(roomId).emit('room:state', viewRoom(room));
      cb?.({ ok: true, room: viewRoom(room) });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on('game:start', (payload, cb) => {
    try {
      const room = getRoom(payload.roomId);
      const userId = socket.data.userId;
      if (!room || !userId) throw new Error('invalid room');
      if (room.hostUserId !== userId) throw new Error('only host can start');
      if (room.players.length < 2) throw new Error('need at least 2 players');
      if (room.status !== 'waiting') throw new Error('already started');

      room.status = 'active';
      room.turnOrder = room.players.map((p) => p.userId);
      room.currentTurnIndex = 0;
      room.turnPhase = 'roll';
      room.lastDiceValue = null;
      room.moveVersion += 1;
      io.to(room.roomId).emit('room:state', viewRoom(room));
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on('dice:roll', (payload, cb) => {
    try {
      const room = getRoom(payload.roomId);
      const userId = socket.data.userId;
      if (!room || !userId) throw new Error('invalid room');
      if (room.status !== 'active') throw new Error('game not active');
      if (room.turnPhase !== 'roll') throw new Error('already rolled');
      if (currentTurnUserId(room) !== userId) throw new Error('not your turn');

      const player = room.players.find((p) => p.userId === userId);
      const diceValue = crypto.randomInt(1, 7);
      const movable = listMovableTokens(player, diceValue);

      room.lastDiceValue = diceValue;
      room.turnPhase = 'move';
      room.moveVersion += 1;

      if (movable.length === 0) endTurn(room, false);

      io.to(room.roomId).emit('room:state', viewRoom(room));
      io.to(room.roomId).emit('game:dice', { byUserId: userId, diceValue, movableTokenIds: movable });
      cb?.({ ok: true, diceValue, movableTokenIds: movable });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on('token:move', (payload, cb) => {
    try {
      const room = getRoom(payload.roomId);
      const userId = socket.data.userId;
      if (!room || !userId) throw new Error('invalid room');
      if (room.status !== 'active') throw new Error('game not active');
      if (room.turnPhase !== 'move') throw new Error('roll first');
      if (currentTurnUserId(room) !== userId) throw new Error('not your turn');

      const player = room.players.find((p) => p.userId === userId);
      const diceValue = room.lastDiceValue;
      const tokenId = String(payload.tokenId || '');
      const movable = listMovableTokens(player, diceValue);
      if (!movable.includes(tokenId)) throw new Error('invalid token move');

      const token = player.tokens.find((t) => t.tokenId === tokenId);
      if (token.progress === -1) token.progress = 0;
      else token.progress += diceValue;

      const kills = applyKills(room, player, token);
      const allFinished = player.tokens.every((t) => t.progress === FINISH_PROGRESS);
      if (allFinished) {
        room.status = 'finished';
        room.winnerUserId = userId;
        room.turnPhase = 'ended';
      } else {
        endTurn(room, diceValue === 6);
      }

      room.moveVersion += 1;
      io.to(room.roomId).emit('room:state', viewRoom(room));
      io.to(room.roomId).emit('game:move', { byUserId: userId, tokenId, progress: token.progress, kills });
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on('disconnect', () => {
    const { roomId, userId } = socket.data;
    if (!roomId || !userId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    markDisconnectedIfNoSockets(room, userId, socket.id);
    io.to(roomId).emit('room:state', viewRoom(room));
  });
});

function normalizeUser(payload) {
  return {
    userId: String(payload.userId || '').trim(),
    name: String(payload.name || '').trim().slice(0, 24)
  };
}

function createRoomForUser(user) {
  const roomId = nanoid(6).toUpperCase();
  const room = {
    roomId,
    status: 'waiting',
    hostUserId: user.userId,
    maxPlayers: 4,
    currentTurnIndex: 0,
    turnPhase: 'roll',
    lastDiceValue: null,
    winnerUserId: null,
    turnOrder: [],
    players: [createPlayer(user, 'red')],
    moveVersion: 1
  };
  rooms.set(roomId, room);
  return room;
}

function presenceKey(roomId, userId) {
  return `${roomId}:${userId}`;
}

function markConnected(room, userId, socketId) {
  const key = presenceKey(room.roomId, userId);
  const set = presence.get(key) || new Set();
  set.add(socketId);
  presence.set(key, set);

  const player = room.players.find((p) => p.userId === userId);
  if (player) player.connected = true;
}

function markDisconnectedIfNoSockets(room, userId, socketId) {
  const key = presenceKey(room.roomId, userId);
  const set = presence.get(key) || new Set();
  set.delete(socketId);

  if (set.size === 0) {
    presence.delete(key);
    const player = room.players.find((p) => p.userId === userId);
    if (player) player.connected = false;
    return;
  }

  presence.set(key, set);
}

function leaveCurrentRoomIfNeeded(socket) {
  const prevRoomId = socket.data.roomId;
  const prevUserId = socket.data.userId;
  if (!prevRoomId || !prevUserId) return;

  const prevRoom = rooms.get(prevRoomId);
  if (!prevRoom) return;

  socket.leave(prevRoomId);
  markDisconnectedIfNoSockets(prevRoom, prevUserId, socket.id);
  io.to(prevRoomId).emit('room:state', viewRoom(prevRoom));
}

function createPlayer(user, color) {
  return {
    userId: user.userId,
    name: user.name,
    color,
    connected: true,
    tokens: Array.from({ length: TOKENS_PER_PLAYER }, (_, i) => ({ tokenId: `${color}-${i}`, progress: -1 }))
  };
}

function viewRoom(room) {
  return {
    roomId: room.roomId,
    status: room.status,
    hostUserId: room.hostUserId,
    maxPlayers: room.maxPlayers,
    currentTurnIndex: room.currentTurnIndex,
    currentTurnUserId: currentTurnUserId(room),
    turnPhase: room.turnPhase,
    lastDiceValue: room.lastDiceValue,
    winnerUserId: room.winnerUserId,
    turnOrder: room.turnOrder,
    players: room.players,
    moveVersion: room.moveVersion
  };
}

function getRoom(roomId) {
  return rooms.get(String(roomId || '').toUpperCase());
}

function currentTurnUserId(room) {
  return room.turnOrder[room.currentTurnIndex] || null;
}

function listMovableTokens(player, diceValue) {
  const out = [];
  for (const token of player.tokens) {
    if (token.progress === -1 && diceValue === 6) out.push(token.tokenId);
    if (token.progress >= 0 && token.progress + diceValue <= FINISH_PROGRESS) out.push(token.tokenId);
  }
  return out;
}

function globalPos(color, progress) {
  if (progress < 0 || progress >= TRACK_LENGTH) return null;
  return (START_OFFSETS[color] + progress) % TRACK_LENGTH;
}

function applyKills(room, activePlayer, movedToken) {
  if (movedToken.progress < 0 || movedToken.progress >= TRACK_LENGTH) return [];
  const movedGlobal = globalPos(activePlayer.color, movedToken.progress);
  if (SAFE_ZONES.has(movedGlobal)) return [];

  const kills = [];
  for (const opponent of room.players) {
    if (opponent.userId === activePlayer.userId) continue;
    for (const token of opponent.tokens) {
      const gp = globalPos(opponent.color, token.progress);
      if (gp !== null && gp === movedGlobal) {
        token.progress = -1;
        kills.push({ userId: opponent.userId, tokenId: token.tokenId });
      }
    }
  }
  return kills;
}

function endTurn(room, extraTurn) {
  room.lastDiceValue = null;
  room.turnPhase = 'roll';
  if (!extraTurn) room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
}

server.listen(PORT, () => {
  console.log(`Ludo WebApp running on http://localhost:${PORT}`);
});
