// Dev-only OTP server for local testing (moved to backend)
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory store: phone -> { code, expires }
const otps = new Map();

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/otp/send', (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ ok: false, error: 'phone required' });
  const code = genCode();
  const expires = Date.now() + 1000 * 60 * 5; // 5 minutes
  otps.set(String(phone), { code, expires });
  console.log(`[otp-server] OTP for ${phone}: ${code}`);
  const masked = String(phone).slice(-4).padStart(String(phone).length, '*');
  res.json({ ok: true, phone, masked, ttl: 300 });
});

app.post('/otp/verify', (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !code) return res.status(400).json({ ok: false, error: 'phone and code required' });
  const rec = otps.get(String(phone));
  if (!rec) return res.status(404).json({ ok: false, error: 'not found' });
  if (Date.now() > rec.expires) {
    otps.delete(String(phone));
    return res.status(410).json({ ok: false, error: 'expired' });
  }
  if (rec.code !== String(code)) return res.status(401).json({ ok: false, error: 'invalid' });
  otps.delete(String(phone));
  res.json({ ok: true });
});

const port = process.env.OTP_PORT || 5001;
app.listen(port, () => console.log(`[otp-server] listening on http://localhost:${port}`));
