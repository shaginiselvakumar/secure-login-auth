#!/usr/bin/env node

/**
 * Email Setup Helper
 * Helps you configure Gmail SMTP for sending emails
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('\n📧 Email Setup Helper\n');
  console.log('This will help you configure Gmail SMTP for sending password reset emails.\n');
  
  console.log('📋 Prerequisites:');
  console.log('1. A Gmail account');
  console.log('2. 2-Factor Authentication enabled');
  console.log('3. An App Password generated\n');
  
  const hasAppPassword = await question('Do you have a Gmail App Password? (yes/no): ');
  
  if (hasAppPassword.toLowerCase() !== 'yes') {
    console.log('\n🔗 Follow these steps to get your App Password:');
    console.log('1. Go to: https://myaccount.google.com/apppasswords');
    console.log('2. Sign in to your Google account');
    console.log('3. Select "Mail" and "Other (Custom name)"');
    console.log('4. Enter "SecureCorp Login" as the name');
    console.log('5. Click "Generate"');
    console.log('6. Copy the 16-character password (remove spaces)\n');
    console.log('📖 For detailed instructions, see: EMAIL_SETUP_GUIDE.md\n');
    
    const ready = await question('Press Enter when you have your App Password...');
  }
  
  console.log('\n✏️  Enter your email configuration:\n');
  
  const email = await question('Gmail address (e.g., your-email@gmail.com): ');
  const appPassword = await question('Gmail App Password (16 characters, no spaces): ');
  const fromName = await question('Sender name (e.g., SecureCorp): ');
  
  // Validate
  if (!email.includes('@gmail.com')) {
    console.log('\n❌ Error: Please use a Gmail address (@gmail.com)');
    rl.close();
    return;
  }
  
  if (appPassword.length !== 16) {
    console.log('\n⚠️  Warning: App Password should be 16 characters');
    console.log('   Make sure you removed all spaces!');
  }
  
  // Update .env file
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check if SMTP config already exists
  if (envContent.includes('SMTP_HOST=')) {
    // Update existing
    envContent = envContent.replace(/SMTP_USER=.*/,  `SMTP_USER=${email}`);
    envContent = envContent.replace(/SMTP_PASS=.*/,  `SMTP_PASS=${appPassword}`);
    envContent = envContent.replace(/EMAIL_FROM=.*/, `EMAIL_FROM="${fromName} <${email}>"`);
  } else {
    // Add new
    envContent += `\n# Email Configuration\n`;
    envContent += `SMTP_HOST=smtp.gmail.com\n`;
    envContent += `SMTP_PORT=587\n`;
    envContent += `SMTP_SECURE=false\n`;
    envContent += `SMTP_USER=${email}\n`;
    envContent += `SMTP_PASS=${appPassword}\n`;
    envContent += `EMAIL_FROM="${fromName} <${email}>"\n`;
  }
  
  // Make sure NODE_ENV is production for emails to send
  if (envContent.includes('NODE_ENV=development')) {
    envContent = envContent.replace('NODE_ENV=development', 'NODE_ENV=production');
    console.log('\n✅ Changed NODE_ENV to production (required for sending emails)');
  }
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ Email configuration saved to .env file!');
  console.log('\n🚀 Next steps:');
  console.log('1. Restart your server: npm start');
  console.log('2. Test forgot password: http://localhost:3000');
  console.log('3. Check your inbox (and spam folder)!\n');
  
  const testNow = await question('Would you like to test the email now? (yes/no): ');
  
  if (testNow.toLowerCase() === 'yes') {
    console.log('\n🧪 Testing email configuration...\n');
    
    // Load the updated env
    require('dotenv').config();
    
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host:   'smtp.gmail.com',
      port:   587,
      secure: false,
      auth: {
        user: email,
        pass: appPassword,
      },
    });
    
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${email}>`,
        to: email,
        subject: 'Test Email from SecureCorp Login System',
        text: 'Congratulations! Your email configuration is working correctly.',
        html: '<p><strong>Congratulations!</strong></p><p>Your email configuration is working correctly.</p><p>You can now use the forgot password feature.</p>',
      });
      
      console.log('✅ Test email sent successfully!');
      console.log(`📧 Message ID: ${info.messageId}`);
      console.log(`\n📬 Check your inbox: ${email}`);
      console.log('   (Don\'t forget to check spam folder!)\n');
    } catch (err) {
      console.error('\n❌ Failed to send test email:');
      console.error(err.message);
      console.log('\n🔧 Troubleshooting:');
      console.log('- Make sure you\'re using the App Password, not your regular password');
      console.log('- Make sure there are no spaces in the password');
      console.log('- Make sure 2FA is enabled on your Google account');
      console.log('- Check your internet connection\n');
    }
  }
  
  rl.close();
}

setup().catch(err => {
  console.error('Error:', err.message);
  rl.close();
});
