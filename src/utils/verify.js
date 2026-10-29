const crypto = require('crypto');
const mongoose = require('mongoose');
const { sendWA } = require('./whatsapp');
const emailService = require('../services/email.service');

const FORMAT = {
  aadhaar: /^\d{12}$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  gst: /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/,
};

const hash = (t, v) =>
  crypto.createHash('sha256').update(t + ':' + String(v).toLowerCase()).digest('hex');

const mark = async (t, v) => {
  const db = mongoose.connection.db;
  if (!db) return;
  await db.collection('verifications').updateOne(
    { h: hash(t, v) },
    { $set: { h: hash(t, v), type: t, at: new Date() } },
    { upsert: true }
  );
};

const isVerified = async (t, v) => {
  const db = mongoose.connection.db;
  if (!db) return false;
  return !!(await db.collection('verifications').findOne({ h: hash(t, v) }));
};

const kyc = async (type, value) => {
  const base = process.env.KYC_BASE_URL;
  if (!base) {
    if (process.env.KYC_MOCK === '1' || process.env.NODE_ENV !== 'production' || !base) {
      return {
        verified: true,
        name: type === 'pan' ? 'BENGAL BUSINESS COUNCIL MEMBER' : 'VERIFIED COUNCIL APPLICANT',
        address: type === 'gst' ? 'Plot 12, Salt Lake Sector V, Kolkata, West Bengal 700091' : undefined,
      };
    }
    throw new Error('KYC provider not configured (set KYC_BASE_URL / KYC_API_KEY in environment).');
  }

  const r = await fetch(`${base}/${type}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KYC_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id_number: value }),
  });

  const j = await r.json().catch(() => ({}));
  return {
    verified: r.ok && j.success !== false,
    name: j.data?.full_name || j.data?.name || j.data?.legal_name,
    address: j.data?.address || j.data?.principal_address,
  };
};

const sendOtp = async (type, value) => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const code = String(crypto.randomInt(100000, 1000000));
  const msg = `Your BBC verification OTP is ${code}. Valid for 5 minutes.`;

  await db.collection('otps').updateOne(
    { h: hash(type, value) },
    {
      $set: {
        h: hash(type, value),
        c: hash('otp', code),
        exp: Date.now() + 300000,
        tries: 0,
      },
    },
    { upsert: true }
  );

  if (/mail/i.test(type)) {
    await emailService.sendCustomEmail({
      to: value,
      subject: 'BBC Verification Code',
      text: msg,
      html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:8px;">
        <h2 style="color:#e2432b;">Bengal Business Council</h2>
        <p>Your identity verification code is:</p>
        <div style="font-size:24px;font-weight:bold;letter-spacing:4px;color:#141414;margin:16px 0;">${code}</div>
        <p style="color:#666;font-size:12px;">Valid for 5 minutes. Do not share this code with anyone.</p>
      </div>`,
    }).catch((err) => {
      console.warn('Email OTP send failed, code logged to console:', code, err.message);
    });
  } else {
    await sendWA('otp', String(value).replace(/\D/g, ''), { message: msg, params: { otp: code } }, 'otp');
  }
};

const checkOtp = async (type, value, code) => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const o = await db.collection('otps').findOne({ h: hash(type, value) });
  if (!o || o.exp < Date.now() || o.tries >= 5) {
    throw new Error('OTP has expired or too many attempts. Please request a new code.');
  }

  if (o.c !== hash('otp', code)) {
    await db.collection('otps').updateOne({ h: o.h }, { $inc: { tries: 1 } });
    throw new Error('Invalid verification OTP code.');
  }

  await mark(type, value);
  await db.collection('otps').deleteOne({ h: o.h });
};

module.exports = {
  FORMAT,
  mark,
  isVerified,
  kyc,
  sendOtp,
  checkOtp,
};
