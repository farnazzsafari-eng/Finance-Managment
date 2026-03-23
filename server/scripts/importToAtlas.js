const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Household = require('../models/Household');
const Transaction = require('../models/Transaction');
const { parseCSV } = require('../services/csvParser');
const { encrypt } = require('../services/encryption');

const ATLAS_URI = 'mongodb+srv://farnazzsafari_db_user:kYkkgjARzZVWkh7V@cluster0.5zmsdw2.mongodb.net/finance-management';
const BANK_DIR = path.join(__dirname, '..', '..', 'Bank');

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

async function main() {
  await mongoose.connect(ATLAS_URI);
  console.log('Connected to Atlas');

  const household = await Household.findOne();
  const encKey = household?.encryptionKey;
  console.log('Household:', household?.name, '| Encryption:', encKey ? 'YES' : 'NO');

  const hamidreza = await User.findOne({ email: 'hamid.zahedi90@gmail.com' });
  const farnaz = await User.findOne({ email: 'farnazz.safari@gmail.com' });

  // Skip already imported (CIBC credit already done)
  const existingCount = await Transaction.countDocuments();
  console.log('Existing transactions:', existingCount);

  let total = 0;

  for (const [userName, files] of Object.entries(FILE_MAP)) {
    const user = userName === 'Hamidreza' ? hamidreza : farnaz;
    const basePath = path.join(BANK_DIR, userName, '22 March 2026');
    console.log(`\n=== ${userName} ===`);

    for (const { file, bank, cardType } of files) {
      const filePath = path.join(basePath, file);
      if (!fs.existsSync(filePath)) { console.log(`  skip: ${file}`); continue; }

      const csv = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseCSV(csv, { ownerId: user._id, bank, cardType });

      // Add household + encrypt
      const txns = parsed.map(t => ({
        ...t,
        household: household._id,
        description: encKey ? encrypt(t.description, encKey) : t.description,
      }));

      // Dedupe
      const existing = await Transaction.find({
        owner: user._id, bank, cardType, source: 'csv-import'
      }).select('date description amount').lean();

      const existingSet = new Set();
      existing.forEach(e => {
        const desc = encKey ? require('../services/encryption').decrypt(e.description, encKey) : e.description;
        existingSet.add(`${e.date.toISOString().substring(0,10)}|${desc}|${e.amount}`);
      });

      const origParsed = parseCSV(csv, { ownerId: user._id, bank, cardType });
      const newTxns = txns.filter((t, i) => {
        const orig = origParsed[i];
        const key = `${orig.date.toISOString().substring(0,10)}|${orig.description}|${orig.amount}`;
        return !existingSet.has(key);
      });

      if (newTxns.length > 0) {
        await Transaction.insertMany(newTxns);
      }
      console.log(`  ${file}: ${newTxns.length} imported, ${txns.length - newTxns.length} skipped`);
      total += newTxns.length;
    }
  }

  console.log(`\nTotal imported: ${total}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
