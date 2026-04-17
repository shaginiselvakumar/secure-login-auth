'use strict';

/**
 * server/utils/emailService.js
 * Nodemailer-based email service.
 * In development: logs email content to console instead of sending.
 * In production: sends via SMTP using env-configured credentials.
 */

const nodemailer = require('nodemailer');
const { auditLogger } = require('./auditLogger');

const isDev = !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS;

// Create transporter lazily so missing env vars don't crash startup
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (isDev) {
    // Dev: use Ethereal (fake SMTP) or just log
    console.log('[EmailService] Running in development mode - emails will be logged to console');
    _transporter = nodemailer.createTransport({
      host:   'localhost',
      port:   1025,
      secure: false,
      ignoreTLS: true,
    });
  } else {
    // Production: use configured SMTP
    console.log('[EmailService] Configuring SMTP:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      secure: process.env.SMTP_SECURE === 'true'
    });
    
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return _transporter;
}

async function sendMail({ to, subject, text, html }) {
  if (isDev) {
    // In dev: log instead of sending — never expose reset URLs in prod logs
    auditLogger.logEvent('email_dev_stub', { to, subject });
    console.log(`[EmailService DEV] To: ${to} | Subject: ${subject}`);
    if (text) console.log(`[EmailService DEV] Body:\n${text}`);
    return { messageId: 'dev-stub' };
  }

  try {
    console.log(`[EmailService] Sending email to: ${to}`);
    console.log(`[EmailService] Subject: ${subject}`);
    
    const info = await getTransporter().sendMail({
      from:    process.env.EMAIL_FROM || '"SecureCorp" <noreply@securecorp.com>',
      to,
      subject,
      text,
      html,
    });
    
    console.log(`[EmailService] ✅ Email sent successfully! Message ID: ${info.messageId}`);
    auditLogger.logEvent('email_sent', { to, subject, messageId: info.messageId });
    return info;
  } catch (err) {
    console.error(`[EmailService] ❌ Failed to send email:`, err.message);
    console.error(`[EmailService] Error details:`, err);
    auditLogger.logEvent('email_send_failed', { to, subject, error: err.message });
    throw err;
  }
}

const emailService = {
  /**
   * Send a password reset link to the user.
   * @param {string} email
   * @param {string} resetUrl
   */
  async sendPasswordReset(email, resetUrl) {
    return sendMail({
      to:      email,
      subject: 'Reset your SecureCorp password',
      text:    `You requested a password reset.\n\nClick the link below (expires in 15 minutes):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
      html:    `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset your password</a> (expires in 15 minutes)</p><p>If you did not request this, ignore this email.</p>`,
    });
  },

  /**
   * Notify user that their password was changed.
   * @param {string} email
   */
  async sendPasswordChangedNotification(email) {
    return sendMail({
      to:      email,
      subject: 'Your SecureCorp password was changed',
      text:    'Your password was successfully changed. If you did not do this, contact support immediately.',
      html:    '<p>Your password was successfully changed.</p><p>If you did not do this, contact support immediately.</p>',
    });
  },

  /**
   * Send a welcome / account verification email.
   * @param {string} email
   * @param {string} name
   */
  async sendWelcome(email, name) {
    return sendMail({
      to:      email,
      subject: 'Welcome to SecureCorp',
      text:    `Hi ${name},\n\nYour account has been created successfully.`,
      html:    `<p>Hi ${name},</p><p>Your account has been created successfully.</p>`,
    });
  },
};

module.exports = emailService;
