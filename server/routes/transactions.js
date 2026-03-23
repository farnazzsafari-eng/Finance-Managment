const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { requireWriteAccess } = require('../middleware/auth');
const { decryptTransaction, encryptTransaction } = require('../services/encryption');
const router = express.Router();

function toObjectId(id) {
  return mongoose.Types.ObjectId.createFromHexString(id);
}

function buildDateMatch(query) {
  const { startDate, endDate, month, year } = query;
  if (startDate || endDate) {
    const d = {};
    if (startDate) d.$gte = new Date(startDate);
    if (endDate) d.$lte = new Date(endDate + 'T23:59:59');
    return d;
  }
  if (month && year) {
    return { $gte: new Date(year, month - 1, 1), $lte: new Date(year, month, 0, 23, 59, 59) };
  }
  return null;
}

// Get transactions with filters
router.get('/', auth, async (req, res) => {
  const { owner, bank, cardType, category, subCategory, startDate, endDate, store, type } = req.query;
  const filter = {};

  // Household isolation: only show data from user's household
  if (req.householdId) filter.household = req.householdId;

  if (owner) filter.owner = owner;
  if (bank) filter.bank = bank;
  if (cardType) filter.cardType = cardType;
  if (category) filter.category = category;
  if (subCategory) filter.subCategory = subCategory;
  if (store) filter.store = store;
  if (type) filter.type = type;
  const dateMatch = buildDateMatch(req.query);
  if (dateMatch) filter.date = dateMatch;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  const [transactions, totalCount, totals] = await Promise.all([
    Transaction.find(filter)
      .populate('owner', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      { $match: (() => {
        const m = { ...filter };
        if (m.owner) m.owner = toObjectId(m.owner);
        if (m.household) m.household = toObjectId(m.household);
        return m;
      })() },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const totalIncome = totals.find((t) => t._id === 'income')?.total || 0;
  const totalExpense = totals.find((t) => t._id === 'expense')?.total || 0;
  const totalInternal = totals.find((t) => t._id === 'internal')?.total || 0;

  // Decrypt descriptions if household has encryption
  const encKey = await req.getEncryptionKey();
  const decrypted = encKey
    ? transactions.map((t) => decryptTransaction(t, encKey))
    : transactions;

  res.json({
    transactions: decrypted,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
    totals: { income: totalIncome, expense: totalExpense, internal: totalInternal, net: totalIncome - totalExpense },
  });
});

// Get summary/stats — supports startDate/endDate or month/year
router.get('/summary', auth, async (req, res) => {
  const { owner } = req.query;
  const matchStage = {};

  if (req.householdId) matchStage.household = toObjectId(req.householdId);
  if (owner) matchStage.owner = toObjectId(owner);
  const dateMatch = buildDateMatch(req.query);
  if (dateMatch) matchStage.date = dateMatch;

  // 3 types: income, expense, internal
  const [byCategory, byBank, byCardType, typeTotals, internalTotal] = await Promise.all([
    // Real expenses by category
    Transaction.aggregate([
      { $match: { ...matchStage, type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    // Real expenses by bank
    Transaction.aggregate([
      { $match: { ...matchStage, type: 'expense' } },
      { $group: { _id: '$bank', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]),
    // Real expenses by card type
    Transaction.aggregate([
      { $match: { ...matchStage, type: 'expense' } },
      { $group: { _id: '$cardType', total: { $sum: '$amount' } } },
    ]),
    // All type totals
    Transaction.aggregate([
      { $match: matchStage },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    // Internal transfer total
    Transaction.aggregate([
      { $match: { ...matchStage, type: 'internal' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const totalIncome = typeTotals.find((t) => t._id === 'income')?.total || 0;
  const totalExpense = typeTotals.find((t) => t._id === 'expense')?.total || 0;
  const totalInternal = internalTotal[0]?.total || 0;
  const internalCount = internalTotal[0]?.count || 0;

  res.json({
    totalIncome, totalExpense,
    balance: totalIncome - totalExpense,
    internalTransfers: { total: totalInternal, count: internalCount },
    byCategory, byBank, byCardType,
  });
});

// Overall balance (all-time, no date filter, excludes transfers)
router.get('/overall-balance', auth, async (req, res) => {
  const { owner } = req.query;
  const matchStage = { type: { $in: ['income', 'expense'] } };
  if (req.householdId) matchStage.household = toObjectId(req.householdId);
  if (owner) matchStage.owner = toObjectId(owner);

  const [totals, byBank] = await Promise.all([
    Transaction.aggregate([
      { $match: matchStage },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { bank: '$bank', type: '$type' },
          total: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const totalIncome = totals.find((t) => t._id === 'income')?.total || 0;
  const totalExpense = totals.find((t) => t._id === 'expense')?.total || 0;

  // Build per-bank balance
  const bankMap = {};
  byBank.forEach((b) => {
    const bank = b._id.bank || 'Unknown';
    if (!bankMap[bank]) bankMap[bank] = { bank, income: 0, expense: 0 };
    if (b._id.type === 'income') bankMap[bank].income = b.total;
    else bankMap[bank].expense = b.total;
  });
  const bankBalances = Object.values(bankMap)
    .map((b) => ({ bank: b.bank, balance: b.income - b.expense }))
    .sort((a, b) => b.balance - a.balance);

  res.json({
    overallBalance: totalIncome - totalExpense,
    totalIncome,
    totalExpense,
    byBank: bankBalances,
  });
});

// Category details — transactions grouped by description within a category
router.get('/category-details', auth, async (req, res) => {
  const { owner, category } = req.query;
  const matchStage = { type: 'expense' };
  if (req.householdId) matchStage.household = toObjectId(req.householdId);
  if (owner) matchStage.owner = toObjectId(owner);
  if (category) matchStage.category = category;
  const dateMatch = buildDateMatch(req.query);
  if (dateMatch) matchStage.date = dateMatch;

  const details = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$description',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        lastDate: { $max: '$date' },
        category: { $first: '$category' },
        bank: { $first: '$bank' },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 50 },
  ]);
  res.json(details);
});

// Monthly trend — supports startDate/endDate or year
router.get('/monthly-trend', auth, async (req, res) => {
  const { owner, startDate, endDate, year } = req.query;
  const matchStage = {};
  if (req.householdId) matchStage.household = toObjectId(req.householdId);
  if (owner) matchStage.owner = toObjectId(owner);

  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = new Date(startDate);
    if (endDate) matchStage.date.$lte = new Date(endDate + 'T23:59:59');
  } else if (year) {
    matchStage.date = { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31, 23, 59, 59) };
  }

  const trend = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  // Build results grouped by year-month (exclude internal from income/expense)
  const monthMap = {};
  trend.forEach((t) => {
    const key = `${t._id.year}-${String(t._id.month).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = { year: t._id.year, month: t._id.month, label: key, income: 0, expense: 0, internal: 0 };
    if (t._id.type === 'income') monthMap[key].income = t.total;
    else if (t._id.type === 'expense') monthMap[key].expense = t.total;
    else if (t._id.type === 'internal') monthMap[key].internal = t.total;
  });

  res.json(Object.values(monthMap).sort((a, b) => a.label.localeCompare(b.label)));
});

// Create transaction
router.post('/', auth, requireWriteAccess, async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.householdId) data.household = req.householdId;

    // Encrypt description
    const encKey = await req.getEncryptionKey();
    if (encKey && data.description) {
      data.description = require('../services/encryption').encrypt(data.description, encKey);
    }

    const transaction = await Transaction.create(data);
    res.status(201).json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk import
router.post('/bulk', auth, requireWriteAccess, async (req, res) => {
  try {
    const transactions = await Transaction.insertMany(req.body.transactions);
    res.status(201).json({ imported: transactions.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update
router.put('/:id', auth, requireWriteAccess, async (req, res) => {
  try {
    // Only allow updating category and subCategory inline
    const allowedFields = {};
    if (req.body.category !== undefined) allowedFields.category = req.body.category;
    if (req.body.subCategory !== undefined) allowedFields.subCategory = req.body.subCategory;

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, household: req.householdId },
      { $set: allowedFields },
      { new: true, runValidators: true }
    );
    if (!transaction) return res.status(404).json({ error: 'Not found' });

    // Decrypt for response
    const encKey = await req.getEncryptionKey();
    const decrypted = decryptTransaction(transaction.toObject(), encKey);
    res.json(decrypted);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete
router.delete('/:id', auth, requireWriteAccess, async (req, res) => {
  await Transaction.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
