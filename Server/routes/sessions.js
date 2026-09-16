// routes/sessions.js — the reserve → navigate → charge → pay lifecycle,
// persisted as charging_sessions rows. This table doubles as charging
// history: every reservation, whether completed or abandoned, stays here.

const express = require('express');
const db = require('../db');
const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

function genTxnId() {
  return 'TXN-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

// POST /api/sessions/reserve
// body: { email, plate, station, stationId, connector, kw, price, lat, lng, arrivalTime, heldUntil, holdFee }
router.post('/reserve', (req, res) => {
  const {
    email, plate, station, stationId, connector, kw, price,
    lat, lng, arrivalTime, heldUntil, holdFee,
  } = req.body || {};

  if (!email || !plate || !station || price == null) {
    return res.status(400).json({ error: 'email, plate, station, and price are required.' });
  }

  const ts = nowIso();
  const info = db.prepare(`
    INSERT INTO charging_sessions
      (user_email, plate, station_id, station_name, connector, kw, price_per_kwh, lat, lng,
       status, arrival_time, held_until, hold_fee, reserved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'reserved', ?, ?, ?, ?)
  `).run(
    String(email).toLowerCase(), String(plate).toUpperCase(),
    stationId != null ? Number(stationId) : null, station,
    connector || null, Number(kw) || null, Number(price),
    lat != null ? Number(lat) : null, lng != null ? Number(lng) : null,
    arrivalTime || null, heldUntil || null, Number(holdFee) || 0, ts
  );

  const session = db.prepare('SELECT * FROM charging_sessions WHERE id = ?').get(info.lastInsertRowid);
  res.json({ ok: true, session });
});

// POST /api/sessions/:id/start  — driver tapped "I've arrived"
router.post('/:id/start', (req, res) => {
  const id = Number(req.params.id);
  const session = db.prepare('SELECT * FROM charging_sessions WHERE id = ?').get(id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const ts = nowIso();
  db.prepare("UPDATE charging_sessions SET status = 'active', started_at = ? WHERE id = ?").run(ts, id);
  res.json({ ok: true, session: db.prepare('SELECT * FROM charging_sessions WHERE id = ?').get(id) });
});

// GET /api/sessions/:id
router.get('/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM charging_sessions WHERE id = ?').get(Number(req.params.id));
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  res.json({ ok: true, session });
});

// POST /api/sessions/:id/complete  { energyKwh, durationSec }
// Computes the final cost server-side (never trust the client for billing)
// and stamps a transaction id — this becomes the permanent receipt record.
router.post('/:id/complete', (req, res) => {
  const id = Number(req.params.id);
  const session = db.prepare('SELECT * FROM charging_sessions WHERE id = ?').get(id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const energyKwh = Math.max(0, Number(req.body.energyKwh) || 0);
  const durationSec = Math.max(0, Math.round(Number(req.body.durationSec) || 0));
  const totalCost = Math.round(energyKwh * session.price_per_kwh * 100) / 100;
  const txnId = genTxnId();
  const ts = nowIso();

  db.prepare(`
    UPDATE charging_sessions
    SET status = 'completed', completed_at = ?, energy_kwh = ?, duration_sec = ?,
        total_cost = ?, txn_id = ?
    WHERE id = ?
  `).run(ts, energyKwh, durationSec, totalCost, txnId, id);

  res.json({ ok: true, session: db.prepare('SELECT * FROM charging_sessions WHERE id = ?').get(id) });
});

// POST /api/sessions/:id/cancel
router.post('/:id/cancel', (req, res) => {
  const id = Number(req.params.id);
  const session = db.prepare('SELECT * FROM charging_sessions WHERE id = ?').get(id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  db.prepare("UPDATE charging_sessions SET status = 'cancelled' WHERE id = ?").run(id);
  res.json({ ok: true });
});

module.exports = router;
