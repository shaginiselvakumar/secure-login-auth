# Email Setup Guide - Gmail SMTP

## 📧 How to Get Gmail App Password

To send emails from your application, you need to create a Gmail App Password. Follow these steps:

### Step 1: Enable 2-Factor Authentication

1. Go to your Google Account: https://myaccount.google.com/
2. Click on **Security** in the left sidebar
3. Under "How you sign in to Google", click **2-Step Verification**
4. Follow the prompts to enable 2FA (if not already enabled)

### Step 2: Generate App Password

1. After enabling 2FA, go back to **Security**
2. Under "How you sign in to Google", click **App passwords**
   - Or go directly to: https://myaccount.google.com/apppasswords
3. You may need to sign in again
4. In the "Select app" dropdown, choose **Mail**
5. In the "Select device" dropdown, choose **Other (Custom name)**
6. Type: **SecureCorp Login System**
7. Click **Generate**
8. Google will show you a 16-character password (like: `abcd efgh ijkl mnop`)
9. **Copy this password** - you won't be able to see it again!

### Step 3: Update .env File

1. Open `LOGIN AUTH/.env` file
2. Find the line: `SMTP_PASS=YOUR_GMAIL_APP_PASSWORD_HERE`
3. Replace `YOUR_GMAIL_APP_PASSWORD_HERE` with your app password
4. **Remove all spaces** from the password
   - Example: If password is `abcd efgh ijkl mnop`
   - Enter it as: `abcdefghijklmnop`

Your .env should look like:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=shaginiselvakumar07@gmail.com
SMTP_PASS=abcdefghijklmnop
EMAIL_FROM="SecureCorp <shaginiselvakumar07@gmail.com>"
```

### Step 4: Restart the Server

After updating the .env file:
```bash
# Stop the server (Ctrl+C)
# Start it again
npm start
```

## ✅ Testing Email

1. Go to: http://localhost:3000
2. Click "Forgot password?"
3. Enter your email: shaginiselvakumar07@gmail.com
4. Click "Send reset link"
5. Check your inbox (and spam folder)
6. You should receive an email with a reset link!

## 🔧 Troubleshooting

### "Invalid login" error
- Make sure you're using the **App Password**, not your regular Gmail password
- Make sure there are no spaces in the password
- Make sure 2FA is enabled on your Google account

### "Connection timeout" error
- Check your internet connection
- Make sure port 587 is not blocked by firewall
- Try changing `SMTP_PORT` to `465` and `SMTP_SECURE` to `true`

### Email not received
- Check your spam/junk folder
- Make sure the email address in SMTP_USER matches your Gmail
- Check server logs for error messages

### "Less secure app" error
- This shouldn't happen with App Passwords
- If it does, make sure you're using an App Password, not your regular password

## 🎯 Alternative: Use a Different Email Service

If Gmail doesn't work, you can use other services:

### SendGrid (Free tier: 100 emails/day)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY
EMAIL_FROM="SecureCorp <your-email@example.com>"
```

### Mailgun (Free tier: 5,000 emails/month)
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=YOUR_MAILGUN_PASSWORD
EMAIL_FROM="SecureCorp <noreply@your-domain.com>"
```

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=YOUR_OUTLOOK_PASSWORD
EMAIL_FROM="SecureCorp <your-email@outlook.com>"
```

## 📝 Important Notes

1. **Never commit your App Password to Git!**
   - The `.env` file is already in `.gitignore`
   - Never share your App Password publicly

2. **App Passwords are account-specific**
   - Each Google account needs its own App Password
   - You can create multiple App Passwords for different apps

3. **Revoke unused App Passwords**
   - Go to https://myaccount.google.com/apppasswords
   - Remove any App Passwords you're not using

4. **Production deployment**
   - Use environment variables on your hosting platform
   - Don't store passwords in code or config files
   - Consider using a dedicated email service (SendGrid, Mailgun, etc.)

## 🚀 Quick Start (TL;DR)

1. Enable 2FA on your Google account
2. Generate App Password at: https://myaccount.google.com/apppasswords
3. Copy the 16-character password (remove spaces)
4. Update `.env` file: `SMTP_PASS=your-app-password`
5. Restart server: `npm start`
6. Test forgot password feature!

---

**Need help?** Check the server logs for detailed error messages.
