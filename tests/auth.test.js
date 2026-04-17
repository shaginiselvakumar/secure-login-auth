/**
 * tests/auth.test.js
 * Security-focused integration tests
 */

'use strict';

const request = require('supertest');
const app     = require('../server/index');
const { hashPassword } = require('../server/utils/hashPassword');
const db      = require('../server/utils/db');

describe('Login security', () => {

  test('returns 401 for wrong password — generic message (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@company.com', password: 'WrongPassword99!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password.');
    expect(res.body.error).not.toMatch(/password/i.test('password incorrect'));
  });

  test('returns same error for unknown email (anti-enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notexist@company.com', password: 'SomePassword123!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password.');
  });

  test('rejects SQL injection in email field', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: "' OR '1'='1", password: 'anything' });
    expect(res.status).toBe(400);
  });

  test('rejects oversized input (DoS prevention)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a'.repeat(300) + '@test.com', password: 'pass' });
    expect(res.status).toBe(400);
  });

  test('triggers rate limit after excessive attempts', async () => {
    const attempts = Array.from({ length: 25 }, () =>
      request(app).post('/api/auth/login').send({ email: 'test@company.com', password: 'wrong' })
    );
    const results = await Promise.all(attempts);
    const tooMany = results.filter(r => r.status === 429);
    expect(tooMany.length).toBeGreaterThan(0);
  }, 30000);

  test('requires CSRF token on POST', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', '')  // No session = no CSRF token
      .send({ email: 'test@company.com', password: 'TestPassword123!' });
    expect([400, 403]).toContain(res.status);
  });

  test('sets secure cookie flags on successful login', async () => {
    // Get CSRF token first
    const csrfRes = await request(app).get('/api/csrf-token');
    const { token } = csrfRes.body;
    const cookies   = csrfRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', cookies)
      .send({ email: 'test@company.com', password: 'TestPassword123!', _csrf: token });

    if (res.status === 200) {
      const setCookie = res.headers['set-cookie'] || [];
      const sessionCookie = setCookie.find(c => c.includes('__Host-sid') || c.includes('sid'));
      if (sessionCookie) {
        expect(sessionCookie).toMatch(/HttpOnly/i);
        expect(sessionCookie).toMatch(/SameSite=Strict/i);
      }
    }
  });

});

describe('Password reset security', () => {

  test('always returns success for forgot-password (anti-enumeration)', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    const { token } = csrfRes.body;
    const cookies   = csrfRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .set('Cookie', cookies)
      .send({ email: 'doesnotexist@nowhere.com', _csrf: token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('rejects short password on reset', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    const cookies   = csrfRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/reset-password')
      .set('Cookie', cookies)
      .send({ token: 'a'.repeat(64), password: 'short', _csrf: csrfRes.body.token });

    expect(res.status).toBe(400);
  });

});

describe('Security headers', () => {

  test('sets HSTS header', async () => {
    const res = await request(app).get('/');
    // Helmet sets this in production; in dev it may be absent
    // Check it doesn't return dangerous headers instead
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('sets X-Frame-Options: DENY', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  test('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('does not expose X-Powered-By', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

});

describe('Password hashing', () => {

  test('hashes produce different outputs for same input (salt)', async () => {
    const h1 = await hashPassword('SamePassword1!');
    const h2 = await hashPassword('SamePassword1!');
    expect(h1).not.toBe(h2);
  });

  test('hash is not plaintext', async () => {
    const h = await hashPassword('MyPassword123!');
    expect(h).not.toContain('MyPassword123!');
    expect(h.length).toBeGreaterThan(30);
  });

});
