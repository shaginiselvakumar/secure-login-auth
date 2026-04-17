'use strict';

/**
 * server/utils/sessionStore.js
 * Session store factory.
 * Uses MongoDB (connect-mongo) when MONGODB_URI is set, falls back to MemoryStore.
 * NOTE: For production scale, Redis (connect-redis) is recommended over MongoDB
 * for lower latency and built-in TTL support across multiple instances.
 */

const session = require('express-session');

let store;

try {
  if (process.env.MONGODB_URI) {
    const MongoStore = require('connect-mongo');
    store = MongoStore.create({
      mongoUrl:        process.env.MONGODB_URI,
      ttl:             8 * 60 * 60,   // 8 hours (matches cookie maxAge)
      autoRemove:      'native',
      touchAfter:      60,            // Only update session every 60s (reduces writes)
      crypto: {
        secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production'
      }
    });
    console.log('[Session] Using MongoDB session store');
  } else {
    store = new session.MemoryStore();
    console.log('[Session] Using in-memory session store (not suitable for production)');
  }
} catch (err) {
  console.warn('[Session] Store init failed, falling back to MemoryStore:', err.message);
  store = new session.MemoryStore();
}

module.exports = store;
