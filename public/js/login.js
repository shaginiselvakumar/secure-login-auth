'use strict';

(function () {
  const TIMEOUT = 10000;

  // ── Shared ──
  const alertBox   = document.getElementById('alert-box');
  const tabSignin  = document.getElementById('tab-signin');
  const tabSignup  = document.getElementById('tab-signup');
  const panelSignin= document.getElementById('panel-signin');
  const panelSignup= document.getElementById('panel-signup');

  // ── Sign-in form ──
  const loginForm  = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const pwInput    = document.getElementById('password');
  const submitBtn  = document.getElementById('submit-btn');
  const csrfField  = document.getElementById('csrf-token');
  const capsWarn   = document.getElementById('caps-warning');
  const togglePw   = document.getElementById('toggle-pw');
  const rememberMe = document.getElementById('remember-me');

  // ── Sign-up form ──
  const signupForm    = document.getElementById('signup-form');
  const suName        = document.getElementById('su-name');
  const suEmail       = document.getElementById('su-email');
  const suPw          = document.getElementById('su-password');
  const suConfirm     = document.getElementById('su-confirm');
  const signupBtn     = document.getElementById('signup-btn');
  const csrfSignup    = document.getElementById('csrf-token-signup');
  const suStrengthFill= document.getElementById('su-strength-fill');
  const suStrengthLbl = document.getElementById('su-strength-label');

  init();

  function init() {
    fetchCsrfToken();
    emailInput.focus();

    // Tab switching
    tabSignin.addEventListener('click', () => switchTab('signin'));
    tabSignup.addEventListener('click', () => switchTab('signup'));

    // Sign-in events
    loginForm.addEventListener('submit', handleLogin);
    emailInput.addEventListener('blur', () => validateEmail(true));
    pwInput.addEventListener('blur',    () => validateLoginPw(true));
    emailInput.addEventListener('focus',() => clearErr('email-error'));
    pwInput.addEventListener('focus',   () => clearErr('password-error'));
    pwInput.addEventListener('keyup',   detectCapsLock);
    pwInput.addEventListener('keydown', detectCapsLock);
    togglePw.addEventListener('click',  () => toggleVis(pwInput, togglePw));

    // Sign-up events
    signupForm.addEventListener('submit', handleSignup);
    suPw.addEventListener('input', updateStrength);
    suPw.addEventListener('blur',  () => validateSuPw(true));
    suConfirm.addEventListener('blur', () => validateConfirm(true));
    suEmail.addEventListener('blur', () => validateSuEmail(true));
    document.getElementById('toggle-su-pw').addEventListener('click',
      () => toggleVis(suPw, document.getElementById('toggle-su-pw')));
    document.getElementById('toggle-su-confirm').addEventListener('click',
      () => toggleVis(suConfirm, document.getElementById('toggle-su-confirm')));

    // Check if URL has ?tab=signup
    if (new URLSearchParams(window.location.search).get('tab') === 'signup') {
      switchTab('signup');
    }
  }

  // ── Tab switching ──
  function switchTab(tab) {
    clearAlert();
    if (tab === 'signin') {
      tabSignin.classList.add('active');
      tabSignin.setAttribute('aria-selected', 'true');
      tabSignup.classList.remove('active');
      tabSignup.setAttribute('aria-selected', 'false');
      panelSignin.hidden = false;
      panelSignup.hidden = true;
      emailInput.focus();
    } else {
      tabSignup.classList.add('active');
      tabSignup.setAttribute('aria-selected', 'true');
      tabSignin.classList.remove('active');
      tabSignin.setAttribute('aria-selected', 'false');
      panelSignup.hidden = false;
      panelSignin.hidden = true;
      suName.focus();
    }
  }

  // ── CSRF ──
  async function fetchCsrfToken() {
    try {
      const res = await fetchWithTimeout('/api/csrf-token', { credentials: 'same-origin' });
      if (res.ok) {
        const { token } = await res.json();
        csrfField.value  = token || '';
        csrfSignup.value = token || '';
      }
    } catch { console.warn('CSRF fetch failed'); }
  }

  function fetchWithTimeout(url, opts = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
  }

  // ── Caps lock ──
  function detectCapsLock(e) {
    if (e.getModifierState) capsWarn.hidden = !e.getModifierState('CapsLock');
  }

  // ── Toggle password visibility ──
  function toggleVis(input, btn) {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', show ? 'true' : 'false');
    btn.setAttribute('aria-label',   show ? 'Hide password' : 'Show password');
  }

  // ── Sign-in validation ──
  function validateEmail(show) {
    const val = emailInput.value.trim();
    if (!val || !/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(val) || val.length > 254) {
      if (show) setErr('email-error', val ? 'Enter a valid email address' : 'Email is required');
      return false;
    }
    clearErr('email-error');
    return true;
  }

  function validateLoginPw(show) {
    if (!pwInput.value) {
      if (show) setErr('password-error', 'Password is required');
      return false;
    }
    clearErr('password-error');
    return true;
  }

  // ── Sign-in submit ──
  async function handleLogin(e) {
    e.preventDefault();
    clearAlert();
    if (!validateEmail(true) | !validateLoginPw(true)) { shakeCard(); return; }

    setLoading(submitBtn, true);
    try {
      const res = await fetchWithTimeout('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email:       emailInput.value.trim().toLowerCase(),
          password:    pwInput.value,
          remember_me: rememberMe.checked,
          _csrf:       csrfField.value,
        }),
      });

      const data = await res.json();

      if (res.status === 429) { showAlert('error', `Too many attempts. Try again in ${data.retryAfter || 15} min.`); return; }
      if (res.status === 423) { showAlert('error', 'Account locked. Too many failed attempts.'); return; }
      if (!res.ok) {
        showAlert('error', 'Invalid email or password.');
        pwInput.value = ''; pwInput.focus(); shakeCard();
        fetchCsrfToken();
        return;
      }
      if (data.requiresMfa) { window.location.href = '/pages/mfa.html'; return; }
      window.location.href = data.redirectTo || '/dashboard';

    } catch (err) {
      showAlert('error', err.name === 'AbortError' ? 'Request timed out.' : 'Connection error.');
    } finally {
      setLoading(submitBtn, false);
    }
  }

  // ── Sign-up validation ──
  function scorePassword(pw) {
    let s = 0;
    if (pw.length >= 12) s++;
    if (pw.length >= 16) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  function updateStrength() {
    const pw = suPw.value;
    if (!pw) { suStrengthFill.style.width = '0'; suStrengthLbl.textContent = ''; return; }
    const score  = scorePassword(pw);
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
    const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];
    suStrengthFill.style.width      = (score / 5 * 100) + '%';
    suStrengthFill.style.background = colors[score] || colors[1];
    suStrengthLbl.textContent       = labels[score] || 'Weak';
  }

  function validateSuEmail(show) {
    const val = suEmail.value.trim();
    if (!val || !/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
      if (show) setErr('su-email-error', 'Enter a valid email address');
      return false;
    }
    clearErr('su-email-error');
    return true;
  }

  function validateSuPw(show) {
    if (suPw.value.length < 12) {
      if (show) setErr('su-password-error', 'Password must be at least 12 characters');
      return false;
    }
    clearErr('su-password-error');
    return true;
  }

  function validateConfirm(show) {
    if (suPw.value !== suConfirm.value) {
      if (show) setErr('su-confirm-error', 'Passwords do not match');
      return false;
    }
    clearErr('su-confirm-error');
    return true;
  }

  function validateSuName(show) {
    if (suName.value.trim().length < 2) {
      if (show) setErr('su-name-error', 'Please enter your full name');
      return false;
    }
    clearErr('su-name-error');
    return true;
  }

  // ── Sign-up submit ──
  async function handleSignup(e) {
    e.preventDefault();
    clearAlert();
    // Use bitwise & so all fields validate (show all errors at once)
    if (!(validateSuName(true) & validateSuEmail(true) & validateSuPw(true) & validateConfirm(true))) {
      shakeCard(); return;
    }

    setLoading(signupBtn, true);
    try {
      const res = await fetchWithTimeout('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name:     suName.value.trim(),
          email:    suEmail.value.trim().toLowerCase(),
          password: suPw.value,
          _csrf:    csrfSignup.value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert('error', data.error || 'Registration failed. Please try again.');
        fetchCsrfToken();
        return;
      }

      showAlert('success', 'Account created! Signing you in...');
      // Auto sign-in after signup
      setTimeout(async () => {
        await autoLogin(suEmail.value.trim().toLowerCase(), suPw.value);
      }, 800);

    } catch (err) {
      showAlert('error', err.name === 'AbortError' ? 'Request timed out.' : 'Connection error.');
    } finally {
      setLoading(signupBtn, false);
    }
  }

  // Auto-login after signup
  async function autoLogin(email, password) {
    try {
      await fetchCsrfToken();
      const res = await fetchWithTimeout('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, _csrf: csrfField.value }),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = data.redirectTo || '/dashboard';
      } else {
        showAlert('info', 'Account created. Please sign in.');
        switchTab('signin');
        emailInput.value = email;
      }
    } catch {
      showAlert('info', 'Account created. Please sign in.');
      switchTab('signin');
    }
  }

  // ── Helpers ──
  function setLoading(btn, on) {
    btn.disabled = on;
    btn.querySelector('.btn-text').hidden = on;
    btn.querySelector('.btn-spinner').hidden = !on;
  }

  function showAlert(type, msg) {
    alertBox.className = `alert ${type}`;
    alertBox.textContent = msg;
    alertBox.hidden = false;
  }

  function clearAlert() { alertBox.hidden = true; alertBox.textContent = ''; }

  function setErr(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  function clearErr(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  }

  function shakeCard() {
    const card = document.querySelector('.login-card');
    if (!card) return;
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true });
  }
})();
