const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, sparse: true },
  password: { type: String, required: true },
  household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household' },
  role: { type: String, enum: ['admin', 'member', 'advisor'], default: 'member' },
  // Profile fields
  displayName: { type: String, default: '' },
  title: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
