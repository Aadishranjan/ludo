const { PLAYER_COLORS, TOKENS_PER_PLAYER } = require('./constants');

function createEmptyRoomState({ roomId, maxPlayers = 4, hostUserId }) {
  return {
    roomId,
    status: 'waiting',
    maxPlayers,
    hostUserId,
    createdAt: new Date().toISOString(),
    startedAt: null,
    winnerUserId: null,
    turnPhase: 'roll',
    currentTurnIndex: 0,
    lastDiceValue: null,
    moveVersion: 0,
    players: [],
    turnOrder: [],
    ranks: []
  };
}

function createPlayerState({ userId, username, firstName, color }) {
  return {
    userId,
    username,
    firstName,
    color,
    connected: true,
    lastSeenAt: new Date().toISOString(),
    tokens: Array.from({ length: TOKENS_PER_PLAYER }, (_, tokenIndex) => ({
      tokenId: `${color}-${tokenIndex}`,
      progress: -1
    }))
  };
}

function assignAvailableColor(players) {
  const used = new Set(players.map((p) => p.color));
  const color = PLAYER_COLORS.find((c) => !used.has(c));
  return color || null;
}

module.exports = {
  createEmptyRoomState,
  createPlayerState,
  assignAvailableColor
};
