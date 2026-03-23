#!/usr/bin/env node
/**
 * Migrate existing data to household system
 * - Creates a household for Hamidreza & Farnaz
 * - Assigns all existing transactions to that household
 * - Encrypts transaction descriptions
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Household = require('../models/Household');
const Transaction = require('../models/Transaction');
const Balance = require('../models/Balance');
const { encrypt } = require('../services/encryption');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/finance-management');
  console.log('Connected to MongoDB');

  // Check if already migrated
  const existingHousehold = await Household.findOne();
  if (existingHousehold) {
    console.log('Household already exists. Skipping migration.');
    await mongoose.disconnect();
    return;
  }

  // Find existing users
  const hamidreza = await User.findOne({ name: 'Hamidreza' });
  const farnaz = await User.findOne({ name: 'Farnaz' });

  if (!hamidreza) {
    console.error('Hamidreza user not found!');
    process.exit(1);
  }

  // Create household
  const encryptionKey = Household.generateEncryptionKey();
  const household = await Household.create({
    name: 'Zahedi Family',
    admin: hamidreza._id,
    members: [hamidreza._id, ...(farnaz ? [farnaz._id] : [])],
    encryptionKey,
  });

  console.log(`Created household: ${household.name} (${household._id})`);
  console.log(`Encryption key generated: ${encryptionKey.substring(0, 8)}...`);

  // Update users
  await User.updateOne({ _id: hamidreza._id }, { household: household._id, role: 'admin' });
  if (farnaz) {
    await User.updateOne({ _id: farnaz._id }, { household: household._id, role: 'member' });
  }
  console.log('Updated users with household reference');

  // Assign all transactions to this household
  const txnResult = await Transaction.updateMany(
    { household: { $exists: false } },
    { $set: { household: household._id } }
  );
  console.log(`Assigned ${txnResult.modifiedCount} transactions to household`);

  // Encrypt all transaction descriptions
  console.log('Encrypting transaction descriptions...');
  const allTxns = await Transaction.find({});
  let encrypted = 0;
  for (const txn of allTxns) {
    // Skip if already encrypted (contains colons from iv:authtag:data format)
    if (txn.description && !txn.description.includes(':')) {
      txn.description = encrypt(txn.description, encryptionKey);
      await txn.save();
      encrypted++;
    }
  }
  console.log(`Encrypted ${encrypted} transaction descriptions`);

  // Update balance records
  const balResult = await Balance.updateMany(
    { household: { $exists: false } },
    { $set: { household: household._id } }
  );
  console.log(`Assigned ${balResult.modifiedCount} balance records to household`);

  console.log('\n✅ Migration complete!');
  console.log(`Household: ${household.name}`);
  console.log(`Members: ${hamidreza.name}${farnaz ? ', ' + farnaz.name : ''}`);
  console.log(`Transactions encrypted: ${encrypted}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
