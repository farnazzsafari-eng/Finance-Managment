const mongoose = require('mongoose');

const CATEGORIES = [
  'Groceries', 'Restaurants', 'Transportation', 'Housing/Rent',
  'Utilities', 'Entertainment', 'Health', 'Education', 'Clothing',
  'Subscriptions', 'Shopping', 'Gas', 'Insurance', 'Income', 'Transfer',
  'Transfers', 'Internal Transfer', 'Fees & Charges', 'Pets', 'Food Delivery',
  'Travel', 'Salary', 'Furniture', 'Personal Care', 'Other',
];

const transactionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', index: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  date: { type: Date, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['income', 'expense', 'internal'], required: true },
  category: { type: String, enum: CATEGORIES, default: 'Other' },
  subCategory: { type: String, default: '' },
  source: { type: String, default: 'manual' }, // manual, csv-import, browser-import
  bank: { type: String },
  cardType: { type: String, enum: ['debit', 'credit'] },
  store: { type: String }, // Amazon, Costco, etc.
}, { timestamps: true });

transactionSchema.index({ owner: 1, date: -1 });
transactionSchema.index({ category: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
module.exports.CATEGORIES = CATEGORIES;
