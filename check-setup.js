#!/usr/bin/env node

/**
 * Pre-flight setup checker
 * Validates environment and dependencies before starting the server
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔍 SecureCorp Login System - Setup Checker\n');

let hasErrors = false;
let hasWarnings = false;

// Check Node.js version
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  if (major < 18) {
    console.error('❌ Node.js version 18 or higher is required');
    console.error(`   Current version: ${version}`);
    hasErrors = true;
  } else {
    console.log(`✅ Node.js version: ${version}`);
  }
}

// Check if .env file exists
function checkEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    console.error('   Run: cp .env.example .env');
    hasErrors = true;
    return false;
  }
  
  console.log('✅ .env file exists');
  return true;
}

// Check environment variables
function checkEnvVariables() {
  require('dotenv').config();
  
  const required = [
    'SESSION_SECRET',
    'CSRF_SECRET',
    'ARGON2_PEPPER'
  ];
  
  const recommended = [
    'BASE_URL',
    'PORT'
  ];
  
  console.log('\n📋 Environment Variables:');
  
  for (const key of required) {
    if (!process.env[key] || process.env[key].includes('REPLACE')) {
      console.error(`   ❌ ${key} is not set or uses placeholder value`);
      hasErrors = true;
    } else if (process.env[key].length < 32) {
      console.warn(`   ⚠️  ${key} is too short (should be 32+ characters)`);
      hasWarnings = true;
    } else {
      console.log(`   ✅ ${key} is set`);
    }
  }
  
  for (const key of recommended) {
    if (!process.env[key]) {
      console.warn(`   ⚠️  ${key} is not set (using default)`);
      hasWarnings = true;
    } else {
      console.log(`   ✅ ${key} is set`);
    }
  }
  
  // Check if secrets are different
  if (process.env.SESSION_SECRET === process.env.CSRF_SECRET) {
    console.error('   ❌ SESSION_SECRET and CSRF_SECRET must be different');
    hasErrors = true;
  }
}

// Check dependencies
function checkDependencies() {
  console.log('\n📦 Dependencies:');
  
  const packageJson = require('./package.json');
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('   ❌ node_modules not found');
    console.error('      Run: npm install');
    hasErrors = true;
    return;
  }
  
  const criticalDeps = [
    'express',
    'argon2',
    'bcrypt',
    'helmet',
    'express-session',
    'csrf-csrf'
  ];
  
  for (const dep of criticalDeps) {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      console.log(`   ✅ ${dep}`);
    } else {
      console.error(`   ❌ ${dep} not installed`);
      hasErrors = true;
    }
  }
}

// Check port availability
function checkPort() {
  const net = require('net');
  const port = process.env.PORT || 3000;
  
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`\n⚠️  Port ${port} is already in use`);
        console.warn('   Change PORT in .env or stop the other process');
        hasWarnings = true;
      }
      resolve();
    });
    
    server.once('listening', () => {
      server.close();
      console.log(`\n✅ Port ${port} is available`);
      resolve();
    });
    
    server.listen(port);
  });
}

// Check MongoDB connection (optional)
async function checkMongoDB() {
  if (!process.env.MONGODB_URI) {
    console.log('\n⚠️  MongoDB not configured (using in-memory storage)');
    console.log('   This is OK for development but not for production');
    hasWarnings = true;
    return;
  }
  
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 3000
    });
    console.log('\n✅ MongoDB connection successful');
    await mongoose.disconnect();
  } catch (err) {
    console.warn('\n⚠️  MongoDB connection failed:', err.message);
    console.warn('   Application will use in-memory storage');
    hasWarnings = true;
  }
}

// Check logs directory
function checkLogsDirectory() {
  const logsPath = path.join(__dirname, 'logs');
  
  if (!fs.existsSync(logsPath)) {
    try {
      fs.mkdirSync(logsPath, { recursive: true });
      console.log('\n✅ Created logs directory');
    } catch (err) {
      console.error('\n❌ Failed to create logs directory:', err.message);
      hasErrors = true;
    }
  } else {
    console.log('\n✅ Logs directory exists');
  }
}

// Generate secrets helper
function generateSecrets() {
  console.log('\n🔐 Generate new secrets for .env:');
  console.log('\nSESSION_SECRET=' + crypto.randomBytes(64).toString('hex'));
  console.log('CSRF_SECRET=' + crypto.randomBytes(64).toString('hex'));
  console.log('ARGON2_PEPPER=' + crypto.randomBytes(32).toString('hex'));
}

// Main check function
async function runChecks() {
  checkNodeVersion();
  
  if (checkEnvFile()) {
    checkEnvVariables();
  }
  
  checkDependencies();
  checkLogsDirectory();
  await checkPort();
  await checkMongoDB();
  
  console.log('\n' + '='.repeat(50));
  
  if (hasErrors) {
    console.log('\n❌ Setup check FAILED - Please fix the errors above');
    console.log('\nFor help, see TROUBLESHOOTING.md');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  Setup check completed with warnings');
    console.log('   The application will run but some features may not work');
    console.log('\n✅ You can start the server with: npm run dev');
  } else {
    console.log('\n✅ All checks passed! Ready to start the server');
    console.log('\n🚀 Start with: npm run dev');
  }
  
  // Offer to generate secrets if needed
  if (process.argv.includes('--generate-secrets')) {
    generateSecrets();
  }
}

// Run checks
runChecks().catch(err => {
  console.error('\n❌ Setup check failed:', err.message);
  process.exit(1);
});
