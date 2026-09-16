// js/api.js — thin wrapper around the VoltSpot backend API.
// Included by every app page via <script src="js/api.js"></script>.
// Assumes the frontend is served by the same Express server as the API
// (see server/server.js), so relative /api/... paths work with no CORS setup.

const VoltSpotAPI = {
  async login(email, plate) {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plate }),
    });
    const data = await r.json();
    if (!r.ok) {
      const err = new Error(data.error || 'Sign-in failed.');
      err.status = r.status;
      throw err;
    }
    return data;
  },

  async lookupEmailByPlate(plate) {
    const r = await fetch('/api/auth/lookup-email?plate=' + encodeURIComponent(plate));
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'No account found for that plate.');
    return data;
  },

  async reserveSession(payload) {
    const r = await fetch('/api/sessions/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not reserve that charger.');
    return data;
  },

  async startSession(id) {
    const r = await fetch(`/api/sessions/${id}/start`, { method: 'POST' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not start the session.');
    return data;
  },

  async getSession(id) {
    const r = await fetch(`/api/sessions/${id}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Session not found.');
    return data;
  },

  async completeSession(id, energyKwh, durationSec) {
    const r = await fetch(`/api/sessions/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ energyKwh, durationSec }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not complete the session.');
    return data;
  },

  async getHistory(email) {
    const r = await fetch(`/api/users/${encodeURIComponent(email)}/sessions`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not load history.');
    return data;
  },

  receiptUrl(id) {
    return `/api/receipts/${id}/pdf`;
  },

  // ---- station operator accounts ----
  async stationLogin(username, password) {
    const r = await fetch('/api/stations/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Sign-in failed.');
    return data;
  },

  async stationRegister(payload) {
    const r = await fetch('/api/stations/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not register this station.');
    return data;
  },

  async getStation(id, token) {
    const r = await fetch(`/api/stations/${id}?token=${encodeURIComponent(token)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not load station.');
    return data;
  },

  async getStationSessions(id, token) {
    const r = await fetch(`/api/stations/${id}/sessions?token=${encodeURIComponent(token)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not load charging history.');
    return data;
  },

  async updateStation(id, token, updates) {
    const r = await fetch(`/api/stations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...updates }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not save changes.');
    return data;
  },

  async stationLogout(id, token) {
    try {
      await fetch(`/api/stations/${id}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch (err) {
      // Best-effort — proceed to the login page regardless.
    }
  },

  // Clears the driver session (email/plate) but keeps the theme choice,
  // then sends them back to the login page.
  logout(theme) {
    const p = new URLSearchParams();
    if (theme) p.set('theme', theme);
    window.location.href = 'login.html' + (p.toString() ? '?' + p.toString() : '');
  },
};
