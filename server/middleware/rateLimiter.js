/**
 * middleware/rateLimiter.js
 * Configurable rate limiters for different endpoints
 */

'use strict';

const rateLimit = require('express-rate-limit');
const { auditLogger } = require('../utils/auditLogger');

// Per-account attempt tracker (in-memory).
// NOTE: This Map is local to a single process. For multi-instance deployments
// (multiple Node.js workers or containers), replace with a shared Redis store
// (e.g. rate-limit-redis or ioredis) so limits are enforced across all instances.
const accountAttempts = new Map();

function getAccountLimiter(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const email = req.body && req.body.email ? req.body.email.toLowerCase().trim() : null;
    if (!email) return next();

    const now   = Date.now();
    const entry = accountAttempts.get(email);

    if (entry) {
      // Clean up expired entries
      if (now > entry.resetAt) {
        accountAttempts.delete(email);
      } else if (entry.count >= maxAttempts) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 60000);
        auditLogger.logAuthEvent('account_rate_limit', { email, ip: req.ip });
        return res.status(429).json({
          error:       'Account temporarily locked due to too many attempts.',
          retryAfter,
        });
      }
    }

    // Track attempt on request completion
    res.on('finish', () => {
      if (res.statusCode === 401) {
        const cur = accountAttempts.get(email) || { count: 0, resetAt: now + windowMs };
        cur.count++;
        accountAttempts.set(email, cur);
      } else if (res.statusCode === 200) {
        accountAttempts.delete(email);
      }
    });

    next();
  };
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of accountAttempts) {
    if (now > val.resetAt) accountAttempts.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = { getAccountLimiter };
