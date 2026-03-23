#!/usr/bin/env node
/**
 * Import all bank CSV files + store order data into MongoDB
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { parseCSV, categorize } = require('../services/csvParser');

const BANK_DIR = path.join(__dirname, '..', '..', 'Bank');

// Map filenames to bank/cardType
const FILE_MAP = {
  'Hamidreza': [
    { file: 'cibc Credit.csv', bank: 'CIBC', cardType: 'credit' },
    { file: 'cibc Debit.csv', bank: 'CIBC', cardType: 'debit' },
    { file: 'cibc USD.csv', bank: 'CIBC', cardType: 'debit' },
    { file: 'RBC Credit.csv', bank: 'RBC', cardType: 'credit' },
    { file: 'RBC debit.csv', bank: 'RBC', cardType: 'debit' },
    { file: 'Scotia Debit.csv', bank: 'Scotia', cardType: 'debit' },
    { file: 'TD Debit.csv', bank: 'TD', cardType: 'debit' },
    { file: 'TD Saving.csv', bank: 'TD', cardType: 'debit' },
    { file: 'welthsimple.csv', bank: 'Wealthsimple', cardType: 'debit' },
  ],
  'Farnaz': [
    { file: 'cibc Credit.csv', bank: 'CIBC', cardType: 'credit' },
    { file: 'cibc debit.csv', bank: 'CIBC', cardType: 'debit' },
    { file: 'TD Credit2.csv', bank: 'TD', cardType: 'credit' },
    { file: 'TD Credit 3.csv', bank: 'TD', cardType: 'credit' },
    { file: 'TD Credit 4.csv', bank: 'TD', cardType: 'credit' },
    { file: 'TD Credit 5.csv', bank: 'TD', cardType: 'credit' },
    { file: 'TD Credit 6.csv', bank: 'TD', cardType: 'credit' },
    { file: 'TD Credit 7.csv', bank: 'TD', cardType: 'credit' },
    { file: 'TD Debit.csv', bank: 'TD', cardType: 'debit' },
    { file: 'TD Saving.csv', bank: 'TD', cardType: 'debit' },
  ],
};

// Store order data collected from browser
const STORE_ORDERS = {
  'Hamidreza': [
    // Amazon 2026
    { date: '2026-03-07', description: 'Luxe Bidet NEO 320 Plus', amount: 111.44, store: 'Amazon', status: 'Delivered' },
    { date: '2026-02-26', description: 'Microsoft Surface Laptop 3', amount: 727.50, store: 'Amazon', status: 'Delivered' },
    { date: '2026-02-25', description: 'FEZIBO Standing Desk', amount: 269.99, store: 'Amazon', status: 'Delivered' },
    { date: '2026-02-24', description: 'Computer Desk Chair', amount: 249.99, store: 'Amazon', status: 'Delivered' },
    { date: '2026-01-26', description: 'Baby Playpen', amount: 135.60, store: 'Amazon', status: 'Delivered' },
    { date: '2026-01-22', description: 'Cat Carrier + Pet supplies', amount: 72.00, store: 'Amazon', status: 'Delivered' },
    // Amazon 2025
    { date: '2025-10-20', description: 'Skull Mask + Monk Costume (Halloween)', amount: 58.22, store: 'Amazon', status: 'Return complete' },
    { date: '2025-10-05', description: 'iPhone 13 Screen Protector + Case + Wallet', amount: 42.84, store: 'Amazon', status: 'Return complete' },
    { date: '2025-08-17', description: 'VEVOR Rattan Furniture', amount: 279.99, store: 'Amazon', status: 'Delivered' },
    { date: '2025-07-30', description: 'Amazon purchases', amount: 50.00, store: 'Amazon', status: 'Delivered' },
    { date: '2025-07-20', description: 'Nespresso Vertuo Coffee Machine', amount: 215.00, store: 'Amazon', status: 'Delivered' },
    { date: '2025-07-13', description: 'Kitchen / Home items', amount: 74.38, store: 'Amazon', status: 'Delivered' },
    { date: '2025-06-14', description: 'Philips OneBlade + Accessories', amount: 60.00, store: 'Amazon', status: 'Delivered' },
    { date: '2025-06-08', description: 'Amazon order', amount: 38.24, store: 'Amazon', status: 'Delivered' },
    { date: '2025-05-19', description: 'Cat Tree Small Tower', amount: 66.63, store: 'Amazon', status: 'Delivered' },
    { date: '2025-05-01', description: 'iPhone Charger USB-C to Lightning', amount: 11.19, store: 'Amazon', status: 'Delivered' },
    { date: '2025-04-30', description: 'ORIENT Classic Sun & Moon Watch', amount: 430.66, store: 'Amazon', status: 'Delivered' },
    { date: '2025-04-29', description: 'New Balance Women Shoes', amount: 83.98, store: 'Amazon', status: 'Return complete' },
    { date: '2025-04-10', description: 'Amazon order', amount: 35.00, store: 'Amazon', status: 'Delivered' },
    { date: '2025-03-23', description: "De'Longhi Oil-Filled Radiator Heater", amount: 119.78, store: 'Amazon', status: 'Return complete' },
    { date: '2025-03-22', description: 'Travel Umbrella 2 Pack', amount: 33.59, store: 'Amazon', status: 'Delivered' },
    { date: '2025-03-16', description: 'Bidet Toilet Seat Bumper', amount: 11.19, store: 'Amazon', status: 'Delivered' },
    { date: '2025-03-14', description: 'USX MOUNT Fixed TV Wall Mount', amount: 24.17, store: 'Amazon', status: 'Delivered' },
    { date: '2025-03-01', description: 'Amazon early 2025 orders', amount: 45.00, store: 'Amazon', status: 'Delivered' },
    // Best Buy
    { date: '2025-07-15', description: "Smeg 50's Style Retro Long Slot Toaster - 4-Slice - Cream", amount: 292.43, store: 'Best Buy', status: 'Delivered' },
    { date: '2025-03-17', description: 'Shark Rocket Pro DLX Corded Stick Vacuum - Aha Blue', amount: 179.76, store: 'Best Buy', status: 'Delivered' },
    // Canadian Tire
    { date: '2025-03-14', description: 'Canadian Tire order #0000115529267', amount: 557.17, store: 'Canadian Tire', status: 'Completed' },
    // Temu
    { date: '2026-02-23', description: 'Temu order - 12 items (home/car accessories)', amount: 112.26, store: 'Temu', status: 'Delivered' },
    { date: '2026-01-15', description: 'Temu order', amount: 65.00, store: 'Temu', status: 'Delivered' },
    // Costco Online
    { date: '2025-05-20', description: 'Costco Online - Terra Delyssa Olive Oil, Kirkland Basmati Rice', amount: 179.31, store: 'Costco', status: 'Delivered' },
    // Costco Warehouse
    { date: '2026-03-16', description: 'Costco Warehouse RICHMOND BC', amount: 24.99, store: 'Costco' },
    { date: '2026-03-10', description: 'Costco Warehouse RICHMOND BC', amount: 133.94, store: 'Costco' },
    { date: '2026-02-26', description: 'Costco Warehouse VANCOUVER BC', amount: 1.64, store: 'Costco' },
    { date: '2026-01-14', description: 'Costco Warehouse RICHMOND BC', amount: 83.62, store: 'Costco' },
    { date: '2026-01-08', description: 'Costco Warehouse RICHMOND BC', amount: 35.36, store: 'Costco' },
    { date: '2025-12-28', description: 'Costco Warehouse VANCOUVER BC', amount: 315.92, store: 'Costco' },
    { date: '2025-12-16', description: 'Costco Warehouse RICHMOND BC', amount: 261.56, store: 'Costco' },
    { date: '2025-12-16', description: 'Costco Warehouse RICHMOND BC', amount: 98.80, store: 'Costco' },
    { date: '2025-12-02', description: 'Costco Warehouse VANCOUVER BC', amount: 53.56, store: 'Costco' },
    { date: '2025-11-01', description: 'Costco Warehouse RICHMOND BC', amount: 14.98, store: 'Costco' },
    { date: '2025-10-14', description: 'Costco Warehouse RICHMOND BC', amount: 72.00, store: 'Costco' },
    { date: '2025-10-03', description: 'Costco Warehouse RICHMOND BC', amount: 153.70, store: 'Costco' },
    { date: '2025-08-20', description: 'Costco Warehouse RICHMOND BC', amount: 23.99, store: 'Costco' },
    { date: '2025-08-14', description: 'Costco Warehouse RICHMOND BC', amount: 11.99, store: 'Costco' },
    { date: '2025-08-02', description: 'Costco Warehouse RICHMOND BC', amount: 179.19, store: 'Costco' },
    { date: '2025-08-02', description: 'Costco Warehouse RICHMOND BC', amount: 217.96, store: 'Costco' },
    { date: '2025-07-21', description: 'Costco Warehouse WILLINGDON', amount: 59.93, store: 'Costco' },
    { date: '2025-07-08', description: 'Costco Warehouse RICHMOND BC', amount: 19.99, store: 'Costco' },
    { date: '2025-06-29', description: 'Costco Warehouse WILLINGDON', amount: 79.77, store: 'Costco' },
    { date: '2025-06-11', description: 'Costco Warehouse WILLINGDON', amount: 20.63, store: 'Costco' },
    { date: '2025-06-06', description: 'Costco Warehouse WILLINGDON', amount: 23.99, store: 'Costco' },
    { date: '2025-06-04', description: 'Costco Warehouse RICHMOND BC', amount: 56.85, store: 'Costco' },
    { date: '2025-05-23', description: 'Costco Gas Station Port Coquitlam', amount: 50.01, store: 'Costco' },
    { date: '2025-05-17', description: 'Costco Warehouse RICHMOND BC', amount: 45.45, store: 'Costco' },
    { date: '2025-04-04', description: 'Costco Warehouse RICHMOND BC', amount: 274.42, store: 'Costco' },
    { date: '2025-03-30', description: 'Costco Warehouse WILLINGDON', amount: 136.50, store: 'Costco' },
  ],
  'Farnaz': [
    // Temu
    { date: '2026-03-03', description: 'Temu - Storage containers (return pending)', amount: 37.41, store: 'Temu', status: 'Delivered' },
    { date: '2026-03-03', description: 'Temu - Home organizer items', amount: 34.25, store: 'Temu', status: 'Delivered' },
    { date: '2026-02-27', description: 'Temu - Small accessories', amount: 4.84, store: 'Temu', status: 'Delivered' },
    { date: '2026-02-27', description: 'Temu - Large order (cat tree, home items)', amount: 354.40, store: 'Temu', status: 'Delivered' },
    { date: '2026-02-27', description: 'Temu - Kitchen items', amount: 33.55, store: 'Temu', status: 'Delivered' },
    { date: '2026-02-27', description: 'Temu - Health & beauty', amount: 10.24, store: 'Temu', status: 'Delivered' },
    { date: '2026-02-27', description: 'Temu - Pet supplies', amount: 29.77, store: 'Temu', status: 'Refunded' },
    { date: '2025-10-30', description: 'Temu - Fall order', amount: 85.00, store: 'Temu', status: 'Delivered' },
  ],
};

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/finance-app';
  console.log(`Connecting to MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);

  // Get users
  const hamidreza = await User.findOne({ name: 'Hamidreza' });
  const farnaz = await User.findOne({ name: 'Farnaz' });

  if (!hamidreza || !farnaz) {
    console.error('Users not found! Start the server first to create seed data.');
    process.exit(1);
  }

  console.log(`Found users: ${hamidreza.name} (${hamidreza._id}), ${farnaz.name} (${farnaz._id})`);

  // Clear existing imported transactions
  const deleted = await Transaction.deleteMany({ source: { $in: ['csv-import', 'browser-import'] } });
  console.log(`Cleared ${deleted.deletedCount} previously imported transactions\n`);

  let totalImported = 0;

  // Import bank CSV files
  for (const [userName, files] of Object.entries(FILE_MAP)) {
    const user = userName === 'Hamidreza' ? hamidreza : farnaz;
    const dateFolder = '22 March 2026';
    const basePath = path.join(BANK_DIR, userName, dateFolder);

    console.log(`\n=== Importing ${userName}'s bank data ===`);

    for (const { file, bank, cardType } of files) {
      const filePath = path.join(basePath, file);

      if (!fs.existsSync(filePath)) {
        console.log(`  ⚠ File not found: ${file}`);
        continue;
      }

      try {
        const csvContent = fs.readFileSync(filePath, 'utf-8');
        const transactions = parseCSV(csvContent, {
          ownerId: user._id,
          bank,
          cardType,
        });

        if (transactions.length > 0) {
          await Transaction.insertMany(transactions);
          console.log(`  ✓ ${file}: ${transactions.length} transactions (${bank} ${cardType})`);
          totalImported += transactions.length;
        } else {
          console.log(`  - ${file}: no valid transactions`);
        }
      } catch (err) {
        console.error(`  ✗ ${file}: ${err.message}`);
      }
    }
  }

  // Import store orders
  console.log('\n=== Importing store orders ===');
  for (const [userName, orders] of Object.entries(STORE_ORDERS)) {
    const user = userName === 'Hamidreza' ? hamidreza : farnaz;

    const transactions = orders.map((o) => ({
      owner: user._id,
      date: new Date(o.date),
      description: o.description,
      amount: o.amount,
      type: 'expense',
      category: categorize(o.description),
      store: o.store,
      source: 'browser-import',
      bank: '',
      cardType: 'debit',
    }));

    await Transaction.insertMany(transactions);
    console.log(`  ✓ ${userName}: ${transactions.length} store orders`);
    totalImported += transactions.length;
  }

  console.log(`\n=============================`);
  console.log(`Total imported: ${totalImported} transactions`);
  console.log(`=============================\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
