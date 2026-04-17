# 🔐 Secure Login & Authentication System

A production-ready, secure authentication system built with Node.js, Express, and MongoDB. Features include user registration, login, password reset, multi-factor authentication (MFA), and comprehensive security measures.

## ✨ Features

### Core Authentication
- ✅ **User Registration** with email verification
- ✅ **Secure Login** with session management
- ✅ **Password Reset** via email with single-use tokens
- ✅ **Remember Me** functionality with secure tokens
- ✅ **Multi-Factor Authentication (MFA)** with TOTP (Google Authenticator, Authy)

### Security Features
- 🔒 **Password Security**
  - Argon2id hashing with pepper
  - Minimum 12 characters with complexity requirements
  - Real-time password strength meter
  - HIBP (Have I Been Pwned) breach check
- 🛡️ **Protection Mechanisms**
  - CSRF protection on all forms
  - Rate limiting on sensitive endpoints
  - Session encryption and secure cookies
  - Helmet.js security headers (CSP, HSTS, etc.)
  - Input validation and sanitization
- 📝 **Audit Logging**
  - All authentication events logged
  - Failed login attempts tracked
  - Security events monitored

### User Experience
- 🎨 Modern, responsive UI with glassmorphism design
- ♿ Accessible (ARIA labels, keyboard navigation)
- 📱 Mobile-friendly
- 🌙 Clean, professional interface
- ⚡ Real-time form validation

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- MongoDB Atlas account (free tier works)
- Gmail account (for email functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd LOGIN\ AUTH
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your credentials:
   - `MONGODB_URI`: Your MongoDB connection string
   - `SESSION_SECRET`, `CSRF_SECRET`, `ARGON2_PEPPER`: Generate with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
     ```
   - `SMTP_USER` and `SMTP_PASS`: Your Gmail and App Password

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📧 Email Setup (Gmail)

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Copy the 16-character password
3. Add to `.env`:
   ```
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   ```

For detailed setup instructions, see [EMAIL_SETUP_GUIDE.md](EMAIL_SETUP_GUIDE.md)

## 🗄️ Database Setup (MongoDB Atlas)

1. Create a free account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster (free M0 tier)
3. Create a database user with read/write permissions
4. Whitelist your IP address (or use 0.0.0.0/0 for development)
5. Get your connection string and add to `.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
   ```

The database schema will be created automatically on first run.

## 📁 Project Structure

```
LOGIN AUTH/
├── server/
│   ├── index.js              # Main server file
│   ├── routes/
│   │   ├── auth.js           # Login, signup, logout routes
│   │   ├── password.js       # Password reset routes
│   │   └── mfa.js            # MFA setup and verification
│   ├── middleware/
│   │   ├── csrfProtection-simple.js  # CSRF protection
│   │   ├── rateLimiter.js    # Rate limiting
│   │   └── validateInput.js  # Input validation
│   └── utils/
│       ├── db.js             # Database operations
│       ├── emailService.js   # Email sending
│       ├── hashPassword.js   # Password hashing
│       ├── hibpCheck.js      # Breach checking
│       ├── sessionStore.js   # Session management
│       ├── totpHelper.js     # MFA/TOTP utilities
│       └── auditLogger.js    # Security logging
├── public/
│   ├── index.html            # Login page
│   ├── dashboard.html        # Protected dashboard
│   ├── pages/
│   │   ├── signup.html       # Registration page
│   │   ├── forgot-password.html
│   │   ├── reset-password.html
│   │   └── mfa.html          # MFA setup page
│   ├── js/                   # Client-side JavaScript
│   └── css/
│       └── styles.css        # Unified styles
├── .env.example              # Environment template
├── package.json
└── README.md
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Server port (default: 3000) | Yes |
| `BASE_URL` | Full URL of your app | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `SESSION_SECRET` | Session encryption key (64 bytes hex) | Yes |
| `CSRF_SECRET` | CSRF token secret (64 bytes hex) | Yes |
| `ARGON2_PEPPER` | Password hashing pepper (32 bytes hex) | Yes |
| `SMTP_HOST` | SMTP server (smtp.gmail.com) | Yes |
| `SMTP_PORT` | SMTP port (587) | Yes |
| `SMTP_USER` | Email address | Yes |
| `SMTP_PASS` | Email password/app password | Yes |
| `EMAIL_FROM` | From address for emails | Yes |

### Security Configuration

The app includes production-ready security:
- **Helmet.js** with strict CSP, HSTS, and security headers
- **Rate limiting** on auth endpoints (3-5 attempts per hour)
- **Session security** with httpOnly, secure, sameSite cookies
- **CSRF protection** on all state-changing operations
- **Input validation** with express-validator

## 🧪 Testing

### Manual Testing
1. **Registration**: Create a new account
2. **Login**: Sign in with credentials
3. **Password Reset**: Test forgot password flow
4. **MFA Setup**: Enable 2FA with authenticator app
5. **Remember Me**: Test persistent login

### Test Email
```bash
node test-email.js
```

### Check Setup
```bash
node check-setup.js
```

## 📚 Documentation

- [COMPLETE_SETUP.md](COMPLETE_SETUP.md) - Comprehensive setup guide
- [EMAIL_SETUP_GUIDE.md](EMAIL_SETUP_GUIDE.md) - Email configuration
- [TESTING_INSTRUCTIONS.md](TESTING_INSTRUCTIONS.md) - Testing guide
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Quick commands
- [FIXES_SUMMARY.md](FIXES_SUMMARY.md) - Recent fixes

## 🔒 Security Best Practices

### For Development
- Never commit `.env` file
- Use strong, unique secrets
- Keep dependencies updated
- Test on localhost only

### For Production
- Use HTTPS (required for secure cookies)
- Set `NODE_ENV=production`
- Use environment-specific secrets
- Enable MongoDB authentication
- Use Redis for session store (recommended)
- Set up monitoring and alerts
- Regular security audits
- Keep all dependencies updated

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Use production MongoDB cluster
3. Generate new production secrets
4. Configure HTTPS/TLS
5. Set up Redis for sessions (recommended)

### Recommended Platforms
- **Heroku**: Easy deployment with add-ons
- **Railway**: Modern, simple deployment
- **DigitalOcean**: Full control with droplets
- **AWS/Azure/GCP**: Enterprise-grade infrastructure

### Reverse Proxy (Production)
Use nginx or Caddy to:
- Terminate TLS/SSL
- Handle static files
- Load balancing
- Rate limiting

Example nginx config:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: Passport.js, express-session
- **Security**: Helmet.js, express-rate-limit, csrf-csrf
- **Password**: Argon2, HIBP API
- **MFA**: speakeasy (TOTP)
- **Email**: Nodemailer (SMTP)
- **Validation**: express-validator
- **Logging**: Winston

## 📝 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Password Management
- `POST /api/auth/forgot-password` - Request reset
- `POST /api/auth/reset-password` - Reset password

### MFA
- `POST /api/auth/mfa/setup` - Generate MFA secret
- `POST /api/auth/mfa/verify` - Verify and enable MFA
- `POST /api/auth/mfa/validate` - Validate MFA code

### Utility
- `GET /api/csrf-token` - Get CSRF token
- `GET /api/health` - Health check

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use this project for learning or production.

## 🙏 Acknowledgments

- Security best practices from OWASP
- UI inspiration from modern design systems
- Community feedback and contributions

## 📞 Support

For issues or questions:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review existing GitHub issues
3. Create a new issue with details

## 🔄 Updates

### Recent Changes
- ✅ Fixed password reset functionality
- ✅ Added real-time password strength meter
- ✅ Implemented CSP-compliant styling
- ✅ Enhanced email service configuration
- ✅ Improved error handling and validation

---

**Built with ❤️ for secure authentication**
