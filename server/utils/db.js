'use strict';

const crypto = require('crypto');
void crypto;

const memUsers          = new Map();
const memTokens         = new Map();
const memDevices        = new Map();
const memRememberTokens = new Map();

let useMemory = true;
let User, ResetToken, Device, RememberToken;
let mongooseConnection = null;

if (process.env.MONGODB_URI) {
  const mongoose = require('mongoose');
  mongooseConnection = mongoose.connection;
  
  // Connection event handlers
  mongooseConnection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err.message);
  });
  
  mongooseConnection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected');
  });
  
  mongooseConnection.on('reconnected', () => {
    console.log('[DB] MongoDB reconnected');
  });
  const userSchema = new mongoose.Schema({
    id:              { type: String, required: true, unique: true },
    name:            { type: String, default: '' },
    email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash:   { type: String, required: true },
    mfa_enabled:     { type: Boolean, default: false },
    totp_secret:     { type: String, default: null },
    phone:           { type: String, default: null },
    failed_attempts: { type: Number, default: 0 },
    locked_until:    { type: Date,   default: null },
    backup_codes:    { type: Array,  default: [] },
    passkeys:        { type: Array,  default: [] },
    created_at:      { type: Date,   default: Date.now },
  });
  const resetTokenSchema = new mongoose.Schema({
    token_hash: { type: String, required: true, unique: true },
    user_id:    { type: String, required: true },
    expires_at: { type: Date,   required: true },
  });
  const deviceSchema = new mongoose.Schema({
    key:        { type: String, required: true, unique: true },
    created_at: { type: Date, default: Date.now },
  });
  const rememberTokenSchema = new mongoose.Schema({
    token_hash: { type: String, required: true, unique: true },
    user_id:    { type: String, required: true },
    expires_at: { type: Date,   required: true },
    created_at: { type: Date,   default: Date.now },
  });
  User          = mongoose.model('User',          userSchema);
  ResetToken    = mongoose.model('ResetToken',    resetTokenSchema);
  Device        = mongoose.model('Device',        deviceSchema);
  RememberToken = mongoose.model('RememberToken', rememberTokenSchema);
  mongoose.connect(process.env.MONGODB_URI, { 
    serverSelectionTimeoutMS: 3000,
    socketTimeoutMS: 5000,
  })
    .then(() => { 
      useMemory = false; 
      console.log('[DB] MongoDB connected successfully'); 
    })
    .catch(err => { 
      console.warn('[DB] MongoDB connection failed, using in-memory store:', err.message); 
      useMemory = true; 
    });
}

const db = {
  async createUser({ id, name, email, password_hash }) {
    if (useMemory) {
      memUsers.set(email.toLowerCase().trim(), { id, name, email: email.toLowerCase().trim(), password_hash, mfa_enabled: false, totp_secret: null, phone: null, failed_attempts: 0, locked_until: null, backup_codes: [], passkeys: [], created_at: new Date() });
      return;
    }
    await User.create({ id, name, email, password_hash });
  },
  async getUserByEmail(email) {
    if (useMemory) return memUsers.get(email.toLowerCase().trim()) || null;
    return User.findOne({ email: email.toLowerCase().trim() }).lean() || null;
  },
  async getUserById(id) {
    if (useMemory) { for (const u of memUsers.values()) if (u.id === id) return u; return null; }
    return User.findOne({ id }).lean() || null;
  },
  async updateFailedAttempts(userId, count, lockedUntil) {
    if (useMemory) { for (const u of memUsers.values()) { if (u.id === userId) { u.failed_attempts = count; u.locked_until = lockedUntil; break; } } return; }
    await User.updateOne({ id: userId }, { failed_attempts: count, locked_until: lockedUntil });
  },
  async updatePassword(userId, newHash) {
    if (useMemory) { for (const u of memUsers.values()) { if (u.id === userId) { u.password_hash = newHash; break; } } return; }
    await User.updateOne({ id: userId }, { password_hash: newHash });
  },
  async updateTotpSecret(userId, secret) {
    if (useMemory) { for (const u of memUsers.values()) { if (u.id === userId) { u.totp_secret = secret; u.mfa_enabled = true; break; } } return; }
    await User.updateOne({ id: userId }, { totp_secret: secret, mfa_enabled: true });
  },
  async saveBackupCodes(userId, codes) {
    if (useMemory) { for (const u of memUsers.values()) { if (u.id === userId) { u.backup_codes = codes; break; } } return; }
    await User.updateOne({ id: userId }, { backup_codes: codes });
  },
  async savePasskey(userId, credential) {
    if (useMemory) { for (const u of memUsers.values()) { if (u.id === userId) { u.passkeys = u.passkeys || []; u.passkeys.push(credential); break; } } return; }
    await User.updateOne({ id: userId }, { $push: { passkeys: credential } });
  },
  async createResetToken(userId, tokenHash, expiresAt) {
    if (useMemory) { memTokens.set(tokenHash, { user_id: userId, expires_at: expiresAt }); return; }
    await ResetToken.create({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt });
  },
  async getResetToken(tokenHash) {
    if (useMemory) return memTokens.get(tokenHash) || null;
    const doc = await ResetToken.findOne({ token_hash: tokenHash }).lean();
    return doc ? { user_id: doc.user_id, expires_at: doc.expires_at } : null;
  },
  async deleteResetToken(tokenHash) {
    if (useMemory) { memTokens.delete(tokenHash); return; }
    await ResetToken.deleteOne({ token_hash: tokenHash });
  },
  async invalidateAllSessions() {},
  async createRememberToken(userId, tokenHash, expiresAt) {
    if (useMemory) { memRememberTokens.set(tokenHash, { user_id: userId, expires_at: expiresAt }); return; }
    await RememberToken.create({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt });
  },
  async getRememberToken(tokenHash) {
    if (useMemory) return memRememberTokens.get(tokenHash) || null;
    const doc = await RememberToken.findOne({ token_hash: tokenHash }).lean();
    return doc ? { user_id: doc.user_id, expires_at: doc.expires_at } : null;
  },
  async deleteRememberToken(tokenHash) {
    if (useMemory) { memRememberTokens.delete(tokenHash); return; }
    await RememberToken.deleteOne({ token_hash: tokenHash });
  },
  async getBackupCodes(userId) {
    const user = await db.getUserById(userId);
    return (user && user.backup_codes) || [];
  },
  async consumeBackupCode(codeId) {
    if (useMemory) { for (const u of memUsers.values()) { const idx = (u.backup_codes || []).findIndex(c => c.id === codeId); if (idx !== -1) { u.backup_codes.splice(idx, 1); break; } } return; }
    await User.updateOne({ 'backup_codes.id': codeId }, { $pull: { backup_codes: { id: codeId } } });
  },
  async getPasskeyCredential(credentialId) {
    if (useMemory) { for (const u of memUsers.values()) { const pk = (u.passkeys || []).find(p => p.credentialID === credentialId); if (pk) return pk; } return null; }
    const user = await User.findOne({ 'passkeys.credentialID': credentialId }).lean();
    return user ? (user.passkeys.find(p => p.credentialID === credentialId) || null) : null;
  },
  async checkKnownDevice(userId, ip, userAgent) {
    const key = userId + '_' + ip + '_' + userAgent;
    if (useMemory) { if (memDevices.has(key)) return true; memDevices.set(key, Date.now()); return false; }
    const existing = await Device.findOne({ key });
    if (!existing) { await Device.create({ key }); return false; }
    return true;
  },
};

module.exports = db;
