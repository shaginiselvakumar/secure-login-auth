/**
 * utils/totpHelper.js
 * TOTP (RFC 6238) — compatible with Google Authenticator, Authy, etc.
 */

'use strict';

const crypto = require('crypto');

const TOTP_WINDOW    = 1;    // Accept 1 step before/after (30s tolerance)
const TOTP_STEP      = 30;   // 30-second window
const TOTP_DIGITS    = 6;

function generateTotpSecret() {
  return crypto.randomBytes(20).toString('base64').replace(/[^A-Z2-7]/gi, '').toUpperCase().slice(0, 32);
}

function hotp(secret, counter) {
  const decodedSecret = base32Decode(secret);
  const buf = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = tmp & 0xff;
    tmp >>= 8;
  }
  const hmac   = crypto.createHmac('sha1', decodedSecret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code   = (hmac.readUInt32BE(offset) & 0x7fffffff) % Math.pow(10, TOTP_DIGITS);
  return String(code).padStart(TOTP_DIGITS, '0');
}

function verifyTotp(token, secret) {
  if (!token || !secret || !/^\d{6}$/.test(token)) return false;
  const counter = Math.floor(Date.now() / 1000 / TOTP_STEP);
  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    if (hotp(secret, counter + i) === token) return true;
  }
  return false;
}

function getTotpUri(secret, email, issuer = 'SecureCorp') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// Base32 decode (RFC 4648)
function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const output = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

module.exports = { generateTotpSecret, verifyTotp, getTotpUri };
