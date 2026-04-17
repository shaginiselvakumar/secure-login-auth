/**
 * routes/auth.js - Login, Logout, SSO, Passkey, Remember-me
 */

'use strict';

const express     = require('express');
const rateLimit   = require('express-rate-limit');
const crypto      = require('crypto');
const router      = express.Router();
const { hashPassword, verifyPassword } = require('../utils/hashPassword');
const { checkHIBP }       = require('../utils/hibpCheck');
const { auditLogger }     = require('../utils/auditLogger');
const { validateInput }   = require('../middleware/validateInput');
const emailService        = require('../utils/emailService');
const db                  = require('../utils/db');

// Pre-compute dummy hash once at startup to prevent timing attacks on unknown emails
let DUMMY_HASH = null;
(async () => {
  try {
    DUMMY_HASH = await hashPassword('dummy-prevent-timing-attack');
    console.log('[Auth] Dummy hash initialized for timing attack prevention');
  } catch (err) {
    console.error('[Auth] Failed to initialize dummy hash:', err.message);
  }
})();

const REMEMBER_ME_COOKIE = 'remember_token';
const REMEMBER_ME_DAYS   = 30;

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      10,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many accounts created from this IP. Please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = (req.body && req.body.email) ? req.body.email.toLowerCase().trim() : '';
    return `${req.ip}_${email}`;
  },
  handler: (req, res) => {
    auditLogger.logEvent('rate_limit_hit', { ip: req.ip, email: req.body && req.body.email });
    res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.', retryAfter: 15 });
  },
});

// Issue 11: Remember-me middleware — auto-login from persistent token cookie
async function rememberMeMiddleware(req, res, next) {
  // Only attempt auto-login if no active session
  if (req.session && req.session.userId) return next();

  const token = req.signedCookies && req.signedCookies[REMEMBER_ME_COOKIE];
  if (!token) return next();

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record    = await db.getRememberToken(tokenHash);

    if (!record || new Date(record.expires_at) < new Date()) {
      if (record) await db.deleteRememberToken(tokenHash);
      res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
      return next();
    }

    const user = await db.getUserById(record.user_id);
    if (!user) {
      await db.deleteRememberToken(tokenHash);
      res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
      return next();
    }

    // Rotate token (issue new one, delete old)
    await db.deleteRememberToken(tokenHash);
    const newToken     = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
    const expiresAt    = new Date(Date.now() + REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000);
    await db.createRememberToken(user.id, newTokenHash, expiresAt);

    res.cookie(REMEMBER_ME_COOKIE, newToken, {
      signed:   true,
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000,
      path:     '/',
    });

    // Restore session
    await new Promise((resolve, reject) => req.session.regenerate(e => e ? reject(e) : resolve()));
    req.session.userId         = user.id;
    req.session.email          = user.email;
    req.session.name           = user.name || '';
    req.session.mfaVerified    = !user.mfa_enabled; // skip MFA for remember-me if not enrolled
    req.session.loginTimestamp = Date.now();
    req.session.rememberMe     = true;

    auditLogger.logAuthEvent('remember_me_login', { userId: user.id, ip: req.ip });
  } catch (err) {
    console.error('[remember-me]', err.message);
  }

  next();
}

// POST /api/auth/login
router.post('/login',
  loginLimiter,
  validateInput('login'),
  async (req, res) => {
    const { email, password, remember_me } = req.body;
    const ip        = req.ip;
    const userAgent = req.get('user-agent') || '';

    try {
      const user = await db.getUserByEmail(email);
      const hashToCheck = user ? user.password_hash : DUMMY_HASH;

      if (!user) {
        await verifyPassword(password, hashToCheck);
        auditLogger.logAuthEvent('login_fail_unknown_email', { email, ip, userAgent });
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        auditLogger.logAuthEvent('login_fail_locked', { userId: user.id, ip, userAgent });
        return res.status(423).json({ error: 'Account temporarily locked.' });
      }

      const valid = await verifyPassword(password, user.password_hash);

      if (!valid) {
        const newCount  = (user.failed_attempts || 0) + 1;
        const lockUntil = newCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        await db.updateFailedAttempts(user.id, newCount, lockUntil);
        auditLogger.logAuthEvent('login_fail_wrong_password', { userId: user.id, ip, userAgent, failCount: newCount });
        if (lockUntil) return res.status(423).json({ error: 'Account locked due to too many failed attempts.' });
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      await db.updateFailedAttempts(user.id, 0, null);
      await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));

      req.session.userId         = user.id;
      req.session.email          = user.email;
      req.session.name           = user.name || '';
      req.session.mfaVerified    = false;
      req.session.loginTimestamp = Date.now();
      req.session.userAgent      = userAgent;
      req.session.ip             = ip;

      // Issue 11: remember-me — store persistent token in DB, set separate cookie
      if (remember_me) {
        const token     = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000);
        await db.createRememberToken(user.id, tokenHash, expiresAt);
        res.cookie(REMEMBER_ME_COOKIE, token, {
          signed:   true,
          httpOnly: true,
          secure:   process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge:   REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000,
          path:     '/',
        });
      }

      if (user.mfa_enabled) {
        auditLogger.logAuthEvent('login_mfa_required', { userId: user.id, ip, userAgent });
        return res.json({ requiresMfa: true });
      }

      req.session.mfaVerified = true;
      auditLogger.logAuthEvent('login_success', { userId: user.id, ip, userAgent });

      db.checkKnownDevice(user.id, ip, userAgent).then(isKnown => {
        if (!isKnown) auditLogger.logAuthEvent('login_new_device', { userId: user.id, ip, userAgent });
      });

      res.json({ success: true, redirectTo: '/dashboard' });

    } catch (err) {
      console.error('[auth/login]', err.message);
      res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
);

// POST /api/auth/signup
router.post('/signup',
  signupLimiter,
  validateInput('signup'),
  async (req, res) => {
    const { name, email, password } = req.body;
    const ip = req.ip;

    try {
      const existing = await db.getUserByEmail(email);
      if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

      const breached = await checkHIBP(password);
      if (breached) return res.status(400).json({ error: 'This password has appeared in a data breach. Please choose a different one.' });

      const hash   = await hashPassword(password);
      const userId = 'user_' + crypto.randomBytes(8).toString('hex');

      await db.createUser({ id: userId, name, email, password_hash: hash });

      // Issue 15: wire emailService
      try { await emailService.sendWelcome(email, name); } catch {}

      auditLogger.logAuthEvent('signup_success', { userId, ip });
      res.status(201).json({ success: true });

    } catch (err) {
      console.error('[auth/signup]', err.message);
      res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const userId = req.session && req.session.userId;
  req.session.destroy((err) => {
    if (err) console.error('[logout]', err);
    const cookieName = process.env.NODE_ENV === 'production' ? '__Host-sid' : 'sid';
    res.clearCookie(cookieName, { path: '/' });
    res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
    auditLogger.logAuthEvent('logout', { userId, ip: req.ip });
    res.json({ success: true });
  });
});

// GET /api/auth/sso/initiate
router.get('/sso/initiate', (req, res) => {
  const state    = crypto.randomBytes(16).toString('hex');
  req.session.ssoState = state;

  const idpUrl   = process.env.SSO_IDP_URL;
  const clientId = process.env.SSO_CLIENT_ID;
  const redirect = encodeURIComponent(`${process.env.BASE_URL}/api/auth/sso/callback`);

  if (!idpUrl || !clientId) return res.status(503).json({ error: 'SSO is not configured.' });

  res.redirect(`${idpUrl}/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirect}&state=${state}&scope=openid+email+profile`);
});

// GET /api/auth/sso/callback
// Issue 5: wrapped in try/catch properly — will never crash the server
// Issue 20: This is a GET request, so CSRF middleware (ignoredMethods: ['GET']) correctly skips it.
//           SSO uses state parameter for CSRF protection instead.
router.get('/sso/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error || !code) return res.redirect('/?error=sso_failed');

    if (!req.session.ssoState || state !== req.session.ssoState) {
      auditLogger.logAuthEvent('sso_state_mismatch', { ip: req.ip });
      return res.redirect('/?error=sso_invalid_state');
    }

    delete req.session.ssoState;

    // TODO: exchange code for tokens with IdP, verify ID token, upsert user
    res.redirect('/dashboard');

  } catch (err) {
    auditLogger.logAuthEvent('sso_callback_error', { ip: req.ip, error: err.message });
    res.redirect('/?error=sso_failed');
  }
});

// GET /api/auth/passkey/challenge (existing authentication challenge)
router.get('/passkey/challenge', async (req, res) => {
  try {
    const { generateAuthenticationOptions } = require('@simplewebauthn/server');
    const challenge = await generateAuthenticationOptions({ rpID: process.env.RP_ID || 'localhost' });
    req.session.passkeyChallenge = challenge.challenge;
    res.json(challenge);
  } catch (err) {
    console.error('[passkey/challenge]', err.message);
    res.status(500).json({ error: 'Could not generate passkey challenge.' });
  }
});

// POST /api/auth/passkey/verify (existing authentication verify)
router.post('/passkey/verify', async (req, res) => {
  try {
    const { verifyAuthenticationResponse } = require('@simplewebauthn/server');
    const expectedChallenge = req.session.passkeyChallenge;

    if (!expectedChallenge) return res.status(400).json({ error: 'No challenge found.' });

    const credential = await db.getPasskeyCredential(req.body.id);
    if (!credential) return res.status(401).json({ error: 'Passkey not found.' });

    const verification = await verifyAuthenticationResponse({
      response:         req.body,
      expectedChallenge,
      expectedOrigin:   process.env.BASE_URL || 'http://localhost:3000',
      expectedRPID:     process.env.RP_ID    || 'localhost',
      authenticator:    credential,
    });

    if (!verification.verified) return res.status(401).json({ error: 'Passkey verification failed.' });

    delete req.session.passkeyChallenge;
    await new Promise((resolve, reject) => req.session.regenerate(e => e ? reject(e) : resolve()));

    req.session.userId      = credential.userId;
    req.session.mfaVerified = true;

    auditLogger.logAuthEvent('passkey_login_success', { userId: credential.userId, ip: req.ip });
    res.json({ success: true, redirectTo: '/dashboard' });

  } catch (err) {
    console.error('[passkey/verify]', err.message);
    res.status(500).json({ error: 'Passkey verification error.' });
  }
});

// Issue 13: Passkey registration endpoints

// GET /api/auth/passkey/register/options
router.get('/passkey/register/options', async (req, res) => {
  if (!req.session || !req.session.userId || !req.session.mfaVerified) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const { generateRegistrationOptions } = require('@simplewebauthn/server');
    const user = await db.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    const options = await generateRegistrationOptions({
      rpName:                  process.env.RP_NAME || 'SecureCorp',
      rpID:                    process.env.RP_ID   || 'localhost',
      userID:                  user.id,
      userName:                user.email,
      userDisplayName:         user.name || user.email,
      attestationType:         'none',
      excludeCredentials:      (user.passkeys || []).map(pk => ({ id: pk.credentialID, type: 'public-key' })),
      authenticatorSelection:  { residentKey: 'preferred', userVerification: 'preferred' },
    });

    req.session.passkeyRegistrationChallenge = options.challenge;
    auditLogger.logAuthEvent('passkey_register_options', { userId: user.id, ip: req.ip });
    res.json(options);

  } catch (err) {
    console.error('[passkey/register/options]', err.message);
    res.status(500).json({ error: 'Could not generate registration options.' });
  }
});

// POST /api/auth/passkey/register/verify
router.post('/passkey/register/verify', async (req, res) => {
  if (!req.session || !req.session.userId || !req.session.mfaVerified) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const { verifyRegistrationResponse } = require('@simplewebauthn/server');
    const expectedChallenge = req.session.passkeyRegistrationChallenge;

    if (!expectedChallenge) return res.status(400).json({ error: 'No registration challenge found.' });

    const verification = await verifyRegistrationResponse({
      response:        req.body,
      expectedChallenge,
      expectedOrigin:  process.env.BASE_URL || 'http://localhost:3000',
      expectedRPID:    process.env.RP_ID    || 'localhost',
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey registration failed.' });
    }

    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

    const credential = {
      credentialID:        Buffer.from(credentialID).toString('base64url'),
      credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64url'),
      counter,
      userId:              req.session.userId,
      createdAt:           new Date(),
    };

    await db.savePasskey(req.session.userId, credential);
    delete req.session.passkeyRegistrationChallenge;

    auditLogger.logAuthEvent('passkey_registered', { userId: req.session.userId, ip: req.ip });
    res.json({ success: true });

  } catch (err) {
    console.error('[passkey/register/verify]', err.message);
    res.status(500).json({ error: 'Passkey registration error.' });
  }
});

module.exports = router;
module.exports.rememberMeMiddleware = rememberMeMiddleware;
