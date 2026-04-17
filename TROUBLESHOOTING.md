# Troubleshooting Guide

## Quick Start Issues

### Server won't start

**Problem**: Server fails to start or crashes immediately

**Solutions**:
1. Check if port 3000 is already in use:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   
   # Linux/Mac
   lsof -i :3000
   ```

2. Verify Node.js version (18+ required):
   ```bash
   node -v
   ```

3. Check if all dependencies are installed:
   ```bash
   npm install
   ```

4. Verify .env file exists and has required values:
   ```bash
   # Copy from example if missing
   cp .env.example .env
   ```

### MongoDB Connection Issues

**Problem**: "MongoDB unavailable, using in-memory store"

**Solutions**:
1. Check if MongoDB is running:
   ```bash
   # Windows
   net start MongoDB
   
   # Linux/Mac
   sudo systemctl status mongod
   ```

2. Verify MONGODB_URI in .env:
   ```
   MONGODB_URI=mongodb://127.0.0.1:27017/securecorp
   ```

3. Test MongoDB connection:
   ```bash
   mongosh mongodb://127.0.0.1:27017/securecorp
   ```

**Note**: The application will work with in-memory storage for development, but data will be lost on restart.

### CSRF Token Errors

**Problem**: "Invalid or expired form token"

**Solutions**:
1. Clear browser cookies and cache
2. Ensure SESSION_SECRET and CSRF_SECRET are set in .env
3. Check if cookies are enabled in browser
4. Verify the application is accessed via the correct BASE_URL

### Login Issues

**Problem**: Cannot log in / "Invalid email or password"

**Solutions**:
1. For development, create a test account via signup
2. Check if account is locked (wait 15 minutes)
3. Verify email format is correct
4. Check server logs for detailed error messages

### Security Vulnerabilities

**Problem**: npm audit shows vulnerabilities

**Solutions**:
1. Update dependencies:
   ```bash
   npm update
   ```

2. For breaking changes:
   ```bash
   npm audit fix --force
   ```

3. Check for specific package updates:
   ```bash
   npm outdated
   ```

## Common Errors

### Error: EADDRINUSE

**Cause**: Port 3000 is already in use

**Solution**: 
- Kill the process using port 3000, or
- Change PORT in .env file:
  ```
  PORT=3001
  ```

### Error: Cannot find module

**Cause**: Missing dependencies

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Error: Session store unavailable

**Cause**: MongoDB connection failed

**Solution**: Application will use in-memory sessions. For production, ensure MongoDB is running or configure Redis.

### Error: SMTP not configured

**Cause**: Email service not set up

**Solution**: In development, emails are logged to console. For production, configure SMTP settings in .env:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Performance Issues

### Slow login/signup

**Possible causes**:
1. Argon2 hashing is CPU-intensive (this is intentional for security)
2. HIBP password check timeout
3. MongoDB connection latency

**Solutions**:
1. Ensure adequate CPU resources
2. Check network connectivity for HIBP API
3. Use local MongoDB instance for development

### High memory usage

**Cause**: In-memory session store with many sessions

**Solution**: Configure MongoDB or Redis session store for production

## Development Tips

### Enable debug logging

Add to .env:
```
DEBUG=express:*
NODE_ENV=development
```

### Test email functionality

Use a local SMTP server for testing:
```bash
# Install maildev
npm install -g maildev

# Run maildev
maildev

# Configure in .env
SMTP_HOST=localhost
SMTP_PORT=1025
```

### Reset database

For in-memory mode: Just restart the server

For MongoDB:
```bash
mongosh mongodb://127.0.0.1:27017/securecorp
db.dropDatabase()
```

## Production Checklist

Before deploying to production:

- [ ] Set NODE_ENV=production
- [ ] Generate strong secrets for SESSION_SECRET, CSRF_SECRET, ARGON2_PEPPER
- [ ] Configure MongoDB or Redis for sessions
- [ ] Set up HTTPS/TLS (use reverse proxy)
- [ ] Configure SMTP for emails
- [ ] Set up log aggregation (CloudWatch, Splunk, etc.)
- [ ] Enable rate limiting with Redis
- [ ] Review and test all security headers
- [ ] Run security audit: `npm audit`
- [ ] Test backup and recovery procedures

## Getting Help

If you're still experiencing issues:

1. Check the logs in `logs/auth.log`
2. Enable verbose logging
3. Review the README.md for configuration details
4. Check GitHub issues for similar problems
5. Ensure all environment variables are correctly set

## Useful Commands

```bash
# Check server status
curl http://localhost:3000/api/health

# Test CSRF token endpoint
curl http://localhost:3000/api/csrf-token

# View logs
tail -f logs/auth.log

# Check npm packages
npm list --depth=0

# Verify Node.js and npm versions
node -v && npm -v
```
