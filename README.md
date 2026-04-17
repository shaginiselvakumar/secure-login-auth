# 🔐 Secure Authentication System

A production-ready authentication system built with Node.js, Express, and MongoDB. Features secure login, registration, password reset, and multi-factor authentication.

## ✨ Features

- **User Authentication**: Secure registration and login with session management
- **Password Reset**: Email-based password recovery with single-use tokens
- **Multi-Factor Authentication (MFA)**: TOTP-based 2FA support
- **Security**: Argon2 password hashing, CSRF protection, rate limiting, HIBP breach checking
- **Modern UI**: Responsive design with real-time validation

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MongoDB Atlas account
- Gmail account (for email functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/shaginiselvakumar/secure-login-auth.git
   cd secure-login-auth
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your credentials:
   - MongoDB connection string
   - Session secrets (generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
   - Gmail SMTP credentials

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
├── server/
│   ├── index.js              # Main server
│   ├── routes/               # API routes
│   ├── middleware/           # CSRF, rate limiting, validation
│   └── utils/                # Database, email, security utilities
├── public/
│   ├── index.html            # Login page
│   ├── pages/                # Signup, password reset, MFA
│   ├── js/                   # Client-side scripts
│   └── css/                  # Styles
├── tests/                    # Test files
├── .env.example              # Environment template
└── package.json
```

## 🔧 Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Environment (development/production) |
| `PORT` | Server port (default: 3000) |
| `BASE_URL` | Full URL of your application |
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | Session encryption key |
| `CSRF_SECRET` | CSRF token secret |
| `ARGON2_PEPPER` | Password hashing pepper |
| `SMTP_HOST` | SMTP server (smtp.gmail.com) |
| `SMTP_PORT` | SMTP port (587) |
| `SMTP_USER` | Email address |
| `SMTP_PASS` | Email app password |
| `EMAIL_FROM` | From address for emails |

## 🔒 Security Features

- **Password Security**: Argon2id hashing with pepper, minimum 12 characters, complexity requirements
- **CSRF Protection**: Token-based protection on all state-changing operations
- **Rate Limiting**: Prevents brute force attacks on authentication endpoints
- **Session Security**: Encrypted sessions with httpOnly, secure, sameSite cookies
- **Input Validation**: Server-side validation with express-validator
- **Audit Logging**: All authentication events logged
- **HIBP Integration**: Checks passwords against known breaches

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: express-session, Passport.js
- **Security**: Helmet.js, express-rate-limit, Argon2
- **MFA**: speakeasy (TOTP)
- **Email**: Nodemailer

## 📝 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Password Management
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### MFA
- `POST /api/auth/mfa/setup` - Generate MFA secret
- `POST /api/auth/mfa/verify` - Enable MFA
- `POST /api/auth/mfa/validate` - Validate MFA code

## 🚀 Deployment

### Render
1. Push code to GitHub
2. Create new Web Service on Render
3. Connect your repository
4. Add environment variables
5. Deploy!

### Environment Setup for Production
- Set `NODE_ENV=production`
- Use production MongoDB cluster
- Generate new production secrets
- Configure HTTPS/TLS
- Use Redis for session store (recommended)

## 🧪 Testing

Run tests:
```bash
npm test
```

## 📄 License

MIT License - free to use for personal and commercial projects.

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a pull request.

---

**Built with ❤️ for secure authentication**
