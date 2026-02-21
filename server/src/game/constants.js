const PLAYER_COLORS = ['red', 'green', 'yellow', 'blue'];
const TOKENS_PER_PLAYER = 4;
const TRACK_LENGTH = 52;
const HOME_LENGTH = 6;
const FINISH_PROGRESS = TRACK_LENGTH + HOME_LENGTH;
const ENTRY_DICE = 6;
const SAFE_ZONES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const START_OFFSETS = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39
};

module.exports = {
  PLAYER_COLORS,
  TOKENS_PER_PLAYER,
  TRACK_LENGTH,
  HOME_LENGTH,
  FINISH_PROGRESS,
  ENTRY_DICE,
  SAFE_ZONES,
  START_OFFSETS
};
