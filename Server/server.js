// server.js — VoltSpot backend entry point.
// Serves the API (accounts, reservations, history, receipts) AND the
// static frontend from ../public, so the whole app runs from one process
// with no CORS setup needed.

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const historyRoutes = require('./routes/history');
const receiptRoutes = require('./routes/receipts');
const stationRoutes = require('./routes/stations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/users', historyRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/stations', stationRoutes);

// Serve the frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// There's no index.html — visiting the bare root would otherwise 404.
// Send people straight to the sign-in page instead.
app.get('/', (req, res) => res.redirect('/login.html'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`VoltSpot server running at http://localhost:${PORT}`);
});
