const { startGame, rollDice, moveToken, getPlayerByUserId } = require('../game/engine');
const { joinRoom, getRoom, saveRoom, logEvent, markDisconnected } = require('../services/roomStore');

const activeSockets = new Map();

function registerSocketHandlers(io, socket) {
  const user = socket.data.user;

  socket.on('room:join', async ({ roomId }, cb) => {
    try {
      const state = await joinRoom({ roomId, user });
      socket.join(roomId);
      activeSockets.set(socket.id, { roomId, userId: user.telegramId });
      io.to(roomId).emit('room:state', sanitizeState(state));
      cb?.({ ok: true, room: sanitizeState(state) });
    } catch (error) {
      cb?.({ ok: false, error: error.message });
    }
  });

  socket.on('game:start', async ({ roomId }, cb) => {
    try {
      const state = await getRoom(roomId);
      if (!state) throw new Error('Room not found');
      if (state.hostUserId !== user.telegramId) throw new Error('Only host can start');
      if (state.status !== 'waiting') throw new Error('Already started');
      if (state.players.length < 2) throw new Error('Need 2+ players');

      startGame(state);
      await saveRoom(state);
      await logEvent(roomId, 'game_started', user.telegramId, {}, state.moveVersion);
      io.to(roomId).emit('room:state', sanitizeState(state));
      cb?.({ ok: true, room: sanitizeState(state) });
    } catch (error) {
      cb?.({ ok: false, error: error.message });
    }
  });

  socket.on('dice:roll', async ({ roomId }, cb) => {
    try {
      const state = await getRoom(roomId);
      if (!state) throw new Error('Room not found');

      const result = rollDice(state, user.telegramId);
      await saveRoom(state);
      await logEvent(roomId, 'dice_rolled', user.telegramId, result, state.moveVersion);
      io.to(roomId).emit('room:state', sanitizeState(state));
      io.to(roomId).emit('game:dice', { byUserId: user.telegramId, ...result });
      cb?.({ ok: true, ...result });
    } catch (error) {
      cb?.({ ok: false, error: error.message });
    }
  });

  socket.on('token:move', async ({ roomId, tokenId }, cb) => {
    try {
      const state = await getRoom(roomId);
      if (!state) throw new Error('Room not found');
      const player = getPlayerByUserId(state, user.telegramId);
      if (!player) throw new Error('Not in room');

      const result = moveToken(state, user.telegramId, tokenId);
      await saveRoom(state);
      await logEvent(roomId, 'token_moved', user.telegramId, { tokenId, ...result }, state.moveVersion);
      io.to(roomId).emit('room:state', sanitizeState(state));
      io.to(roomId).emit('game:move', { byUserId: user.telegramId, tokenId, ...result });
      cb?.({ ok: true, ...result });
    } catch (error) {
      cb?.({ ok: false, error: error.message });
    }
  });

  socket.on('room:leave', async ({ roomId }, cb) => {
    try {
      socket.leave(roomId);
      await markDisconnected(roomId, user.telegramId);
      const state = await getRoom(roomId);
      if (state) io.to(roomId).emit('room:state', sanitizeState(state));
      cb?.({ ok: true });
    } catch (error) {
      cb?.({ ok: false, error: error.message });
    }
  });

  socket.on('disconnect', async () => {
    const meta = activeSockets.get(socket.id);
    if (!meta) return;
    activeSockets.delete(socket.id);
    await markDisconnected(meta.roomId, meta.userId);
    const state = await getRoom(meta.roomId);
    if (state) io.to(meta.roomId).emit('room:state', sanitizeState(state));
  });
}

function sanitizeState(state) {
  return {
    roomId: state.roomId,
    status: state.status,
    maxPlayers: state.maxPlayers,
    hostUserId: state.hostUserId,
    winnerUserId: state.winnerUserId,
    turnPhase: state.turnPhase,
    currentTurnIndex: state.currentTurnIndex,
    currentTurnUserId: state.turnOrder[state.currentTurnIndex] || null,
    lastDiceValue: state.lastDiceValue,
    moveVersion: state.moveVersion,
    players: state.players,
    turnOrder: state.turnOrder,
    ranks: state.ranks
  };
}

module.exports = { registerSocketHandlers, sanitizeState };
