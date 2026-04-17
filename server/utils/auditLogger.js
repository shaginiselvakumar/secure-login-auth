/**
 * utils/auditLogger.js
 * Write-only audit log for all auth events
 * In production: write to separate append-only log store / SIEM
 */

'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// Hash emails before logging (GDPR compliance)
function hashEmail(email) {
  if (!email) return null;
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 16);
}

function formatEntry(type, data) {
  return JSON.stringify({
    timestamp:  new Date().toISOString(),
    event:      type,
    ...data,
    email:      data.email ? hashEmail(data.email) : undefined,
  });
}

function writeLog(entry) {
  // In production: write to SIEM, CloudWatch, Splunk, etc.
  // In development: write to file + console
  if (process.env.NODE_ENV !== 'test') {
    console.log('[AUDIT]', entry);
  }
  try {
    const logDir  = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'auth.log'), entry + '\n');
  } catch {}
}

const auditLogger = {
  logAuthEvent(event, data = {}) {
    writeLog(formatEntry(event, data));
  },

  logRequest(req) {
    if (req.path.startsWith('/api/auth')) {
      writeLog(formatEntry('api_request', {
        method: req.method,
        path:   req.path,
        ip:     req.ip,
      }));
    }
  },

  logEvent(event, data = {}) {
    writeLog(formatEntry(event, data));
  },

  logError(err, req) {
    writeLog(formatEntry('server_error', {
      message: err.message,
      path:    req && req.path,
      ip:      req && req.ip,
    }));
  },
};

module.exports = { auditLogger };
