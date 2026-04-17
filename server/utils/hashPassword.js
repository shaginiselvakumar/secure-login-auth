/**
 * utils/hashPassword.js
 * Argon2id password hashing — OWASP recommended settings
 * Falls back to bcrypt if argon2 not available
 */

'use strict';

const PEPPER = process.env.ARGON2_PEPPER || '';

async function hashPassword(password) {
  try {
    const argon2 = require('argon2');
    return await argon2.hash(password + PEPPER, {
      type:        argon2.argon2id,
      memoryCost:  65536,   // 64 MB
      timeCost:    3,       // 3 iterations
      parallelism: 4,       // 4 threads
      hashLength:  32,
    });
  } catch {
    // Fallback to bcrypt
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password + PEPPER, 12);
  }
}

async function verifyPassword(password, hash) {
  try {
    if (hash.startsWith('$argon2')) {
      const argon2 = require('argon2');
      return await argon2.verify(hash, password + PEPPER);
    } else {
      // bcrypt hash
      const bcrypt = require('bcrypt');
      return await bcrypt.compare(password + PEPPER, hash);
    }
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
