#!/usr/bin/env node

/**
 * Test email sending
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('\n📧 Testing Email Configuration...\n');
  
  console.log('SMTP Settings:');
  console.log('  Host:', process.env.SMTP_HOST);
  console.log('  Port:', process.env.SMTP_PORT);
  console.log('  User:', process.env.SMTP_USER);
  console.log('  Pass:', process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : 'NOT SET');
  console.log('  From:', process.env.EMAIL_FROM);
  console.log('');
  
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ SMTP not configured! Check your .env file.');
    process.exit(1);
  }
  
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  
  console.log('🔄 Sending test email...\n');
  
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"SecureCorp" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: '✅ Test Email from SecureCorp Login System',
      text: 'Congratulations! Your email configuration is working correctly.\n\nYou can now use the forgot password feature.',
      html: '<h2>✅ Success!</h2><p><strong>Congratulations!</strong></p><p>Your email configuration is working correctly.</p><p>You can now use the forgot password feature.</p>',
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Check your inbox:', process.env.SMTP_USER);
    console.log('\n💡 If you don\'t see it, check your spam/junk folder!\n');
    
  } catch (err) {
    console.error('\n❌ Failed to send email!\n');
    console.error('Error:', err.message);
    console.error('\n🔧 Common issues:');
    console.error('  - Wrong App Password (must be 16 characters, no spaces)');
    console.error('  - 2FA not enabled on Gmail');
    console.error('  - Using regular password instead of App Password');
    console.error('  - Internet connection issues');
    console.error('  - Gmail blocking the login attempt\n');
    process.exit(1);
  }
}

testEmail();
