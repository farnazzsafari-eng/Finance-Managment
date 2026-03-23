const express = require('express');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
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
  if (year) {
    return { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31, 23, 59, 59) };
  }
  return null;
}

// Monthly report
router.get('/monthly', auth, async (req, res) => {
  const { owner } = req.query;
  const matchStage = {};
  if (owner) matchStage.owner = toObjectId(owner);
  const dateMatch = buildDateMatch(req.query);
  if (dateMatch) matchStage.date = dateMatch;

  const report = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { month: { $month: '$date' }, year: { $year: '$date' }, type: '$type', category: '$category' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);
  res.json(report);
});

// Per-person spending
router.get('/by-person', auth, async (req, res) => {
  const matchStage = { type: 'expense' };
  const dateMatch = buildDateMatch(req.query);
  if (dateMatch) matchStage.date = dateMatch;

  const report = await Transaction.aggregate([
    { $match: matchStage },
    { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'ownerInfo' } },
    { $unwind: '$ownerInfo' },
    {
      $group: {
        _id: { owner: '$ownerInfo.name', category: '$category' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);
  res.json(report);
});

// Per-card spending
router.get('/by-card', auth, async (req, res) => {
  const { owner } = req.query;
  const matchStage = { type: 'expense' };
  if (owner) matchStage.owner = toObjectId(owner);
  const dateMatch = buildDateMatch(req.query);
  if (dateMatch) matchStage.date = dateMatch;

  const report = await Transaction.aggregate([
    { $match: matchStage },
    { $group: { _id: { bank: '$bank', cardType: '$cardType' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  res.json(report);
});

// Top merchants/stores
router.get('/top-merchants', auth, async (req, res) => {
  const { owner, limit } = req.query;
  const matchStage = { type: 'expense' };
  if (owner) matchStage.owner = toObjectId(owner);
  const dateMatch = buildDateMatch(req.query);
  if (dateMatch) matchStage.date = dateMatch;

  const report = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$description',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        store: { $first: '$store' },
      },
    },
    { $sort: { total: -1 } },
    { $limit: parseInt(limit) || 15 },
  ]);
  res.json(report);
});

// Savings rate (monthly) — excludes transfers for accurate income/expense
router.get('/savings-rate', auth, async (req, res) => {
  const { owner } = req.query;
  const matchStage = { category: { $nin: ['Transfer', 'Transfers', 'Internal Transfer'] } };
  if (owner) matchStage.owner = toObjectId(owner);
  const dateMatch = buildDateMatch(req.query);
  if (dateMatch) matchStage.date = dateMatch;

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

  const monthMap = {};
  trend.forEach((t) => {
    const key = `${t._id.year}-${String(t._id.month).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = { year: t._id.year, month: t._id.month, label: key, income: 0, expense: 0 };
    if (t._id.type === 'income') monthMap[key].income = t.total;
    else monthMap[key].expense = t.total;
  });

  const result = Object.values(monthMap)
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((m) => ({
      ...m,
      savings: m.income - m.expense,
      savingsRate: m.income > 0 ? ((m.income - m.expense) / m.income) * 100 : 0,
    }));

  res.json(result);
});

// Cash flow (weekly) — excludes transfers
router.get('/cash-flow', auth, async (req, res) => {
  const { owner } = req.query;
  const matchStage = { category: { $nin: ['Transfer', 'Transfers', 'Internal Transfer'] } };
  if (owner) matchStage.owner = toObjectId(owner);
  const dateMatch = buildDateMatch(req.query);
  if (dateMatch) matchStage.date = dateMatch;

  const daily = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, type: '$type' },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  const dayMap = {};
  daily.forEach((d) => {
    if (!dayMap[d._id.date]) dayMap[d._id.date] = { date: d._id.date, income: 0, expense: 0 };
    if (d._id.type === 'income') dayMap[d._id.date].income = d.total;
    else dayMap[d._id.date].expense = d.total;
  });

  let cumulative = 0;
  const result = Object.values(dayMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const netFlow = d.income - d.expense;
      cumulative += netFlow;
      return { ...d, netFlow, cumulativeBalance: cumulative };
    });

  res.json(result);
});

// Year-over-year comparison
router.get('/year-over-year', auth, async (req, res) => {
  const { owner, year1, year2 } = req.query;
  const y1 = parseInt(year1) || new Date().getFullYear() - 1;
  const y2 = parseInt(year2) || new Date().getFullYear();

  const matchStage = {};
  if (owner) matchStage.owner = toObjectId(owner);
  matchStage.date = {
    $gte: new Date(Math.min(y1, y2), 0, 1),
    $lte: new Date(Math.max(y1, y2), 11, 31, 23, 59, 59),
  };

  const data = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.month': 1 } },
  ]);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const result = MONTHS.map((name, i) => {
    const m = i + 1;
    return {
      month: name,
      [`${y1}_income`]: data.find((d) => d._id.year === y1 && d._id.month === m && d._id.type === 'income')?.total || 0,
      [`${y1}_expense`]: data.find((d) => d._id.year === y1 && d._id.month === m && d._id.type === 'expense')?.total || 0,
      [`${y2}_income`]: data.find((d) => d._id.year === y2 && d._id.month === m && d._id.type === 'income')?.total || 0,
      [`${y2}_expense`]: data.find((d) => d._id.year === y2 && d._id.month === m && d._id.type === 'expense')?.total || 0,
    };
  });

  res.json({ year1: y1, year2: y2, data: result });
});

module.exports = router;
