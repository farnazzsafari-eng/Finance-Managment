const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a string with a hex key
 * Returns: iv:authTag:encrypted (all hex)
 */
function encrypt(text, hexKey) {
  if (!text || !hexKey) return text;
  const key = Buffer.from(hexKey, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 */
function decrypt(encryptedText, hexKey) {
  if (!encryptedText || !hexKey) return encryptedText;
  // If it doesn't look encrypted (no colons), return as-is
  if (!encryptedText.includes(':')) return encryptedText;
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const key = Buffer.from(hexKey, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, return original (might be unencrypted legacy data)
    return encryptedText;
  }
}

/**
 * Encrypt sensitive fields in a transaction object
 */
function encryptTransaction(txn, hexKey) {
  if (!hexKey) return txn;
  return {
    ...txn,
    description: encrypt(txn.description, hexKey),
  };
}

/**
 * Decrypt sensitive fields in a transaction object
 */
function decryptTransaction(txn, hexKey) {
  if (!hexKey) return txn;
  const obj = txn.toObject ? txn.toObject() : { ...txn };
  obj.description = decrypt(obj.description, hexKey);
  return obj;
}

module.exports = { encrypt, decrypt, encryptTransaction, decryptTransaction };
