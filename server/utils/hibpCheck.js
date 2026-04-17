/**
 * utils/hibpCheck.js
 * Have I Been Pwned k-anonymity password check
 * Sends only the first 5 chars of SHA1 hash — password never leaves your server
 */

'use strict';

const crypto = require('crypto');
const https  = require('https');

async function checkHIBP(password) {
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix  = sha1.slice(0, 5);
    const suffix  = sha1.slice(5);

    const data = await httpsGet(`https://api.pwnedpasswords.com/range/${prefix}`);
    const lines = data.split('\n');

    for (const line of lines) {
      const [hash, count] = line.trim().split(':');
      if (hash === suffix && parseInt(count, 10) > 0) {
        return true;  // Password found in breach database
      }
    }
    return false;
  } catch (err) {
    // If HIBP is unreachable, don't block the user — log and proceed
    console.warn('[HIBP] Check failed:', err.message);
    return false;
  }
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'SecureCorp-Login/1.0' },
      timeout: 3000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HIBP timeout')); });
  });
}

module.exports = { checkHIBP };
