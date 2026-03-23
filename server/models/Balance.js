const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
  household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', index: true },
  // Account balances
  accounts: [{
    label: { type: String, required: true },     // e.g. "CIBC Hamidreza"
    owner: { type: String },                      // Hamidreza or Farnaz
    amount: { type: Number, required: true },
    currency: { type: String, default: 'CAD' },
    type: { type: String, enum: ['bank', 'asset', 'liability'], default: 'bank' },
    note: { type: String },
  }],
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Balance', balanceSchema);
