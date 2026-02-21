const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema(
  {
    tokenId: { type: String, required: true },
    progress: { type: Number, required: true, default: -1 }
  },
  { _id: false }
);

const PlayerSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: String,
    firstName: String,
    color: { type: String, required: true },
    connected: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: Date.now },
    tokens: { type: [TokenSchema], default: [] }
  },
  { _id: false }
);

const RoomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['waiting', 'active', 'finished'], default: 'waiting' },
    maxPlayers: { type: Number, default: 4 },
    hostUserId: { type: String, required: true },
    winnerUserId: String,
    turnPhase: { type: String, default: 'roll' },
    currentTurnIndex: { type: Number, default: 0 },
    lastDiceValue: Number,
    moveVersion: { type: Number, default: 0 },
    players: { type: [PlayerSchema], default: [] },
    turnOrder: { type: [String], default: [] },
    ranks: { type: [String], default: [] },
    startedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', RoomSchema);
