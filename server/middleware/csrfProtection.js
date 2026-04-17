'use strict';

/**
 * middleware/csrfProtection.js
 * CSRF protection using csrf-csrf (double-submit cookie pattern).
 * Replaces deprecated csurf package.
 *
 * Note: GET/HEAD/OPTIONS are safe methods and are excluded by default
 * (ignoredMethods below). The SSO callback is a GET, so it is correctly
 * excluded — no CSRF token is needed for read-only redirects.
 */

const { doubleCsrf } = require('csrf-csrf');

const csrfConfig = doubleCsrf({
  getSecret:     () => process.env.CSRF_SECRET || 'dev-csrf-secret-change-in-production',
  getSessionIdentifier: (req) => {
    // Use a stable session identifier
    // For csrf-csrf, we need a consistent identifier across requests
    // Using the session itself as the identifier (it will be serialized)
    return req.sessionID || 'anonymous';
  },
  cookieName:    process.env.NODE_ENV === 'production' ? '__Host-csrf' : 'csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
  },
  size:          64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],  // Safe methods — SSO callback (GET) is correctly excluded here
  getTokenFromRequest: (req) =>
    (req.body && req.body._csrf) ||
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'],
});

const generateCsrfToken = csrfConfig.generateCsrfToken;
const doubleCsrfProtection = csrfConfig.doubleCsrfProtection;

// Wrap doubleCsrfProtection to emit EBADCSRFTOKEN on failure (matches existing error handler)
function csrfProtection(req, res, next) {
  // Debug logging
  console.log('[CSRF DEBUG] Request to:', req.method, req.path);
  console.log('[CSRF DEBUG] Token from body:', req.body && req.body._csrf ? req.body._csrf.substring(0, 20) + '...' : 'Missing');
  console.log('[CSRF DEBUG] CSRF cookie:', req.cookies && req.cookies.csrf ? req.cookies.csrf.substring(0, 20) + '...' : 'Missing');
  console.log('[CSRF DEBUG] Session ID:', req.sessionID);
  
  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      console.error('[CSRF] Validation failed:', err.message);
      console.error('[CSRF] Error details:', err);
      err.code = 'EBADCSRFTOKEN';
      return next(err);
    }
    console.log('[CSRF] Validation SUCCESS');
    next();
  });
}

// Attach generateCsrfToken so routes can call req.csrfToken()
function csrfTokenMiddleware(req, res, next) {
  req.csrfToken = (options) => {
    try {
      const token = generateCsrfToken(req, res, options);
      console.log('[CSRF DEBUG] Token generated, length:', token ? token.length : 0);
      return token;
    } catch (err) {
      console.error('[CSRF] Token generation failed:', err.message);
      return '';
    }
  };
  next();
}

module.exports = { csrfProtection, csrfTokenMiddleware, generateCsrfToken };
