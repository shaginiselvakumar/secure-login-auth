/**
 * middleware/validateInput.js
 * Server-side input validation — never trust the client
 */

'use strict';

const SCHEMAS = {
  login: {
    email:    { type: 'string', required: true, maxLen: 254, pattern: /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/ },
    password: { type: 'string', required: true, minLen: 1, maxLen: 128 },
  },
  forgotPassword: {
    email: { type: 'string', required: true, maxLen: 254, pattern: /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/ },
  },
  resetPassword: {
    token:    { type: 'string', required: true, minLen: 64, maxLen: 64 },
    password: { type: 'string', required: true, minLen: 12, maxLen: 128 },
  },
  signup: {
    name:     { type: 'string', required: true, minLen: 2, maxLen: 100 },
    email:    { type: 'string', required: true, maxLen: 254, pattern: /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/ },
    password: { type: 'string', required: true, minLen: 12, maxLen: 128 },
  },
};

function validateInput(schemaName) {
  return (req, res, next) => {
    const schema = SCHEMAS[schemaName];
    if (!schema) return next();

    const body   = req.body || {};
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const val = body[field];

      if (rules.required && (val === undefined || val === null || val === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      if (val === undefined || val === null) continue;

      if (rules.type === 'string') {
        if (typeof val !== 'string') { errors.push(`${field} must be a string`); continue; }
        const trimmed = val.trim();
        if (rules.minLen && trimmed.length < rules.minLen) errors.push(`${field} is too short`);
        if (rules.maxLen && trimmed.length > rules.maxLen) errors.push(`${field} is too long`);
        if (rules.pattern && !rules.pattern.test(trimmed)) errors.push(`${field} is invalid`);

        // Sanitise: set cleaned value
        body[field] = trimmed;
      }
    }

    if (errors.length > 0) {
      // Generic error — don't reveal which field failed (anti-enumeration for login)
      if (schemaName === 'login') {
        return res.status(400).json({ error: 'Invalid request.' });
      }
      return res.status(400).json({ error: errors[0] });
    }

    req.body = body;
    next();
  };
}

module.exports = { validateInput };
