# Testing Instructions

## Automated Tests

### 1. Setup Check
Validates your environment and configuration:
```bash
npm run check
```

### 2. Server Tests
Tests all endpoints programmatically:
```bash
npm run test:server
```

## Manual Browser Testing

### Prerequisites
1. Server must be running: `npm run dev`
2. Open browser to: http://localhost:3000

### Test Signup Flow

1. **Navigate to Signup**
   - Click "Create account" link on login page
   - Or go directly to: http://localhost:3000/pages/signup.html

2. **Fill in the form**
   - Full name: Enter any name (min 2 characters)
   - Email: Enter a valid email format
   - Password: Enter at least 12 characters
   - Confirm password: Re-enter the same password

3. **Check password strength meter**
   - Should show strength indicator as you type
   - Colors: Red (weak) → Orange (fair) → Yellow (good) → Green (strong)

4. **Submit the form**
   - Click "Create account" button
   - Should see success message
   - Should auto-redirect to login page

5. **Expected Results**
   - ✅ Account created successfully
   - ✅ No CSRF token errors
   - ✅ Redirected to login page
   - ✅ Can now login with the credentials

### Test Login Flow

1. **Navigate to Login**
   - Go to: http://localhost:3000

2. **Enter credentials**
   - Email: Use the email from signup
   - Password: Use the password from signup
   - (Optional) Check "Remember me"

3. **Submit the form**
   - Click "Sign in" button
   - Should redirect to dashboard

4. **Expected Results**
   - ✅ Successfully logged in
   - ✅ Redirected to /dashboard
   - ✅ Dashboard shows welcome message
   - ✅ Shows your name and email

### Test Dashboard

1. **After login, you should see**
   - Welcome message with your name
   - Your email address
   - Login timestamp
   - Logout button
   - Settings button (placeholder)

2. **Test Logout**
   - Click "Sign out" button
   - Should redirect to login page
   - Session should be cleared

3. **Expected Results**
   - ✅ Dashboard displays correctly
   - ✅ Logout works
   - ✅ Cannot access dashboard after logout

### Test Password Reset Flow

1. **Navigate to Forgot Password**
   - Click "Forgot password?" on login page
   - Or go to: http://localhost:3000/pages/forgot-password.html

2. **Enter email**
   - Enter your registered email
   - Click "Send reset link"

3. **Check console/logs**
   - In development, reset link is logged to console
   - Check server terminal for the reset URL
   - Or check `logs/auth.log` file

4. **Use reset link**
   - Copy the reset URL from logs
   - Paste in browser
   - Enter new password (min 12 characters)
   - Confirm new password
   - Submit

5. **Expected Results**
   - ✅ Reset email "sent" (logged in dev mode)
   - ✅ Reset link works
   - ✅ Password successfully changed
   - ✅ Can login with new password

### Test Security Features

#### 1. CSRF Protection
- Try submitting forms without CSRF token
- Should see: "Invalid or expired form token"
- Refresh page and try again - should work

#### 2. Rate Limiting
- Try logging in with wrong password 5+ times
- Should see: "Account locked" or "Too many attempts"
- Wait 15 minutes or restart server to reset

#### 3. Password Strength
- Try weak passwords (< 12 chars)
- Should see: "Password must be at least 12 characters"
- Try common passwords
- Should see: "Password found in data breach" (if HIBP is reachable)

#### 4. Input Validation
- Try invalid email formats
- Try empty fields
- Should see appropriate error messages

#### 5. Session Management
- Login and close browser
- Reopen browser and go to /dashboard
- Without "Remember me": Should redirect to login
- With "Remember me": Should stay logged in

## Common Issues During Testing

### "Invalid or expired form token"
**Cause**: CSRF token issue
**Solution**: 
- Refresh the page
- Clear browser cookies
- Ensure server is running properly

### "Connection error"
**Cause**: Server not running or wrong port
**Solution**:
- Check server is running: `npm run dev`
- Verify port 3000 is not blocked
- Check firewall settings

### "Account locked"
**Cause**: Too many failed login attempts
**Solution**:
- Wait 15 minutes
- Or restart server (in dev mode with in-memory storage)

### Form doesn't submit
**Cause**: JavaScript error or validation failure
**Solution**:
- Open browser console (F12)
- Check for error messages
- Verify all fields are filled correctly

## Browser Console Checks

Open browser console (F12) and check for:

### No Errors
- Should not see any red error messages
- CSRF token should be fetched successfully

### Network Tab
- Check `/api/csrf-token` request - should return 200
- Check `/api/auth/signup` or `/api/auth/login` - should return 200 or 201
- Verify cookies are being set

### Application Tab (Chrome) / Storage Tab (Firefox)
- Check cookies:
  - `sid` or `__Host-sid` (session cookie)
  - `csrf` or `__Host-csrf` (CSRF cookie)
- Verify cookies have correct flags:
  - HttpOnly: ✓
  - Secure: ✓ (in production)
  - SameSite: Strict

## Security Headers Check

Open browser DevTools → Network → Select any request → Headers

Should see:
- `Content-Security-Policy`: Present
- `Strict-Transport-Security`: Present (in production)
- `X-Frame-Options`: DENY
- `X-Content-Type-Options`: nosniff
- `Referrer-Policy`: no-referrer

## Test Results Checklist

After completing all tests, verify:

- [ ] Signup works without CSRF errors
- [ ] Login works correctly
- [ ] Dashboard displays after login
- [ ] Logout works
- [ ] Password reset flow works
- [ ] CSRF protection is active
- [ ] Rate limiting works
- [ ] Input validation works
- [ ] Session management works
- [ ] Security headers are present
- [ ] No console errors
- [ ] Cookies are set correctly

## Reporting Issues

If you find any issues:

1. Check `TROUBLESHOOTING.md` first
2. Check server logs: `logs/auth.log`
3. Check browser console for errors
4. Note the exact steps to reproduce
5. Include error messages and screenshots

## Development Tips

### View Server Logs in Real-Time
```bash
# Windows
Get-Content logs/auth.log -Wait

# Linux/Mac
tail -f logs/auth.log
```

### Clear All Data (In-Memory Mode)
Just restart the server:
```bash
# Stop with Ctrl+C
# Start again
npm run dev
```

### Test with Different Browsers
- Chrome/Edge (Chromium)
- Firefox
- Safari (Mac only)

All should work identically.

### Test Mobile Responsiveness
- Open DevTools (F12)
- Click device toolbar icon
- Test on different screen sizes
- Forms should be usable on mobile

## Success Criteria

Your application is working correctly if:

1. ✅ All automated tests pass (`npm run test:server`)
2. ✅ Signup creates account without errors
3. ✅ Login works with correct credentials
4. ✅ Dashboard is accessible after login
5. ✅ Logout clears session
6. ✅ No CSRF token errors
7. ✅ Security headers are present
8. ✅ No console errors in browser
9. ✅ Rate limiting prevents brute force
10. ✅ Input validation works correctly

---

**All tests passing?** Your secure login system is ready! 🎉
