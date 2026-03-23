const mongoose = require('mongoose');

const importLogSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bank: { type: String, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  transactionCount: { type: Number, default: 0 },
  importedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('ImportLog', importLogSchema);
