/**
 * routes/password.js — Forgot/Reset Password
 * Security: anti-enumeration, single-use tokens, 15-min expiry, session invalidation
 */

'use strict';

const express   = require('express');
const rateLimit = require('express-rate-limit');
const crypto    = require('crypto');
const router    = express.Router();
const { hashPassword }  = require('../utils/hashPassword');
const { checkHIBP }     = require('../utils/hibpCheck');
const { auditLogger }   = require('../utils/auditLogger');
const { validateInput } = require('../middleware/validateInput');
const emailService      = require('../utils/emailService');
const db                = require('../utils/db');

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max:      3,
  keyGenerator: (req) => (req.body && req.body.email) ? req.body.email.toLowerCase() : req.ip,
  message:  { error: 'Too many reset requests. Please try again later.' },
});

// ── POST /api/auth/forgot-password ──
router.post('/forgot-password',
  resetLimiter,
  validateInput('forgotPassword'),
  async (req, res) => {
    const { email } = req.body;

    // ANTI-ENUMERATION: always return 200 regardless of whether email exists
    try {
      const user = await db.getUserByEmail(email);
      if (user) {
        // Generate cryptographically random token
        const token     = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);  // 15 minutes

        await db.createResetToken(user.id, tokenHash, expiresAt);

        // Send email with reset link
        const resetUrl = `${process.env.BASE_URL}/pages/reset-password.html?token=${token}`;
        await emailService.sendPasswordReset(user.email, resetUrl);

        auditLogger.logAuthEvent('password_reset_requested', { userId: user.id, ip: req.ip, resetUrl });
      } else {
        auditLogger.logAuthEvent('password_reset_unknown_email', { email, ip: req.ip });
      }
    } catch (err) {
      console.error('[forgot-password]', err.message);
      // Still return 200 — never leak errors to client
    }

    // Always same response regardless of outcome (anti-enumeration)
    res.json({ success: true });
  }
);

// ── POST /api/auth/reset-password ──
router.post('/reset-password',
  validateInput('resetPassword'),
  async (req, res) => {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string' || token.length !== 64) {
      return res.status(400).json({ message: 'Invalid reset link. Please request a new one.' });
    }

    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const record    = await db.getResetToken(tokenHash);

      if (!record) {
        return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
      }

      if (new Date(record.expires_at) < new Date()) {
        await db.deleteResetToken(tokenHash);
        return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });
      }

      // Validate password strength (server-side)
      if (password.length < 12) {
        return res.status(400).json({ message: 'Password must be at least 12 characters.' });
      }

      // Check HIBP
      const isBreached = await checkHIBP(password);
      if (isBreached) {
        return res.status(400).json({ message: 'This password has been found in a data breach. Please choose a different one.' });
      }

      // Hash new password
      const newHash = await hashPassword(password);

      // Update password + invalidate ALL existing sessions for this user (force re-login)
      await db.updatePassword(record.user_id, newHash);
      await db.invalidateAllSessions(record.user_id);

      // Delete the used token (single-use)
      await db.deleteResetToken(tokenHash);

      auditLogger.logAuthEvent('password_reset_success', { userId: record.user_id, ip: req.ip });

      // Notify user of password change
      const user = await db.getUserById(record.user_id);
      await emailService.sendPasswordChangedNotification(user.email);

      res.json({ success: true });

    } catch (err) {
      console.error('[reset-password]', err.message);
      res.status(500).json({ message: 'An error occurred. Please try again.' });
    }
  }
);

module.exports = router;
