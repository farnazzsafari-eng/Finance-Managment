const express = require('express');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const router = express.Router();

// Internal transfer categories — shown separately, NOT excluded
const INTERNAL_CATEGORIES = ['Internal Transfer'];

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
  const matchStage = { ...extraMatch };
  if (query.owner) matchStage.owner = toObjectId(query.owner);
  if (query.householdId) matchStage.household = toObjectId(query.householdId);
  const dateMatch = buildDateMatch(query);
  if (dateMatch) matchStage.date = dateMatch;
  return matchStage;
}

// Monthly report — includes everything, labels internal transfers separately
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

// Per-person spending — real expenses only (no internal transfers)
router.get('/by-person', auth, async (req, res) => {
  const matchStage = baseFilter(req.query, { type: 'expense', type: { $nin: ['internal'] } });

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

// Per-card spending — real expenses only
router.get('/by-card', auth, async (req, res) => {
  const matchStage = baseFilter(req.query, { type: 'expense', type: { $nin: ['internal'] } });

  const report = await Transaction.aggregate([
    { $match: matchStage },
    { $group: { _id: { bank: '$bank', cardType: '$cardType' }, total: { $sum: '$amount' }, count: { $sum: 1 }, avgAmount: { $avg: '$amount' } } },
    { $sort: { total: -1 } },
  ]);
  res.json(report);
});

// Top merchants/stores — real expenses only
router.get('/top-merchants', auth, async (req, res) => {
  const { limit } = req.query;
  const matchStage = baseFilter(req.query, { type: 'expense', type: { $nin: ['internal'] } });

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

// Savings rate — real income vs real expenses (no internal transfers)
router.get('/savings-rate', auth, async (req, res) => {
  const matchStage = baseFilter(req.query, { type: { $nin: ['internal'] } });

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
    else if (t._id.type === 'expense') monthMap[key].expense = t.total;
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

// Cash flow — real income/expenses only
router.get('/cash-flow', auth, async (req, res) => {
  const matchStage = baseFilter(req.query, { type: { $nin: ['internal'] } });

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
    else if (d._id.type === 'expense') dayMap[d._id.date].expense = d.total;
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

// Year-over-year comparison — real income/expenses only
router.get('/year-over-year', auth, async (req, res) => {
  const { owner, year1, year2 } = req.query;
  const y1 = parseInt(year1) || new Date().getFullYear() - 1;
  const y2 = parseInt(year2) || new Date().getFullYear();

  const matchStage = { type: { $nin: ['internal'] } };
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

// Average expenses report — real expenses only
router.get('/averages', auth, async (req, res) => {
  const matchStage = baseFilter(req.query, { type: 'expense', type: { $nin: ['internal'] } });

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

// Category detail report — transactions + monthly totals for a specific category/subCategory
router.get('/category-detail', auth, async (req, res) => {
  const { category, subCategory, startDate, endDate, owner } = req.query;

  const matchStage = {};
  if (owner) matchStage.owner = toObjectId(owner);
  const dateMatch = buildDateMatch(req.query);
  if (dateMatch) matchStage.date = dateMatch;

  // Match by category or subCategory
  if (category) matchStage.category = category;
  if (subCategory) matchStage.subCategory = subCategory;

  // Get all matching transactions
  const transactions = await Transaction.find(matchStage)
    .populate('owner', 'name')
    .sort({ date: -1 })
    .limit(500)
    .lean();

  // Monthly totals aggregation
  const monthlyTotals = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const count = transactions.length;
  const monthCount = monthlyTotals.length;
  const average = monthCount > 0 ? total / monthCount : 0;

  const formattedMonthly = monthlyTotals.map((m) => ({
    month: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m._id.month - 1]} ${String(m._id.year).slice(2)}`,
    total: m.total,
    count: m.count,
    year: m._id.year,
    monthNum: m._id.month,
  }));

  res.json({ transactions, monthlyTotals: formattedMonthly, total, count, average });
});

module.exports = router;
