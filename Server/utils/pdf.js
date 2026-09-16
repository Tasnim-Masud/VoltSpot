// utils/pdf.js — renders a charging session as a downloadable PDF receipt.

const PDFDocument = require('pdfkit');

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function fmtDuration(sec) {
  sec = Number(sec) || 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function streamReceiptPdf(res, session) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="voltspot-receipt-${session.txn_id || session.id}.pdf"`
  );
  doc.pipe(res);

  // ---- header ----
  doc.rect(50, 45, 6, 26).fill('#FF7A33');
  doc
    .fillColor('#FF7A33')
    .fontSize(22)
    .text('VoltSpot', 66, 45, { continued: false });
  doc
    .fillColor('#333')
    .fontSize(10)
    .text('EV Charging Network — Payment Receipt', { paragraphGap: 10 });

  doc.moveDown(0.5);
  doc.strokeColor('#e0e0e0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // ---- status badge ----
  const statusLabel = session.status === 'completed' ? 'PAID — CHARGING COMPLETE' : session.status.toUpperCase();
  doc.fontSize(14).fillColor('#0F2A2E').text(statusLabel, { align: 'left' });
  doc.moveDown(1);

  // ---- key/value rows ----
  const rows = [
    ['Receipt / Transaction ID', session.txn_id || `SESSION-${session.id}`],
    ['Driver email', session.user_email],
    ['Vehicle plate', session.plate],
    ['Charging station', session.station_name],
    ['Connector', session.connector || '—'],
    ['Charging speed', session.kw ? `${session.kw} kW` : '—'],
    ['Reserved at', fmtDate(session.reserved_at)],
    ['Charging started', fmtDate(session.started_at)],
    ['Charging completed', fmtDate(session.completed_at)],
    ['Duration', fmtDuration(session.duration_sec)],
    ['Energy delivered', `${Number(session.energy_kwh || 0).toFixed(2)} kWh`],
    ['Rate', `$${Number(session.price_per_kwh).toFixed(2)} / kWh`],
  ];

  doc.fontSize(11);
  rows.forEach(([label, value]) => {
    const y = doc.y;
    doc.fillColor('#555').text(label, 50, y, { width: 240 });
    doc.fillColor('#111').text(String(value), 300, y, { width: 245, align: 'right' });
    doc.moveDown(0.6);
  });

  doc.moveDown(0.5);
  doc.strokeColor('#e0e0e0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // ---- total ----
  doc
    .fontSize(16)
    .fillColor('#0F2A2E')
    .text('Total charged', 50, doc.y, { width: 240, continued: false });
  doc
    .fontSize(20)
    .fillColor('#FF7A33')
    .text(`$${Number(session.total_cost || 0).toFixed(2)}`, 300, doc.y - 22, {
      width: 245,
      align: 'right',
    });

  doc.moveDown(3);
  doc
    .fontSize(9)
    .fillColor('#999')
    .text('Thank you for charging with VoltSpot. This receipt was generated automatically at the end of your session.', {
      align: 'center',
    });

  doc.end();
}

module.exports = { streamReceiptPdf };
