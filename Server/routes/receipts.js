// routes/receipts.js — download a receipt, either right after paying or
// later from the History page. Both call the same endpoint.

const express = require('express');
const db = require('../db');
const { streamReceiptPdf } = require('../utils/pdf');
const router = express.Router();

// GET /api/receipts/:id/pdf
router.get('/:id/pdf', (req, res) => {
  const session = db.prepare('SELECT * FROM charging_sessions WHERE id = ?').get(Number(req.params.id));
  if (!session) return res.status(404).send('Receipt not found.');
  if (session.status !== 'completed') {
    return res.status(400).send('This session has not been completed yet — no receipt to show.');
  }
  streamReceiptPdf(res, session);
});

module.exports = router;
