const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Household = require('../models/Household');

module.exports = async function auth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userName = decoded.name;
    req.householdId = decoded.householdId;
    req.userRole = decoded.role || 'member';

    // Load encryption key for this household (cached in token payload)
    if (decoded.householdId) {
      // Cache household data on request for routes that need it
      req.getHousehold = async () => {
        if (req._household) return req._household;
        req._household = await Household.findById(decoded.householdId).lean();
        return req._household;
      };
      req.getEncryptionKey = async () => {
        const hh = await req.getHousehold();
        return hh?.encryptionKey || null;
      };
    } else {
      req.getHousehold = async () => null;
      req.getEncryptionKey = async () => null;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to block write operations for advisors
module.exports.requireWriteAccess = function (req, res, next) {
  if (req.userRole === 'advisor') {
    return res.status(403).json({ error: 'Advisors have read-only access' });
  }
  next();
};
