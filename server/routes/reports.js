const express = require('express');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const router = express.Router();

// Categories to ALWAYS exclude from income/expense calculations
const EXCLUDED_CATEGORIES = ['Transfer', 'Transfers', 'Internal Transfer', 'Fees & Charges'];

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

function baseFilter(query, extraMatch = {}) {
  const matchStage = { category: { $nin: EXCLUDED_CATEGORIES }, ...extraMatch };
  if (query.owner) matchStage.owner = toObjectId(query.owner);
  if (query.householdId) matchStage.household = toObjectId(query.householdId);
  const dateMatch = buildDateMatch(query);
  if (dateMatch) matchStage.date = dateMatch;
  return matchStage;
}

// Monthly report — excludes internal transfers
router.get('/monthly', auth, async (req, res) => {
  const matchStage = baseFilter(req.query);

  const report = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { month: { $month: '$date' }, year: { $year: '$date' }, type: '$type', category: '$category' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);
  res.json(report);
});

// Per-person spending — excludes internal transfers
router.get('/by-person', auth, async (req, res) => {
  const matchStage = baseFilter(req.query, { type: 'expense' });

  const report = await Transaction.aggregate([
    { $match: matchStage },
    { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'ownerInfo' } },
    { $unwind: '$ownerInfo' },
    {
      $group: {
        _id: { owner: '$ownerInfo.name', category: '$category' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
      },
    },
    { $sort: { total: -1 } },
  ]);
  res.json(report);
});

// Per-card spending — excludes internal transfers
router.get('/by-card', auth, async (req, res) => {
  const matchStage = baseFilter(req.query, { type: 'expense' });

  const report = await Transaction.aggregate([
    { $match: matchStage },
    { $group: { _id: { bank: '$bank', cardType: '$cardType' }, total: { $sum: '$amount' }, count: { $sum: 1 }, avgAmount: { $avg: '$amount' } } },
    { $sort: { total: -1 } },
  ]);
  res.json(report);
});

// Top merchants/stores — excludes internal transfers
router.get('/top-merchants', auth, async (req, res) => {
  const { limit } = req.query;
  const matchStage = baseFilter(req.query, { type: 'expense' });

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

// Savings rate (monthly) — excludes internal transfers
router.get('/savings-rate', auth, async (req, res) => {
  const matchStage = baseFilter(req.query);

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

// Cash flow (daily) — excludes internal transfers
router.get('/cash-flow', auth, async (req, res) => {
  const matchStage = baseFilter(req.query);

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

// Year-over-year comparison — excludes internal transfers
router.get('/year-over-year', auth, async (req, res) => {
  const { owner, year1, year2 } = req.query;
  const y1 = parseInt(year1) || new Date().getFullYear() - 1;
  const y2 = parseInt(year2) || new Date().getFullYear();

  const matchStage = { category: { $nin: EXCLUDED_CATEGORIES } };
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

// Average expenses report
router.get('/averages', auth, async (req, res) => {
  const matchStage = baseFilter(req.query, { type: 'expense' });

  const data = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' }, category: '$category' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Calculate per-category monthly averages
  const categoryMonths = {};
  data.forEach(d => {
    const cat = d._id.category;
    if (!categoryMonths[cat]) categoryMonths[cat] = { months: new Set(), total: 0, count: 0 };
    categoryMonths[cat].months.add(`${d._id.year}-${d._id.month}`);
    categoryMonths[cat].total += d.total;
    categoryMonths[cat].count += d.count;
  });

  const averages = Object.entries(categoryMonths).map(([category, data]) => ({
    category,
    totalSpent: data.total,
    transactionCount: data.count,
    monthCount: data.months.size,
    monthlyAverage: data.total / data.months.size,
    perTransactionAverage: data.total / data.count,
  })).sort((a, b) => b.monthlyAverage - a.monthlyAverage);

  // Overall average
  const allMonths = new Set();
  let totalSpent = 0;
  data.forEach(d => { allMonths.add(`${d._id.year}-${d._id.month}`); totalSpent += d.total; });

  res.json({
    categories: averages,
    overall: {
      totalSpent,
      monthCount: allMonths.size,
      monthlyAverage: allMonths.size > 0 ? totalSpent / allMonths.size : 0,
    },
  });
});

module.exports = router;
