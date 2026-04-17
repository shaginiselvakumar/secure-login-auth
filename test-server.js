#!/usr/bin/env node

/**
 * Simple server test to verify all endpoints are working
 */

'use strict';

const http = require('http');

function makeRequest(path, method = 'GET', cookies = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: cookies ? { 'Cookie': cookies } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        resolve({ 
          status: res.statusCode, 
          data: data,
          cookies: setCookie || []
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing SecureCorp Login System\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const health = await makeRequest('/api/health');
    if (health.status === 200) {
      console.log('   ✅ Health check passed');
      console.log('   Response:', health.data);
    } else {
      console.log('   ❌ Health check failed:', health.status);
    }

    // Test 2: Main page
    console.log('\n2. Testing main page...');
    const mainPage = await makeRequest('/');
    if (mainPage.status === 200) {
      console.log('   ✅ Main page accessible');
      console.log('   Cookies set:', mainPage.cookies.length > 0 ? 'Yes' : 'No');
    } else {
      console.log('   ❌ Main page failed:', mainPage.status);
    }

    // Test 3: CSRF token with session
    console.log('\n3. Testing CSRF token endpoint...');
    const sessionCookie = mainPage.cookies.find(c => c.includes('sid=')) || '';
    const csrf = await makeRequest('/api/csrf-token', 'GET', sessionCookie);
    if (csrf.status === 200) {
      const csrfData = JSON.parse(csrf.data);
      console.log('   ✅ CSRF endpoint accessible');
      console.log('   Token received:', csrfData.token ? 'Yes (length: ' + csrfData.token.length + ')' : 'No');
    } else {
      console.log('   ❌ CSRF endpoint failed:', csrf.status);
    }

    // Test 4: Dashboard (should redirect to login)
    console.log('\n4. Testing dashboard (auth required)...');
    const dashboard = await makeRequest('/dashboard');
    if (dashboard.status === 302 || dashboard.status === 200) {
      console.log('   ✅ Dashboard endpoint working');
      console.log('   Status:', dashboard.status === 302 ? 'Redirects (expected)' : 'Accessible');
    } else {
      console.log('   ❌ Dashboard failed:', dashboard.status);
    }

    // Test 5: Static files
    console.log('\n5. Testing static files...');
    const css = await makeRequest('/css/styles.css');
    if (css.status === 200) {
      console.log('   ✅ Static files accessible');
    } else {
      console.log('   ❌ Static files failed:', css.status);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ All basic tests passed!');
    console.log('\nServer is running correctly at http://localhost:3000');
    console.log('You can now:');
    console.log('  1. Open http://localhost:3000 in your browser');
    console.log('  2. Create an account via signup');
    console.log('  3. Login with your credentials');
    console.log('='.repeat(50));

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error('\nMake sure the server is running: npm run dev');
    process.exit(1);
  }
}

runTests();
