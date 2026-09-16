// db.js — SQLite database setup for VoltSpot.
//
// Uses Node's BUILT-IN SQLite module (node:sqlite) instead of a third-party
// native package. This needs zero compilation — no Python, no build tools,
// no native binaries to download. Requires Node.js 22.5+ (Node 24+ recommended).
// The database file (voltspot.db) is created automatically on first run.

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'voltspot.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  -- One row per driver. Email is the login key; plate is stored so a
  -- driver who forgets their email can look it up by plate number.
  CREATE TABLE IF NOT EXISTS users (
    email       TEXT PRIMARY KEY,
    plate       TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    last_login  TEXT NOT NULL,
    login_count INTEGER NOT NULL DEFAULT 1
  );

  -- One row per plate. The plate is the PRIMARY KEY, so a plate can only
  -- ever be linked to ONE email — the backend refuses to let a second
  -- account claim a plate that's already registered (see routes/auth.js).
  CREATE TABLE IF NOT EXISTS plates (
    plate      TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    first_seen TEXT NOT NULL,
    last_seen  TEXT NOT NULL,
    FOREIGN KEY (user_email) REFERENCES users(email)
  );

  -- Full lifecycle of a charging visit: reserved -> active -> completed
  -- (or cancelled). This IS the charging history table — for drivers AND,
  -- via station_id, for station operators too.
  CREATE TABLE IF NOT EXISTS charging_sessions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email     TEXT NOT NULL,
    plate          TEXT NOT NULL,
    station_id     INTEGER,          -- links to stations.id when known (real accounts)
    station_name   TEXT NOT NULL,    -- always set, used as a display fallback
    connector      TEXT,
    kw             REAL,
    price_per_kwh  REAL NOT NULL,
    lat            REAL,
    lng            REAL,
    status         TEXT NOT NULL DEFAULT 'reserved', -- reserved | active | completed | cancelled
    arrival_time   TEXT,
    held_until     TEXT,
    hold_fee       REAL DEFAULT 0,
    reserved_at    TEXT NOT NULL,
    started_at     TEXT,
    completed_at   TEXT,
    energy_kwh     REAL DEFAULT 0,
    duration_sec   INTEGER DEFAULT 0,
    total_cost     REAL DEFAULT 0,
    txn_id         TEXT,
    FOREIGN KEY (user_email) REFERENCES users(email),
    FOREIGN KEY (station_id) REFERENCES stations(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON charging_sessions(user_email);
  CREATE INDEX IF NOT EXISTS idx_sessions_station ON charging_sessions(station_id);

  -- Station operator accounts. "username" is the unique login handle
  -- (some real-world stations share the same display name, so the login
  -- handle is a separate, always-unique slug). Operators sign in here to
  -- change their own price, availability, and specs — nothing else.
  --
  -- The _bn columns are optional operator-provided Bangla translations of
  -- their own name/address/hours (free text can't be auto-translated).
  -- When the app is set to Bangla, the frontend prefers these and falls
  -- back to the English fields if an operator hasn't filled them in.
  CREATE TABLE IF NOT EXISTS stations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    password_salt   TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    display_name_bn TEXT,
    sub             TEXT,
    sub_bn          TEXT,
    type            TEXT NOT NULL DEFAULT 'dc', -- ac | dc
    connector       TEXT,
    kw              REAL,
    price_per_kwh   REAL NOT NULL,
    lat             REAL,
    lng             REAL,
    status          TEXT NOT NULL DEFAULT 'avail', -- avail | busy | maint
    hours           TEXT,
    hours_bn        TEXT,
    phone           TEXT,
    url             TEXT,
    session_token   TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );
`);

// Safe migration: if this database was created before the _bn columns
// existed, add them now. CREATE TABLE IF NOT EXISTS above only applies to
// brand-new databases, so existing ones need an explicit ALTER TABLE.
const stationColumns = db.prepare("PRAGMA table_info(stations)").all().map(c => c.name);
for (const [col, type] of [
  ['display_name_bn', 'TEXT'],
  ['sub_bn', 'TEXT'],
  ['hours_bn', 'TEXT'],
]) {
  if (!stationColumns.includes(col)) {
    db.exec(`ALTER TABLE stations ADD COLUMN ${col} ${type}`);
  }
}

module.exports = db;
