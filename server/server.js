require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();

// Security
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5001'];

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? allowedOrigins
    : true, // allow all in development
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/balances', require('./routes/balances'));
app.use('/api/import', require('./routes/import'));
app.use('/api/subscription', require('./routes/subscription'));

// Serve static files in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// Seed default accounts on first run (dev only)
async function seedData() {
  if (process.env.NODE_ENV === 'production') return;

  const User = require('./models/User');
  const Account = require('./models/Account');

  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) return;

  console.log('Seeding initial data...');
  const hamidreza = await User.create({ name: 'Hamidreza', password: 'change-me' });
  const farnaz = await User.create({ name: 'Farnaz', password: 'change-me' });

  const hamidrezaBanks = ['Wealthsimple', 'Scotia', 'TD', 'CIBC', 'RBC'];
  const farnazBanks = ['TD', 'CIBC'];

  for (const bank of hamidrezaBanks) {
    await Account.create({ owner: hamidreza._id, bank, type: 'debit' });
    await Account.create({ owner: hamidreza._id, bank, type: 'credit' });
  }
  for (const bank of farnazBanks) {
    await Account.create({ owner: farnaz._id, bank, type: 'debit' });
    await Account.create({ owner: farnaz._id, bank, type: 'credit' });
  }
  console.log('Seeding complete.');
}

const PORT = process.env.PORT || 5001;

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedData();

    // Start email reminder scheduler
    const { startScheduler } = require('./services/scheduler');
    startScheduler();

    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error('MongoDB connection error:', err));
