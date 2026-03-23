const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bank: {
    type: String,
    required: true,
    enum: ['Wealthsimple', 'Scotia', 'TD', 'CIBC', 'RBC'],
  },
  type: {
    type: String,
    required: true,
    enum: ['debit', 'credit'],
  },
  lastFourDigits: { type: String, default: '' },
  nickname: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
