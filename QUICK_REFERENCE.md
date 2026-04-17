# Quick Reference Guide

## Essential Commands

### Development
```bash
npm run dev          # Start development server with hot reload
npm run start        # Start production server
npm run check        # Validate setup and configuration
npm run test:server  # Test server endpoints
npm test             # Run test suite with coverage
```

### Setup
```bash
npm install          # Install dependencies
npm run setup        # Run setup check and install
node check-setup.js --generate-secrets  # Generate new secrets
```

### Windows
```bash
start.bat            # Automated setup and start
```

### Linux/Mac
```bash
chmod +x start.sh    # Make executable (first time only)
./start.sh           # Automated setup and start
```

## Important URLs

- **Main Application**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **CSRF Token**: http://localhost:3000/api/csrf-token
- **Dashboard**: http://localhost:3000/dashboard (requires login)
- **Signup**: http://localhost:3000/pages/signup.html
- **Forgot Password**: http://localhost:3000/pages/forgot-password.html
- **MFA Setup**: http://localhost:3000/pages/mfa.html

## Environment Variables

### Required
```env
SESSION_SECRET=<64-byte-hex>     # Session encryption key
CSRF_SECRET=<64-byte-hex>        # CSRF token secret (must differ from SESSION_SECRET)
ARGON2_PEPPER=<32-byte-hex>      # Password hashing pepper
```

### Optional
```env
NODE_ENV=development             # Environment (development/production)
PORT=3000                        # Server port
BASE_URL=http://localhost:3000   # Application URL
MONGODB_URI=mongodb://...        # MongoDB connection string
```

### Generate Secrets
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # CSRF_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # ARGON2_PEPPER
```

Or use:
```bash
node check-setup.js --generate-secrets
```

## Common Issues

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /F /PID <PID>

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

Or change PORT in .env:
```env
PORT=3001
```

### MongoDB Not Running
The application will automatically use in-memory storage if MongoDB is unavailable. This is fine for development but not for production.

To start MongoDB:
```bash
# Windows
net start MongoDB

# Linux
sudo systemctl start mongod

# Mac
brew services start mongodb-community
```

### Missing Dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### CSRF Token Issues
- Clear browser cookies and cache
- Ensure cookies are enabled
- Access via correct BASE_URL

## File Structure

```
LOGIN AUTH/
├── server/
│   ├── index.js              # Main server file
│   ├── routes/               # API routes
│   │   ├── auth.js           # Authentication
│   │   ├── mfa.js            # Multi-factor auth
│   │   └── password.js       # Password reset
│   ├── middleware/           # Express middleware
│   │   ├── csrfProtection.js
│   │   ├── rateLimiter.js
│   │   └── validateInput.js
│   └── utils/                # Utilities
│       ├── db.js             # Database abstraction
│       ├── hashPassword.js   # Password hashing
│       ├── totpHelper.js     # TOTP/MFA
│       ├── emailService.js   # Email sending
│       └── auditLogger.js    # Security logging
├── public/                   # Frontend files
│   ├── index.html            # Login page
│   ├── dashboard.html        # Dashboard
│   ├── js/                   # JavaScript
│   └── css/                  # Stylesheets
├── logs/                     # Log files
│   └── auth.log              # Security audit log
├── .env                      # Environment config
├── package.json              # Dependencies
├── README.md                 # Full documentation
├── TROUBLESHOOTING.md        # Troubleshooting guide
├── FIXES_SUMMARY.md          # Applied fixes
└── QUICK_REFERENCE.md        # This file
```

## Security Features

### Authentication
- ✅ Argon2id password hashing
- ✅ HIBP breach detection
- ✅ Account lockout (5 failed attempts)
- ✅ Rate limiting (per-IP and per-account)
- ✅ Session rotation on login
- ✅ Remember-me with secure tokens

### MFA
- ✅ TOTP (Google Authenticator compatible)
- ✅ Backup codes (8 single-use)
- ✅ SMS OTP (stub - requires provider)
- ✅ WebAuthn/Passkeys (FIDO2)

### Security Headers
- ✅ Content-Security-Policy
- ✅ Strict-Transport-Security (HSTS)
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ Referrer-Policy: no-referrer
- ✅ Permissions-Policy

### Protection
- ✅ CSRF protection (synchronizer token)
- ✅ SQL injection prevention
- ✅ XSS prevention
- ✅ Timing attack prevention
- ✅ Anti-enumeration
- ✅ Clickjacking prevention

## API Endpoints

### Public
- `GET /` - Login page
- `GET /api/health` - Health check
- `GET /api/csrf-token` - Get CSRF token
- `POST /api/auth/login` - Login
- `POST /api/auth/signup` - Create account
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Authenticated
- `GET /dashboard` - User dashboard
- `GET /api/auth/me` - Current user info
- `POST /api/auth/logout` - Logout
- `POST /api/auth/mfa/setup/initiate` - Start MFA setup
- `POST /api/auth/mfa/setup/verify` - Complete MFA setup
- `POST /api/auth/mfa/verify` - Verify TOTP code
- `POST /api/auth/mfa/backup` - Use backup code

### MFA Challenge (partial auth)
- `POST /api/auth/mfa/verify` - Verify TOTP
- `POST /api/auth/mfa/backup` - Use backup code
- `POST /api/auth/mfa/sms` - Request SMS OTP

## Development Tips

### Enable Debug Logging
```env
DEBUG=express:*
NODE_ENV=development
```

### Test Email Locally
```bash
npm install -g maildev
maildev
```

Then configure:
```env
SMTP_HOST=localhost
SMTP_PORT=1025
```

### Reset Database
**In-memory**: Just restart the server

**MongoDB**:
```bash
mongosh mongodb://127.0.0.1:27017/securecorp
db.dropDatabase()
```

### View Logs
```bash
# Real-time
tail -f logs/auth.log

# Windows
Get-Content logs/auth.log -Wait
```

## Production Checklist

Before deploying:

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong secrets (64+ bytes)
- [ ] Configure MongoDB or Redis
- [ ] Set up HTTPS/TLS (reverse proxy)
- [ ] Configure SMTP for emails
- [ ] Set up log aggregation
- [ ] Enable rate limiting with Redis
- [ ] Review security headers
- [ ] Run `npm audit` and fix issues
- [ ] Test backup/recovery
- [ ] Set up monitoring
- [ ] Configure firewall rules
- [ ] Enable automatic backups

## Monitoring

### Health Check
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-17T12:00:00.000Z",
  "environment": "development"
}
```

### Check Logs
```bash
tail -n 100 logs/auth.log
```

### Monitor Process
```bash
# CPU and memory usage
top -p $(pgrep -f "node server/index.js")

# Windows
tasklist | findstr node
```

## Support

- **Documentation**: See README.md
- **Troubleshooting**: See TROUBLESHOOTING.md
- **Fixes Applied**: See FIXES_SUMMARY.md
- **Setup Issues**: Run `npm run check`

## Useful Links

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
