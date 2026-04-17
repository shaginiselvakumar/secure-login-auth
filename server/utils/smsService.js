'use strict';

/**
 * server/utils/smsService.js
 * SMS OTP service stub.
 * In development: logs OTP to console instead of sending.
 * In production: integrate with a real SMS provider (Twilio, AWS SNS, etc.)
 */

const { auditLogger } = require('./auditLogger');

const isDev = process.env.NODE_ENV !== 'production';

const smsService = {
  /**
   * Send a one-time passcode to a phone number.
   * @param {string} phoneNumber  E.164 format, e.g. "+15551234567"
   * @param {string} otp          6-digit numeric code
   */
  async sendOTP(phoneNumber, otp) {
    if (isDev) {
      // In dev: log OTP — never do this in production
      auditLogger.logEvent('sms_dev_stub', { phone: phoneNumber.slice(-4) }); // log last 4 digits only
      console.log(`[SmsService DEV] OTP for ${phoneNumber}: ${otp}`);
      return { success: true, stub: true };
    }

    // Production: replace with real SMS provider
    // Example (Twilio):
    // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await twilio.messages.create({
    //   body: `Your SecureCorp verification code is: ${otp}`,
    //   from: process.env.TWILIO_FROM_NUMBER,
    //   to:   phoneNumber,
    // });

    throw new Error('SMS provider not configured. Set up a provider in server/utils/smsService.js');
  },
};

module.exports = smsService;
