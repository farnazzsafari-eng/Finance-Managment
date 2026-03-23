const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const { parseCSV } = require('../services/csvParser');
const auth = require('../middleware/auth');
const { requireWriteAccess } = require('../middleware/auth');
const router = express.Router();

function toObjectId(id) {
  return mongoose.Types.ObjectId.createFromHexString(id);
}

/**
 * POST /api/import/csv
 * Smart CSV import — only adds transactions that don't already exist
 *
 * Body: { csvContent, ownerId, bank, cardType }
 *
 * Logic:
 * 1. Parse the CSV with the right bank parser
 * 2. Find existing date range for this owner+bank+cardType
 * 3. Only insert transactions whose date is NOT already covered
 * 4. Also dedupe by date+description+amount to avoid duplicates
 */
router.post('/csv', auth, requireWriteAccess, async (req, res) => {
  try {
    const { csvContent, ownerId, bank, cardType } = req.body;

    if (!csvContent || !ownerId || !bank) {
      return res.status(400).json({ error: 'csvContent, ownerId, and bank are required' });
    }

    // 1. Parse CSV
    const parsed = parseCSV(csvContent, { ownerId, bank, cardType: cardType || 'debit' });

    if (parsed.length === 0) {
      return res.json({
        imported: 0,
        skipped: 0,
        message: 'No valid transactions found in CSV',
        dateRange: null,
      });
    }

    // 2. Find date range in the CSV
    const csvDates = parsed.map((t) => t.date).sort((a, b) => a - b);
    const csvMinDate = csvDates[0];
    const csvMaxDate = csvDates[csvDates.length - 1];

    // 3. Find existing transactions for this owner+bank+cardType
    const existingFilter = {
      owner: ownerId,
      source: 'csv-import',
    };
    if (bank) existingFilter.bank = bank;
    if (cardType) existingFilter.cardType = cardType;

    const existing = await Transaction.find(existingFilter)
      .select('date description amount')
      .lean();

    // Build a dedup set: "date|description|amount"
    const existingSet = new Set();
    existing.forEach((t) => {
      const key = `${t.date.toISOString().substring(0, 10)}|${t.description}|${t.amount}`;
      existingSet.add(key);
    });

    // Find the max date already in DB for this filter
    const existingDates = existing.map((t) => t.date).sort((a, b) => a - b);
    const dbMaxDate = existingDates.length > 0 ? existingDates[existingDates.length - 1] : null;
    const dbMinDate = existingDates.length > 0 ? existingDates[0] : null;

    // 4. Filter out duplicates
    const newTransactions = parsed.filter((t) => {
      const key = `${t.date.toISOString().substring(0, 10)}|${t.description}|${t.amount}`;
      return !existingSet.has(key);
    });

    // 5. Insert new ones
    let imported = 0;
    if (newTransactions.length > 0) {
      await Transaction.insertMany(newTransactions);
      imported = newTransactions.length;
    }

    res.json({
      imported,
      skipped: parsed.length - newTransactions.length,
      totalInCSV: parsed.length,
      csvDateRange: {
        from: csvMinDate.toISOString().substring(0, 10),
        to: csvMaxDate.toISOString().substring(0, 10),
      },
      existingDateRange: dbMinDate ? {
        from: dbMinDate.toISOString().substring(0, 10),
        to: dbMaxDate.toISOString().substring(0, 10),
      } : null,
      message: imported > 0
        ? `${imported} new transactions imported (${parsed.length - newTransactions.length} duplicates skipped)`
        : 'All transactions already exist — nothing to import',
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/import/status
 * Check what data already exists for a given owner+bank+cardType
 */
router.get('/status', auth, async (req, res) => {
  const { ownerId, bank, cardType } = req.query;

  const filter = { source: 'csv-import' };
  if (ownerId) filter.owner = toObjectId(ownerId);
  if (bank) filter.bank = bank;
  if (cardType) filter.cardType = cardType;

  const queryFilter = { ...filter };
  if (ownerId) queryFilter.owner = ownerId; // mongoose find uses string

  const [count, dateRange] = await Promise.all([
    Transaction.countDocuments(queryFilter),
    Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          minDate: { $min: '$date' },
          maxDate: { $max: '$date' },
        },
      },
    ]),
  ]);

  res.json({
    count,
    dateRange: dateRange.length > 0 ? {
      from: dateRange[0].minDate?.toISOString().substring(0, 10),
      to: dateRange[0].maxDate?.toISOString().substring(0, 10),
    } : null,
  });
});

module.exports = router;
