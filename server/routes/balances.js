const express = require('express');
const Balance = require('../models/Balance');
const auth = require('../middleware/auth');
const router = express.Router();

// Get current balances
router.get('/', auth, async (req, res) => {
  let balance = await Balance.findOne().sort({ updatedAt: -1 });
  if (!balance) {
    balance = { accounts: [], updatedAt: null };
  }
  res.json(balance);
});

// Save/update balances (replaces all)
router.put('/', auth, async (req, res) => {
  const { accounts } = req.body;
  let balance = await Balance.findOne();
  if (balance) {
    balance.accounts = accounts;
    balance.updatedAt = new Date();
    await balance.save();
  } else {
    balance = await Balance.create({ accounts });
  }
  res.json(balance);
});

module.exports = router;
