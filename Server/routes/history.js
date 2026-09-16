// routes/history.js — powers the "History" section of the app: every
// reservation a driver has ever made, whether it turned into a full
// charging session, was cancelled, or never showed up.

const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/users/:email/sessions?status=completed
router.get('/:email/sessions', (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  const status = req.query.status ? String(req.query.status) : null;

  const rows = status
    ? db.prepare(
        'SELECT * FROM charging_sessions WHERE user_email = ? AND status = ? ORDER BY reserved_at DESC'
      ).all(email, status)
    : db.prepare(
        'SELECT * FROM charging_sessions WHERE user_email = ? ORDER BY reserved_at DESC'
      ).all(email);

  const totals = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedCount,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_cost ELSE 0 END), 0) AS totalSpent,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN energy_kwh ELSE 0 END), 0) AS totalEnergyKwh
    FROM charging_sessions WHERE user_email = ?
  `).get(email);

  res.json({ ok: true, sessions: rows, totals });
});

module.exports = router;
