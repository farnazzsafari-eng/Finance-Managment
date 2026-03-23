const mongoose = require('mongoose');
const crypto = require('crypto');

const householdSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Zahedi Family"
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Invite links
  inviteToken: { type: String, unique: true, sparse: true },
  inviteExpiresAt: { type: Date },
  // Advisor invite (separate from family member invite)
  advisorInviteToken: { type: String, unique: true, sparse: true },
  advisorInviteExpiresAt: { type: Date },
  // Encryption key (encrypted with master key, per-household)
  encryptionKey: { type: String, required: true },
  // Settings
  showInternalTransfers: { type: Boolean, default: false },
  // Subscription (Stripe)
  subscription: {
    status: { type: String, enum: ['free', 'active', 'cancelled'], default: 'free' },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    currentPeriodEnd: { type: Date },
  },
  // Email reminders
  reminderEnabled: { type: Boolean, default: false },
  reminderDayOfMonth: { type: Number, default: 1, min: 1, max: 28 },
  reminderEmail: { type: String, default: '' },
}, { timestamps: true });

// Generate a new encryption key for this household
householdSchema.statics.generateEncryptionKey = function () {
  return crypto.randomBytes(32).toString('hex');
};

// Generate invite token
householdSchema.methods.generateInvite = function (expiresInHours = 72) {
  this.inviteToken = crypto.randomBytes(24).toString('hex');
  this.inviteExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  return this.inviteToken;
};

// Generate advisor invite token
householdSchema.methods.generateAdvisorInvite = function (expiresInHours = 72) {
  this.advisorInviteToken = crypto.randomBytes(24).toString('hex');
  this.advisorInviteExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  return this.advisorInviteToken;
};

module.exports = mongoose.model('Household', householdSchema);
