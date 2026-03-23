const express = require('express');
const Account = require('../models/Account');
const auth = require('../middleware/auth');
const { requireWriteAccess } = require('../middleware/auth');
const router = express.Router();

// Get all accounts (optionally filter by owner)
router.get('/', auth, async (req, res) => {
  const filter = req.query.owner ? { owner: req.query.owner } : {};
  const accounts = await Account.find(filter).populate('owner', 'name');
  res.json(accounts);
});

// Create account
router.post('/', auth, requireWriteAccess, async (req, res) => {
  try {
    const account = await Account.create(req.body);
    res.status(201).json(account);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update account
router.put('/:id', auth, requireWriteAccess, async (req, res) => {
  const account = await Account.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!account) return res.status(404).json({ error: 'Not found' });
  res.json(account);
});

// Delete account
router.delete('/:id', auth, requireWriteAccess, async (req, res) => {
  await Account.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
