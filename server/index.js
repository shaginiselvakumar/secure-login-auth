/**
 * server/index.js — Secure Login Server
 * Security: HTTPS redirect, HSTS, CSP, rate limiting, CSRF, session management
 *
 * HTTPS/TLS in production:
 *   Use a reverse proxy (nginx, Caddy, AWS ALB) to terminate TLS and forward to this server.
 *   For a quick dev HTTPS setup: `npx local-ssl-proxy --source 3443 --target 3000`
 *   or use `mkcert` to generate a local cert and pass it to https.createServer().
 */

'use strict';

require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const session      = require('express-session');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path         = require('path');
const crypto       = require('crypto');

const authRoutes     = require('./routes/auth');
const mfaRoutes      = require('./routes/mfa');
const passwordRoutes = require('./routes/password');
const { csrfProtection, csrfTokenMiddleware } = require('./middleware/csrfProtection-simple');
const { auditLogger }    = require('./utils/auditLogger');

const app = express();

// ─── Trust proxy (for rate limiting behind load balancer) ───
app.set('trust proxy', 1);

// ─── Force HTTPS ───
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// ─── Security Headers (Helmet) ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", 'https://fonts.googleapis.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:         ["'self'", 'data:'],
      connectSrc:     ["'self'"],
      frameSrc:       ["'none'"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: {
    maxAge:            31536000,
    includeSubDomains: true,
    preload:           true,
  },
  frameguard:          { action: 'deny' },
  noSniff:             true,
  xssFilter:           true,
  referrerPolicy:      { policy: 'no-referrer' },
  permittedCrossDomainPolicies: false,
}));

// Remove X-Powered-By entirely
app.disable('x-powered-by');

// Permissions policy
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
  next();
});

// ─── Body parsing (limit size to prevent DoS) ───
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser(process.env.SESSION_SECRET));

// ─── Session ───
// NOTE: In-memory session store is used in development.
// For production, set MONGODB_URI (connect-mongo) or REDIS_URL (connect-redis).
// Redis is recommended for multi-instance deployments due to lower latency and
// native TTL support. MongoDB is a good fallback for single-region deployments.
const sessionStore = process.env.NODE_ENV === 'production'
  ? require('./utils/sessionStore')   // MongoDB/Redis store in production
  : new session.MemoryStore();

// Cookie name: __Host- prefix requires Secure + path=/ + no Domain attribute.
// In dev we use plain 'sid' because Secure is not set on HTTP localhost.
app.use(session({
  secret:            process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
  name:              process.env.NODE_ENV === 'production' ? '__Host-sid' : 'sid',
  store:             sessionStore,
  resave:            false,
  saveUninitialized: true,  // Changed to true so session is created for CSRF
  rolling:           true,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge:   8 * 60 * 60 * 1000,
    path:     '/',
  },
}));

// ─── CSRF token helper (attaches req.csrfToken()) ───
app.use(csrfTokenMiddleware);

// ─── Global rate limiting ───
const globalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,  // 15 minutes
  max:              200,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many requests. Please try again later.' },
  skip:             (req) => req.path.startsWith('/css') || req.path.startsWith('/js'),
});
app.use(globalLimiter);

// ─── Request logging ───
app.use((req, _res, next) => {
  auditLogger.logRequest(req);
  next();
});

// ─── Remember-me auto-login middleware ───
const { rememberMeMiddleware } = require('./routes/auth');
app.use(rememberMeMiddleware);

// ─── Dashboard (auth-guarded — must be before static middleware) ───
app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.userId || !req.session.mfaVerified) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// ─── Static files ───
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge:     '1h',
  etag:       true,
  index:      'index.html',
  dotfiles:   'ignore',
}));

// ─── CSRF Token endpoint ───
// GET is a safe method — no CSRF protection needed to fetch the token itself.
app.get('/api/csrf-token', (req, res) => {
  const token = req.csrfToken();
  console.log('[CSRF] Token endpoint called, token length:', token ? token.length : 0);
  console.log('[CSRF] Session ID for token generation:', req.sessionID);
  res.json({ token });
});

// ─── Health check endpoint ───
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ─── API Routes ───
app.use('/api/auth',     csrfProtection, authRoutes);
app.use('/api/auth/mfa', csrfProtection, mfaRoutes);
app.use('/api/auth',     csrfProtection, passwordRoutes);

// ─── Auth: current user ───
app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.userId || !req.session.mfaVerified) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  res.json({
    user: {
      id:             req.session.userId,
      email:          req.session.email,
      name:           req.session.name || '',
      loginTimestamp: req.session.loginTimestamp,
    },
  });
});

// ─── SPA fallback (serve pages) ───
app.get('/pages/*', (req, res, next) => {
  const safePath = req.path.replace(/\.\./g, ''); // path traversal prevention
  res.sendFile(path.join(__dirname, '../public', safePath), (err) => {
    if (err) next();
  });
});

// ─── 404 ───
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ───
app.use((err, req, res, _next) => {
  // CSRF error
  if (err.code === 'EBADCSRFTOKEN') {
    auditLogger.logEvent('csrf_failure', { ip: req.ip, path: req.path });
    return res.status(403).json({ error: 'Invalid or expired form token. Please refresh and try again.' });
  }

  // Never leak stack traces
  console.error('[ERROR]', err.message);
  auditLogger.logError(err, req);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

// ─── Start ───
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`[SecureCorp] Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  console.log(`[SecureCorp] Visit: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SecureCorp] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[SecureCorp] Server closed');
    process.exit(0);
  });
});

module.exports = app;
