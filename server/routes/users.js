const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Household = require('../models/Household');
const auth = require('../middleware/auth');
const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { userId: user._id, name: user.name, householdId: user.household, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Register — creates a new household + admin user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, householdName } = req.body;

    if (email && await User.findOne({ email })) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user first (no household yet)
    const user = await User.create({
      name,
      email,
      password,
      role: 'admin',
    });

    // Create household with user as admin
    const encryptionKey = Household.generateEncryptionKey();
    const household = await Household.create({
      name: householdName || `${name}'s Family`,
      admin: user._id,
      members: [user._id],
      encryptionKey,
    });

    // Link user to household
    user.household = household._id;
    await user.save();

    const token = makeToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, role: user.role, household: household._id },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Join via invite link (family member)
router.post('/join', async (req, res) => {
  try {
    const { name, password, inviteToken } = req.body;

    // Check family member invite first
    let household = await Household.findOne({
      inviteToken,
      inviteExpiresAt: { $gt: new Date() },
    });
    let role = 'member';

    // Check advisor invite
    if (!household) {
      household = await Household.findOne({
        advisorInviteToken: inviteToken,
        advisorInviteExpiresAt: { $gt: new Date() },
      });
      role = 'advisor';
    }

    if (!household) {
      return res.status(400).json({ error: 'Invalid or expired invite link' });
    }

    const user = await User.create({
      name,
      password,
      household: household._id,
      role,
    });

    household.members.push(user._id);
    await household.save();

    const token = makeToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, role: user.role },
      household: { name: household.name },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Generate invite link (admin only)
router.post('/invite', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only household admin can create invites' });
    }

    const household = await Household.findById(user.household);
    const token = household.generateInvite(req.body.expiresInHours || 72);
    await household.save();

    res.json({
      inviteToken: token,
      expiresAt: household.inviteExpiresAt,
      inviteUrl: `/join/${token}`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Generate advisor invite link (admin only)
router.post('/invite-advisor', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only household admin can create advisor invites' });
    }

    const household = await Household.findById(user.household);
    const token = household.generateAdvisorInvite(req.body.expiresInHours || 72);
    await household.save();

    res.json({
      inviteToken: token,
      expiresAt: household.advisorInviteExpiresAt,
      inviteUrl: `/join/${token}`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { name, password, email } = req.body;
    // Allow login by name or email
    const query = email ? { email } : { name };
    const user = await User.findOne(query);
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = makeToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, role: user.role, household: user.household },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.userId).select('-password');
  res.json(user);
});

// List users in same household only
router.get('/', auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (user.household) {
    const users = await User.find({ household: user.household }).select('-password');
    res.json(users);
  } else {
    // Legacy: no household, show all (for backward compat)
    const users = await User.find().select('-password');
    res.json(users);
  }
});

// Get household info
router.get('/household', auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user.household) return res.json(null);
  const household = await Household.findById(user.household)
    .populate('members', 'name email role displayName title avatarUrl')
    .populate('admin', 'name email');
  res.json(household);
});

// Update household settings (admin only)
router.put('/household/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can update settings' });
    }

    const updates = {};
    if (typeof req.body.showInternalTransfers === 'boolean') {
      updates.showInternalTransfers = req.body.showInternalTransfers;
    }
    if (typeof req.body.reminderEnabled === 'boolean') {
      updates.reminderEnabled = req.body.reminderEnabled;
    }
    if (typeof req.body.reminderDayOfMonth === 'number') {
      updates.reminderDayOfMonth = Math.max(1, Math.min(28, req.body.reminderDayOfMonth));
    }
    if (typeof req.body.reminderEmail === 'string') {
      updates.reminderEmail = req.body.reminderEmail;
    }

    const household = await Household.findByIdAndUpdate(
      user.household,
      { $set: updates },
      { new: true }
    );

    res.json(household);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.displayName === 'string') updates.displayName = req.body.displayName;
    if (typeof req.body.title === 'string') updates.title = req.body.title;
    if (typeof req.body.avatarUrl === 'string') updates.avatarUrl = req.body.avatarUrl;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
