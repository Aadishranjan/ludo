const { nanoid } = require('nanoid');
const Room = require('../models/Room');
const MatchEvent = require('../models/MatchEvent');
const { createEmptyRoomState, createPlayerState, assignAvailableColor } = require('../game/state');
const { cloneState } = require('../game/engine');

const inMemoryRooms = new Map();

function buildRoomCode() {
  return nanoid(8).toUpperCase();
}

async function createRoom({ hostUser, maxPlayers }) {
  let roomId = buildRoomCode();
  for (let i = 0; i < 3; i += 1) {
    // Very low probability, but avoid room ID collisions in production.
    // eslint-disable-next-line no-await-in-loop
    const exists = await Room.exists({ roomId });
    if (!exists) break;
    roomId = buildRoomCode();
  }

  const clampedMaxPlayers = Math.max(2, Math.min(4, Number(maxPlayers || 4)));
  const state = createEmptyRoomState({ roomId, maxPlayers: clampedMaxPlayers, hostUserId: hostUser.telegramId });
  const hostPlayer = createPlayerState({
    userId: hostUser.telegramId,
    username: hostUser.username,
    firstName: hostUser.firstName,
    color: 'red'
  });
  state.players.push(hostPlayer);

  await Room.create(normalizeForMongo(state));
  inMemoryRooms.set(roomId, state);
  await logEvent(roomId, 'room_created', hostUser.telegramId, { maxPlayers });

  return cloneState(state);
}

async function getRoom(roomId) {
  if (inMemoryRooms.has(roomId)) return inMemoryRooms.get(roomId);
  const room = await Room.findOne({ roomId }).lean();
  if (!room) return null;
  inMemoryRooms.set(roomId, room);
  return room;
}

async function saveRoom(state) {
  inMemoryRooms.set(state.roomId, state);
  await Room.findOneAndUpdate({ roomId: state.roomId }, normalizeForMongo(state), {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true
  });
}

async function joinRoom({ roomId, user }) {
  const state = await getRoom(roomId);
  if (!state) throw new Error('Room not found');
  if (state.status !== 'waiting' && !state.players.find((p) => p.userId === user.telegramId)) {
    throw new Error('Room is locked');
  }

  const existing = state.players.find((p) => p.userId === user.telegramId);
  if (existing) {
    existing.connected = true;
    existing.lastSeenAt = new Date().toISOString();
    existing.username = user.username;
    existing.firstName = user.firstName;
  } else {
    if (state.players.length >= state.maxPlayers) throw new Error('Room full');
    const color = assignAvailableColor(state.players);
    if (!color) throw new Error('No color seat available');
    state.players.push(
      createPlayerState({
        userId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        color
      })
    );
  }

  await saveRoom(state);
  await logEvent(roomId, 'player_joined', user.telegramId, { players: state.players.length });
  return cloneState(state);
}

async function markDisconnected(roomId, userId) {
  const state = await getRoom(roomId);
  if (!state) return;
  const player = state.players.find((p) => p.userId === userId);
  if (!player) return;

  player.connected = false;
  player.lastSeenAt = new Date().toISOString();
  await saveRoom(state);
}

async function removeRoomFromMemory(roomId) {
  inMemoryRooms.delete(roomId);
}

async function logEvent(roomId, type, byUserId, payload = {}, moveVersion) {
  await MatchEvent.create({ roomId, type, byUserId, payload, moveVersion });
}

function normalizeForMongo(state) {
  return {
    roomId: state.roomId,
    status: state.status,
    maxPlayers: state.maxPlayers,
    hostUserId: state.hostUserId,
    winnerUserId: state.winnerUserId,
    turnPhase: state.turnPhase,
    currentTurnIndex: state.currentTurnIndex,
    lastDiceValue: state.lastDiceValue,
    moveVersion: state.moveVersion,
    players: state.players,
    turnOrder: state.turnOrder,
    ranks: state.ranks,
    startedAt: state.startedAt ? new Date(state.startedAt) : null
  };
}

module.exports = {
  createRoom,
  getRoom,
  saveRoom,
  joinRoom,
  markDisconnected,
  removeRoomFromMemory,
  logEvent
};
