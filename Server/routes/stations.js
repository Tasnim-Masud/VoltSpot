// routes/stations.js — station operator accounts. Drivers never hit these
// routes directly; find.html calls the public GET list, and station
// operators use the rest after signing in on station-login.html.

const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword, generateToken } = require('../utils/password');
const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

// Fields safe to show to drivers (never the password hash/salt or token).
function toPublic(row) {
  return {
    id: row.id,
    name: row.display_name,
    nameBn: row.display_name_bn || undefined,
    sub: row.sub,
    subBn: row.sub_bn || undefined,
    type: row.type,
    connector: row.connector,
    kw: row.kw,
    price: row.price_per_kwh,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    hours: row.hours,
    hoursBn: row.hours_bn || undefined,
    phone: row.phone || undefined,
    url: row.url || undefined,
  };
}

// Fields safe to show to the station operator's own dashboard (still no
// password hash/salt or token).
function toOwner(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    displayNameBn: row.display_name_bn || '',
    sub: row.sub,
    subBn: row.sub_bn || '',
    type: row.type,
    connector: row.connector,
    kw: row.kw,
    pricePerKwh: row.price_per_kwh,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    hours: row.hours,
    hoursBn: row.hours_bn || '',
    phone: row.phone,
    url: row.url,
    updatedAt: row.updated_at,
  };
}

// GET /api/stations — public list, used by find.html instead of a
// hardcoded array, so an operator's price/availability changes show up.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM stations ORDER BY display_name').all();
  res.json({ ok: true, stations: rows.map(toPublic) });
});

// POST /api/stations/login  { username, password }
router.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Station username and password are required.' });
  }

  const station = db.prepare('SELECT * FROM stations WHERE username = ?').get(username);
  if (!station || !verifyPassword(password, station.password_hash, station.password_salt)) {
    return res.status(401).json({ error: 'Incorrect station username or password.' });
  }

  const token = generateToken();
  db.prepare('UPDATE stations SET session_token = ? WHERE id = ?').run(token, station.id);

  res.json({ ok: true, token, station: toOwner({ ...station, session_token: token }) });
});

// POST /api/stations/register
// body: { username, password, displayName, displayNameBn, sub, subBn, type,
//         connector, kw, pricePerKwh, lat, lng, hours, hoursBn, phone, url }
// Lets a new charger operator create their own account — no admin needed.
router.post('/register', (req, res) => {
  const {
    username, password, displayName, displayNameBn, sub, subBn, type, connector, kw,
    pricePerKwh, lat, lng, hours, hoursBn, phone, url,
  } = req.body || {};

  const cleanUsername = String(username || '').trim().toLowerCase();

  if (!cleanUsername || !/^[a-z0-9-]{3,40}$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username must be 3-40 characters: lowercase letters, numbers, and hyphens only.' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (!displayName || !String(displayName).trim()) {
    return res.status(400).json({ error: 'Station name is required.' });
  }
  if (pricePerKwh == null || isNaN(pricePerKwh) || Number(pricePerKwh) < 0) {
    return res.status(400).json({ error: 'A valid price per kWh is required.' });
  }
  if (kw == null || isNaN(kw) || Number(kw) <= 0) {
    return res.status(400).json({ error: 'A valid charging speed (kW) is required.' });
  }

  const existing = db.prepare('SELECT id FROM stations WHERE username = ?').get(cleanUsername);
  if (existing) {
    return res.status(409).json({ error: 'That username is already taken — pick another.' });
  }

  const { hash, salt } = hashPassword(String(password));
  const token = generateToken();
  const ts = nowIso();

  const info = db.prepare(`
    INSERT INTO stations
      (username, password_hash, password_salt, display_name, display_name_bn, sub, sub_bn,
       type, connector, kw, price_per_kwh, lat, lng, status, hours, hours_bn, phone, url,
       session_token, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'avail', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cleanUsername, hash, salt, String(displayName).trim(),
    displayNameBn && String(displayNameBn).trim() ? String(displayNameBn).trim() : null,
    sub || null, subBn && String(subBn).trim() ? String(subBn).trim() : null,
    (type === 'ac' ? 'ac' : 'dc'), connector || null, Number(kw), Number(pricePerKwh),
    lat != null && lat !== '' ? Number(lat) : null,
    lng != null && lng !== '' ? Number(lng) : null,
    hours || null, hoursBn && String(hoursBn).trim() ? String(hoursBn).trim() : null,
    phone || null, url || null, token, ts, ts
  );

  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(info.lastInsertRowid);
  res.json({ ok: true, token, station: toOwner(station) });
});

// POST /api/stations/:id/logout  { token }
router.post('/:id/logout', (req, res) => {
  const id = Number(req.params.id);
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
  if (!station) return res.status(404).json({ error: 'Station not found.' });
  if (station.session_token && station.session_token === req.body.token) {
    db.prepare('UPDATE stations SET session_token = NULL WHERE id = ?').run(id);
  }
  res.json({ ok: true });
});

// GET /api/stations/:id  { token in query } — for refreshing the dashboard
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
  if (!station) return res.status(404).json({ error: 'Station not found.' });
  const token = req.query.token;
  if (!token || token !== station.session_token) {
    return res.status(401).json({ error: 'Not signed in as this station.' });
  }
  res.json({ ok: true, station: toOwner(station) });
});

// PATCH /api/stations/:id  { token, pricePerKwh, status, kw, connector, hours,
//                            displayNameBn, subBn, hoursBn }
// The only write path a station operator has — their own row, and only
// with a valid session token from /login.
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
  if (!station) return res.status(404).json({ error: 'Station not found.' });

  const { token, pricePerKwh, status, kw, connector, hours, displayNameBn, subBn, hoursBn } = req.body || {};
  if (!token || token !== station.session_token) {
    return res.status(401).json({ error: 'Not signed in as this station.' });
  }

  if (status && !['avail', 'busy', 'maint'].includes(status)) {
    return res.status(400).json({ error: "status must be 'avail', 'busy', or 'maint'." });
  }
  if (pricePerKwh != null && (isNaN(pricePerKwh) || Number(pricePerKwh) < 0)) {
    return res.status(400).json({ error: 'pricePerKwh must be a non-negative number.' });
  }

  // Bangla fields use '' (empty string, not null) to mean "clear this
  // field" so an operator can remove a translation, while undefined means
  // "leave it alone" — COALESCE only skips actual NULLs.
  const bnOrKeep = (val, current) => (val === undefined ? current : (String(val).trim() || null));

  db.prepare(`
    UPDATE stations SET
      price_per_kwh   = COALESCE(?, price_per_kwh),
      status          = COALESCE(?, status),
      kw              = COALESCE(?, kw),
      connector       = COALESCE(?, connector),
      hours           = COALESCE(?, hours),
      display_name_bn = ?,
      sub_bn          = ?,
      hours_bn        = ?,
      updated_at      = ?
    WHERE id = ?
  `).run(
    pricePerKwh != null ? Number(pricePerKwh) : null,
    status || null,
    kw != null ? Number(kw) : null,
    connector || null,
    hours || null,
    bnOrKeep(displayNameBn, station.display_name_bn),
    bnOrKeep(subBn, station.sub_bn),
    bnOrKeep(hoursBn, station.hours_bn),
    nowIso(),
    id
  );

  const updated = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
  res.json({ ok: true, station: toOwner(updated) });
});

// GET /api/stations/:id/sessions?token=...
// A station operator's own charging history: every vehicle that's charged
// there, how much energy was delivered, and how much it cost them.
router.get('/:id/sessions', (req, res) => {
  const id = Number(req.params.id);
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
  if (!station) return res.status(404).json({ error: 'Station not found.' });

  const token = req.query.token;
  if (!token || token !== station.session_token) {
    return res.status(401).json({ error: 'Not signed in as this station.' });
  }

  const rows = db.prepare(`
    SELECT plate, status, energy_kwh, duration_sec, total_cost, price_per_kwh,
           reserved_at, started_at, completed_at, txn_id
    FROM charging_sessions
    WHERE station_id = ?
    ORDER BY reserved_at DESC
  `).all(id);

  const totals = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedCount,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_cost ELSE 0 END), 0) AS totalRevenue,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN energy_kwh ELSE 0 END), 0) AS totalEnergyKwh
    FROM charging_sessions WHERE station_id = ?
  `).get(id);

  res.json({ ok: true, sessions: rows, totals });
});

module.exports = router;
