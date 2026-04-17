/**
 * routes/mfa.js - TOTP + Backup code verification + MFA enrollment
 */

'use strict';

const express   = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();
const { verifyTotp, generateTotpSecret, getTotpUri } = require('../utils/totpHelper');
const { auditLogger }   = require('../utils/auditLogger');
const db                = require('../utils/db');
const crypto            = require('crypto');

const mfaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max:      10,
  message:  { error: 'Too many MFA attempts. Please wait 5 minutes.' },
});

// Issue 8: TOTP replay attack prevention
// Key: `${userId}_${windowCounter}`, Value: Set of used codes in that window
const usedTotpCodes = new Map();
const TOTP_STEP = 30;

function isTotpReplay(userId, code) {
  const windowCounter = Math.floor(Date.now() / 1000 / TOTP_STEP);
  // Check current window and adjacent windows (matching verifyTotp's TOTP_WINDOW=1)
  for (let i = -1; i <= 1; i++) {
    const key = `${userId}_${windowCounter + i}`;
    const used = usedTotpCodes.get(key);
    if (used && used.has(code)) return true;
  }
  return false;
}

function markTotpUsed(userId, code) {
  const windowCounter = Math.floor(Date.now() / 1000 / TOTP_STEP);
  const key = `${userId}_${windowCounter}`;
  if (!usedTotpCodes.has(key)) {
    usedTotpCodes.set(key, new Set());
    // Auto-clean after 3 windows (90s)
    setTimeout(() => usedTotpCodes.delete(key), 90 * 1000);
  }
  usedTotpCodes.get(key).add(code);
}

function requirePartialAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  next();
}

function requireFullAuth(req, res, next) {
  if (!req.session || !req.session.userId || !req.session.mfaVerified) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

// POST /api/auth/mfa/verify
router.post('/verify', mfaLimiter, requirePartialAuth, async (req, res) => {
  const { code } = req.body;
  const userId   = req.session.userId;

  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid code format.' });
  }

  try {
    const user = await db.getUserById(userId);
    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: 'MFA not configured.' });
    }

    // Issue 8: reject replayed codes
    if (isTotpReplay(userId, code)) {
      auditLogger.logAuthEvent('mfa_replay_attempt', { userId, ip: req.ip });
      return res.status(401).json({ error: 'Code already used. Please wait for the next code.' });
    }

    const valid = verifyTotp(code, user.totp_secret);

    if (!valid) {
      auditLogger.logAuthEvent('mfa_fail', { userId, ip: req.ip });
      return res.status(401).json({ error: 'Invalid code.' });
    }

    markTotpUsed(userId, code);
    req.session.mfaVerified = true;
    auditLogger.logAuthEvent('mfa_success', { userId, ip: req.ip });
    res.json({ success: true, redirectTo: '/dashboard' });

  } catch (err) {
    console.error('[mfa/verify]', err.message);
    res.status(500).json({ error: 'Verification error.' });
  }
});

// POST /api/auth/mfa/backup
router.post('/backup', mfaLimiter, requirePartialAuth, async (req, res) => {
  const { code } = req.body;
  const userId   = req.session.userId;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Invalid backup code.' });
  }

  try {
    const codes = await db.getBackupCodes(userId);
    const normalised = code.replace(/[-\s]/g, '').toUpperCase();

    let matchedId = null;
    for (const stored of codes) {
      const hash = crypto.createHash('sha256').update(normalised).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(stored.code_hash))) {
        matchedId = stored.id;
        break;
      }
    }

    if (!matchedId) {
      auditLogger.logAuthEvent('mfa_backup_fail', { userId, ip: req.ip });
      return res.status(401).json({ error: 'Invalid backup code.' });
    }

    await db.consumeBackupCode(matchedId);
    req.session.mfaVerified = true;
    auditLogger.logAuthEvent('mfa_backup_success', { userId, ip: req.ip });
    res.json({ success: true, redirectTo: '/dashboard' });

  } catch (err) {
    console.error('[mfa/backup]', err.message);
    res.status(500).json({ error: 'Verification error.' });
  }
});

// POST /api/auth/mfa/sms
router.post('/sms', mfaLimiter, requirePartialAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    const user = await db.getUserById(userId);
    if (!user || !user.phone) {
      return res.status(400).json({ error: 'No phone number on file.' });
    }
    const smsService = require('../utils/smsService');
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await smsService.sendOTP(user.phone, otp);
    auditLogger.logAuthEvent('mfa_sms_sent', { userId, ip: req.ip });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not send SMS.' });
  }
});

// Issue 12: MFA enrollment endpoints

// POST /api/auth/mfa/setup/initiate
// Generates a TOTP secret, stores it in session, returns otpauth URI + QR code
router.post('/setup/initiate', requireFullAuth, async (req, res) => {
  try {
    const user   = await db.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    const secret = generateTotpSecret();
    const issuer = process.env.TOTP_ISSUER || 'SecureCorp';
    const uri    = getTotpUri(secret, user.email, issuer);

    // Store secret in session temporarily until verified
    req.session.pendingTotpSecret = secret;

    const QRCode = require('qrcode');
    const qrDataUrl = await QRCode.toDataURL(uri);

    auditLogger.logAuthEvent('mfa_setup_initiated', { userId: user.id, ip: req.ip });
    res.json({ secret, uri, qrCode: qrDataUrl });

  } catch (err) {
    console.error('[mfa/setup/initiate]', err.message);
    res.status(500).json({ error: 'Could not initiate MFA setup.' });
  }
});

// POST /api/auth/mfa/setup/verify
// Confirms the TOTP code, saves secret, generates 8 backup codes
router.post('/setup/verify', mfaLimiter, requireFullAuth, async (req, res) => {
  const { code } = req.body;
  const userId   = req.session.userId;

  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid code format.' });
  }

  const pendingSecret = req.session.pendingTotpSecret;
  if (!pendingSecret) {
    return res.status(400).json({ error: 'No pending MFA setup. Call /setup/initiate first.' });
  }

  try {
    const valid = verifyTotp(code, pendingSecret);
    if (!valid) {
      auditLogger.logAuthEvent('mfa_setup_verify_fail', { userId, ip: req.ip });
      return res.status(401).json({ error: 'Invalid code. Please try again.' });
    }

    // Generate 8 single-use backup codes
    const backupCodes = [];
    const backupCodesPlain = [];
    for (let i = 0; i < 8; i++) {
      const plain = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10-char hex
      const hash  = crypto.createHash('sha256').update(plain).digest('hex');
      backupCodes.push({ id: crypto.randomBytes(8).toString('hex'), code_hash: hash });
      backupCodesPlain.push(plain);
    }

    await db.updateTotpSecret(userId, pendingSecret);
    await db.saveBackupCodes(userId, backupCodes);

    delete req.session.pendingTotpSecret;

    auditLogger.logAuthEvent('mfa_setup_complete', { userId, ip: req.ip });
    res.json({ success: true, backupCodes: backupCodesPlain });

  } catch (err) {
    console.error('[mfa/setup/verify]', err.message);
    res.status(500).json({ error: 'Could not complete MFA setup.' });
  }
});

module.exports = router;
