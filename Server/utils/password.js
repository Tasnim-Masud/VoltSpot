// utils/password.js — hashes and verifies station passwords using Node's
// built-in crypto module (scrypt). No extra dependency, no native
// compilation — same philosophy as switching db.js off better-sqlite3.

const crypto = require('crypto');

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(plainPassword, hash, salt) {
  const attempt = crypto.scryptSync(plainPassword, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (attempt.length !== stored.length) return false;
  return crypto.timingSafeEqual(attempt, stored);
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { hashPassword, verifyPassword, generateToken };
