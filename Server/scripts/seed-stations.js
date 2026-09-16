// scripts/seed-stations.js — creates a login account for each of the
// stations that used to be hardcoded in find.html, and prints (and saves)
// the generated username/password for every one so the operator can sign
// in at station-login.html and manage their own price/availability.
//
// Run with: node scripts/seed-stations.js
// Safe to re-run — it skips any username that already exists.

const path = require('path');
const fs = require('fs');
const db = require('../db');
const { hashPassword } = require('../utils/password');

function nowIso() {
  return new Date().toISOString();
}

// Same 7 real chargers that used to be hardcoded in public/find.html.
// "username" is a unique login handle — several of these share the same
// public display name, so the handle disambiguates by location.
//
// Passwords are fixed (not randomly generated) so that running this script
// always produces the same, documented credentials — change them from the
// station dashboard's account settings, or edit the values below, once
// you're past local testing.
const STATIONS = [
  {
    username: 'evcs-dhaka-hwy', password: 'Dhaka-Hwy-2026!',
    display_name: 'Electric Vehicle Charging Station',
    display_name_bn: 'ইলেকট্রিক ভেহিকল চার্জিং স্টেশন',
    sub: '9M7Q+2PQ, Dhaka - Rajshahi Hwy',
    sub_bn: '9M7Q+2PQ, ঢাকা - রাজশাহী মহাসড়ক',
    type: 'dc', connector: 'Unknown plug', kw: 440, price_per_kwh: 0.40,
    lat: 24.4020, lng: 88.7510, status: 'avail', hours: 'Open 24 hours',
    hours_bn: '২৪ ঘণ্টা খোলা',
  },
  {
    username: 'sunnys-rikshaw-garage', password: 'Sunny-Garage-2026!',
    display_name: "Sunny's Rikshaw Garage",
    display_name_bn: 'সানির রিকশা গ্যারেজ',
    sub: 'Hosenigong Road, Rajshahi',
    sub_bn: 'হোসেনীগঞ্জ রোড, রাজশাহী',
    type: 'ac', connector: 'Unknown plug', kw: 22, price_per_kwh: 0.30,
    lat: 24.3745, lng: 88.6042, status: 'avail', hours: 'Open · closes 12 AM',
    hours_bn: 'খোলা আছে · রাত ১২টায় বন্ধ হবে',
    phone: '01717-136810',
  },
  {
    username: 'evcs-n6', password: 'Station-N6-2026!',
    display_name: 'Electric Vehicle Charging Station',
    display_name_bn: 'ইলেকট্রিক ভেহিকল চার্জিং স্টেশন',
    sub: '9HF6+J6W, N6',
    sub_bn: '9HF6+J6W, এন৬',
    type: 'dc', connector: 'Unknown plug', kw: 60, price_per_kwh: 0.38,
    lat: 24.2540, lng: 88.9820, status: 'avail', hours: 'Hours not listed',
  },
  {
    username: 'adani-charging-station', password: 'Adani-Charge-2026!',
    display_name: 'Adani Charging Station',
    display_name_bn: 'আদানি চার্জিং স্টেশন',
    sub: 'Bokhara, Sagardighi, West Bengal',
    sub_bn: 'বোখারা, সাগরদিঘী, পশ্চিমবঙ্গ',
    type: 'dc', connector: 'CCS', kw: 60, price_per_kwh: 0.45,
    lat: 24.2310, lng: 88.0790, status: 'avail', hours: 'Open 24 hours',
    hours_bn: '২৪ ঘণ্টা খোলা',
    url: 'https://www.adanielectricity.com/',
  },
  {
    username: 'bpcl-charging-station', password: 'BPCL-Charge-2026!',
    display_name: 'BPCL Charging Station',
    display_name_bn: 'বিপিসিএল চার্জিং স্টেশন',
    sub: 'Morgram, West Bengal',
    sub_bn: 'মোরগ্রাম, পশ্চিমবঙ্গ',
    type: 'dc', connector: 'CCS', kw: 30, price_per_kwh: 0.36,
    lat: 24.2020, lng: 88.1030, status: 'busy', hours: 'Open 24 hours',
    hours_bn: '২৪ ঘণ্টা খোলা',
    phone: '+91 1800 22 4344',
  },
  {
    username: 'tanisa-computer-xerox', password: 'Tanisa-Xerox-2026!',
    display_name: 'Tanisa Computer & Xerox',
    display_name_bn: 'তানিসা কম্পিউটার ও জেরক্স',
    sub: 'Jhaubaria, Raninagar, Murshidabad',
    sub_bn: 'ঝাউবাড়িয়া, রানীনগর, মুর্শিদাবাদ',
    type: 'ac', connector: 'Unknown plug', kw: 11, price_per_kwh: 0.26,
    lat: 24.3040, lng: 88.1980, status: 'avail', hours: 'Hours not listed',
  },
  {
    username: 'evcs-borobongram', password: 'Borobongram-2026!',
    display_name: 'Electric Vehicle Charging Station',
    display_name_bn: 'ইলেকট্রিক ভেহিকল চার্জিং স্টেশন',
    sub: 'CJ58+455, Borobongram',
    sub_bn: 'CJ58+455, বড়বনগ্রাম',
    type: 'dc', connector: 'Unknown plug', kw: 50, price_per_kwh: 0.35,
    lat: 24.3510, lng: 88.6510, status: 'maint', hours: 'Hours not listed',
  },
];

const results = [];

for (const s of STATIONS) {
  const existing = db.prepare('SELECT id FROM stations WHERE username = ?').get(s.username);
  if (existing) {
    results.push({ username: s.username, displayName: s.display_name, password: '(already exists — unchanged)' });
    continue;
  }

  const { hash, salt } = hashPassword(s.password);
  const ts = nowIso();

  db.prepare(`
    INSERT INTO stations
      (username, password_hash, password_salt, display_name, display_name_bn, sub, sub_bn,
       type, connector, kw, price_per_kwh, lat, lng, status, hours, hours_bn, phone, url,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    s.username, hash, salt, s.display_name, s.display_name_bn || null, s.sub, s.sub_bn || null,
    s.type, s.connector, s.kw, s.price_per_kwh, s.lat, s.lng, s.status, s.hours,
    s.hours_bn || null, s.phone || null, s.url || null, ts, ts
  );

  results.push({ username: s.username, displayName: s.display_name, password: s.password });
}

console.log('\nStation accounts ready. Sign in at /station-login.html with:\n');
console.log('Username'.padEnd(24) + 'Password'.padEnd(20) + 'Station');
console.log('-'.repeat(80));
for (const r of results) {
  console.log(r.username.padEnd(24) + String(r.password).padEnd(20) + r.displayName);
}

// Also save to a file so the credentials aren't lost once the terminal scrolls.
const outPath = path.join(__dirname, '..', 'STATION-CREDENTIALS.md');
const lines = [
  '# VoltSpot station login credentials',
  '',
  'Generated by `node scripts/seed-stations.js`. Sign in at `/station-login.html`.',
  '**Change these passwords or regenerate them before using this anywhere but locally.**',
  '',
  '| Username | Password | Station |',
  '|---|---|---|',
  ...results.map(r => `| \`${r.username}\` | \`${r.password}\` | ${r.displayName} |`),
  '',
];
fs.writeFileSync(outPath, lines.join('\n'));
console.log(`\nAlso saved to ${outPath}\n`);
