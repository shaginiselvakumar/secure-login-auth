'use strict';

/**
 * Simple session-based CSRF protection
 * Stores CSRF token in session, validates on POST requests
 */

const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function csrfTokenMiddleware(req, res, next) {
  // Attach csrfToken function to request
  req.csrfToken = () => {
    // Generate token if it doesn't exist in session
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateToken();
    }
    return req.session.csrfToken;
  };
  next();
}

function csrfProtection(req, res, next) {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const sessionToken = req.session && req.session.csrfToken;
  const requestToken = (req.body && req.body._csrf) ||
                      req.headers['x-csrf-token'] ||
                      req.headers['x-xsrf-token'];

  console.log('[CSRF] Session token:', sessionToken ? sessionToken.substring(0, 10) + '...' : 'None');
  console.log('[CSRF] Request token:', requestToken ? requestToken.substring(0, 10) + '...' : 'None');

  if (!sessionToken || !requestToken) {
    const err = new Error('Invalid or expired form token. Please refresh and try again.');
    err.code = 'EBADCSRFTOKEN';
    err.status = 403;
    return next(err);
  }

  // Constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(sessionToken), Buffer.from(requestToken))) {
    const err = new Error('Invalid or expired form token. Please refresh and try again.');
    err.code = 'EBADCSRFTOKEN';
    err.status = 403;
    return next(err);
  }

  console.log('[CSRF] Validation SUCCESS');
  next();
}

module.exports = { csrfProtection, csrfTokenMiddleware };
