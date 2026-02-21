const crypto = require('crypto');
const {
  TRACK_LENGTH,
  FINISH_PROGRESS,
  ENTRY_DICE,
  SAFE_ZONES,
  START_OFFSETS
} = require('./constants');

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function getPlayerByUserId(state, userId) {
  return state.players.find((p) => p.userId === userId) || null;
}

function currentTurnUserId(state) {
  return state.turnOrder[state.currentTurnIndex] || null;
}

function getGlobalTrackPosition(playerColor, progress) {
  if (progress < 0 || progress >= TRACK_LENGTH) return null;
  return (START_OFFSETS[playerColor] + progress) % TRACK_LENGTH;
}

function listMovableTokens(state, player, diceValue) {
  const result = [];
  for (const token of player.tokens) {
    if (token.progress === -1 && diceValue === ENTRY_DICE) result.push(token.tokenId);
    if (token.progress >= 0 && token.progress + diceValue <= FINISH_PROGRESS) result.push(token.tokenId);
  }
  return result;
}

function startGame(state) {
  if (state.status !== 'waiting') throw new Error('Game already started');
  if (state.players.length < 2) throw new Error('Need at least 2 players');

  state.status = 'active';
  state.startedAt = new Date().toISOString();
  state.turnOrder = state.players.map((p) => p.userId);
  state.currentTurnIndex = 0;
  state.turnPhase = 'roll';
  state.lastDiceValue = null;
  state.ranks = [];
  state.moveVersion += 1;

  return state;
}

function rollDice(state, userId) {
  if (state.status !== 'active') throw new Error('Game is not active');
  if (state.turnPhase !== 'roll') throw new Error('Already rolled for this turn');
  if (currentTurnUserId(state) !== userId) throw new Error('Not your turn');

  const player = getPlayerByUserId(state, userId);
  const diceValue = crypto.randomInt(1, 7);
  const movable = listMovableTokens(state, player, diceValue);

  state.lastDiceValue = diceValue;
  state.turnPhase = 'move';
  state.moveVersion += 1;

  if (movable.length === 0) {
    finishTurn(state, { extraTurn: false });
  }

  return {
    diceValue,
    movableTokenIds: movable
  };
}

function moveToken(state, userId, tokenId) {
  if (state.status !== 'active') throw new Error('Game is not active');
  if (state.turnPhase !== 'move') throw new Error('Roll dice first');
  if (currentTurnUserId(state) !== userId) throw new Error('Not your turn');

  const player = getPlayerByUserId(state, userId);
  if (!player) throw new Error('Player not found');

  const diceValue = state.lastDiceValue;
  const movable = listMovableTokens(state, player, diceValue);
  if (!movable.includes(tokenId)) throw new Error('Invalid move');

  const token = player.tokens.find((t) => t.tokenId === tokenId);
  if (token.progress === -1) {
    token.progress = 0;
  } else {
    token.progress += diceValue;
  }

  const kills = applyKillIfNeeded(state, player, token);
  const finishedNow = token.progress === FINISH_PROGRESS;
  const allFinished = player.tokens.every((t) => t.progress === FINISH_PROGRESS);
  if (allFinished && !state.ranks.includes(userId)) {
    state.ranks.push(userId);
  }

  if (state.ranks.length === state.players.length - 1) {
    const winnerId = state.players.find((p) => !state.ranks.includes(p.userId))?.userId || userId;
    state.status = 'finished';
    state.winnerUserId = winnerId;
    state.turnPhase = 'ended';
  } else {
    const extraTurn = diceValue === ENTRY_DICE;
    finishTurn(state, { extraTurn });
  }

  state.moveVersion += 1;

  return {
    tokenId,
    progress: token.progress,
    kills,
    finishedNow,
    extraTurn: diceValue === ENTRY_DICE,
    winnerUserId: state.winnerUserId
  };
}

function applyKillIfNeeded(state, activePlayer, movedToken) {
  const progress = movedToken.progress;
  if (progress < 0 || progress >= TRACK_LENGTH) return [];

  const global = getGlobalTrackPosition(activePlayer.color, progress);
  if (SAFE_ZONES.has(global)) return [];

  const kills = [];
  for (const opponent of state.players) {
    if (opponent.userId === activePlayer.userId) continue;

    for (const token of opponent.tokens) {
      if (token.progress < 0 || token.progress >= TRACK_LENGTH) continue;
      const oppGlobal = getGlobalTrackPosition(opponent.color, token.progress);
      if (oppGlobal === global) {
        token.progress = -1;
        kills.push({ playerUserId: opponent.userId, tokenId: token.tokenId });
      }
    }
  }

  return kills;
}

function finishTurn(state, { extraTurn }) {
  state.lastDiceValue = null;
  state.turnPhase = 'roll';
  if (!extraTurn) {
    state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  }
}

module.exports = {
  cloneState,
  startGame,
  rollDice,
  moveToken,
  getPlayerByUserId,
  currentTurnUserId,
  getGlobalTrackPosition
};
