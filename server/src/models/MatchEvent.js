const mongoose = require('mongoose');

const MatchEventSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    byUserId: String,
    payload: mongoose.Schema.Types.Mixed,
    moveVersion: Number
  },
  { timestamps: true }
);

module.exports = mongoose.model('MatchEvent', MatchEventSchema);
