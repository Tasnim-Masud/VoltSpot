// routes/auth.js — remembers every driver who signs in, and lets a driver
// who forgot which email they used look it up by their car's plate number.

const express = require('express');
const db = require('../db');
const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

// Masks an email's local part, keeping the first 2 and last 2 characters
// visible (e.g. "jo******on@example.com") so a driver can recognize their
// own address without the full thing being exposed to anyone who happens
// to know their plate number.
function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return email;

  const len = local.length;
  if (len <= 2) {
    return `${'*'.repeat(len)}@${domain}`;
  }
  if (len <= 4) {
    // Too short to safely show 2 + 2 without overlapping — show just the
    // first and last character instead.
    return `${local[0]}${'*'.repeat(len - 2)}${local[len - 1]}@${domain}`;
  }

  const first2 = local.slice(0, 2);
  const last2 = local.slice(-2);
  const middleStars = '*'.repeat(len - 4);
  return `${first2}${middleStars}${last2}@${domain}`;
}

// POST /api/auth/login  { email, plate }
// Creates the driver on first sign-in, or updates last_login on every
// return visit. This is the "remember every time a user enters" piece.
router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const plate = String(req.body.plate || '').trim().toUpperCase();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (!plate || plate.replace(/\s/g, '').length < 4) {
    return res.status(400).json({ error: 'A valid plate number is required.' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ts = nowIso();

  // A plate can only ever belong to ONE account. If this plate is already
  // on file under a different email, refuse the login instead of letting
  // a second account silently take it over.
  const plateOwner = db.prepare('SELECT user_email FROM plates WHERE plate = ?').get(plate);
  if (plateOwner && plateOwner.user_email !== email) {
    return res.status(409).json({
      error: `This plate is already registered to another account (${maskEmail(plateOwner.user_email)}). Sign in with that email instead, or use "Forgot which email you used?".`,
    });
  }

  if (existing) {
    db.prepare(
      'UPDATE users SET plate = ?, last_login = ?, login_count = login_count + 1 WHERE email = ?'
    ).run(plate, ts, email);
  } else {
    db.prepare(
      'INSERT INTO users (email, plate, created_at, last_login, login_count) VALUES (?, ?, ?, ?, 1)'
    ).run(email, plate, ts, ts);
  }

  // Register this plate to this email (first time seen), or just bump its
  // last_seen timestamp if it's already theirs.
  if (plateOwner) {
    db.prepare('UPDATE plates SET last_seen = ? WHERE plate = ?').run(ts, plate);
  } else {
    db.prepare(
      'INSERT INTO plates (plate, user_email, first_seen, last_seen) VALUES (?, ?, ?, ?)'
    ).run(plate, email, ts, ts);
  }

  const user = db.prepare('SELECT email, plate, created_at, last_login, login_count FROM users WHERE email = ?').get(email);
  res.json({ ok: true, user, returning: Boolean(existing) });
});

// GET /api/auth/lookup-email?plate=AB1234CD
// "Forgot which email you used?" — look it up by car plate number.
router.get('/lookup-email', (req, res) => {
  const plate = String(req.query.plate || '').trim().toUpperCase();
  if (!plate || plate.length < 4) {
    return res.status(400).json({ error: 'Enter at least 4 characters of the plate number.' });
  }

  // Exact match first, then a "contains" fallback in case they only
  // remember part of the plate.
  let rows = db
    .prepare('SELECT DISTINCT user_email, plate FROM plates WHERE plate = ? ORDER BY last_seen DESC')
    .all(plate);

  if (rows.length === 0) {
    rows = db
      .prepare('SELECT DISTINCT user_email, plate FROM plates WHERE plate LIKE ? ORDER BY last_seen DESC LIMIT 5')
      .all(`%${plate}%`);
  }

  if (rows.length === 0) {
    return res.status(404).json({ error: 'No account found for that plate number.' });
  }

  const matches = rows.map((r) => ({
    email: r.user_email,
    maskedEmail: maskEmail(r.user_email),
    plate: r.plate,
  }));

  res.json({ ok: true, matches });
});

module.exports = router;
