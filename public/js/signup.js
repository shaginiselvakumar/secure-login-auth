'use strict';

(function () {
  const form        = document.getElementById('signup-form');
  const nameInput   = document.getElementById('name');
  const emailInput  = document.getElementById('email');
  const pwInput     = document.getElementById('password');
  const confirmInput= document.getElementById('confirm-password');
  const submitBtn   = document.getElementById('submit-btn');
  const alertBox    = document.getElementById('alert-box');
  const csrfField   = document.getElementById('csrf-token');
  const capsWarn    = document.getElementById('caps-warning');
  const strengthFill= document.getElementById('strength-fill');
  const strengthLabel=document.getElementById('strength-label');

  fetchCsrfToken();
  nameInput.focus();

  form.addEventListener('submit', handleSubmit);
  emailInput.addEventListener('blur', () => validateEmail(true));
  pwInput.addEventListener('input', updateStrength);
  pwInput.addEventListener('blur', () => validatePassword(true));
  pwInput.addEventListener('keyup', detectCapsLock);
  pwInput.addEventListener('keydown', detectCapsLock);
  confirmInput.addEventListener('blur', () => validateConfirm(true));

  document.getElementById('toggle-pw').addEventListener('click', () => toggleVis(pwInput, 'toggle-pw'));
  document.getElementById('toggle-confirm').addEventListener('click', () => toggleVis(confirmInput, 'toggle-confirm'));

  async function fetchCsrfToken() {
    try {
      const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
      if (res.ok) csrfField.value = (await res.json()).token || '';
    } catch { console.warn('CSRF token fetch failed'); }
  }

  function detectCapsLock(e) {
    capsWarn.hidden = !(e.getModifierState && e.getModifierState('CapsLock'));
  }

  function toggleVis(input, btnId) {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const btn = document.getElementById(btnId);
    btn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
    btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  }

  function scorePassword(pw) {
    let score = 0;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  function updateStrength() {
    const pw = pwInput.value;
    if (!pw) { strengthFill.style.width = '0'; strengthLabel.textContent = ''; return; }
    const score = scorePassword(pw);
    const levels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
    const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];
    const pct    = (score / 5) * 100;
    strengthFill.style.width = pct + '%';
    strengthFill.style.background = colors[score] || colors[1];
    strengthLabel.textContent = levels[score] || 'Weak';
  }

  function validateEmail(show) {
    const val = emailInput.value.trim();
    const ok = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(val) && val.length <= 254;
    if (!ok && show) setErr('email', 'Enter a valid email address');
    else clearErr('email');
    return ok;
  }

  function validatePassword(show) {
    const val = pwInput.value;
    if (val.length < 12) {
      if (show) setErr('password', 'Password must be at least 12 characters');
      return false;
    }
    clearErr('password');
    return true;
  }

  function validateConfirm(show) {
    if (pwInput.value !== confirmInput.value) {
      if (show) setErr('confirm', 'Passwords do not match');
      return false;
    }
    clearErr('confirm');
    return true;
  }

  function validateName(show) {
    const val = nameInput.value.trim();
    if (!val || val.length < 2) {
      if (show) setErr('name', 'Please enter your full name');
      return false;
    }
    clearErr('name');
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearAlert();

    const ok = validateName(true) & validateEmail(true) & validatePassword(true) & validateConfirm(true);
    if (!ok) return;

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name:     nameInput.value.trim(),
          email:    emailInput.value.trim().toLowerCase(),
          password: pwInput.value,
          _csrf:    csrfField.value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert('error', data.error || 'Registration failed. Please try again.');
        fetchCsrfToken();
        setLoading(false);
        return;
      }

      showAlert('success', 'Account created! Redirecting to sign in...');
      setTimeout(() => { window.location.href = '/'; }, 1500);

    } catch {
      showAlert('error', 'Connection error. Please try again.');
      setLoading(false);
    }
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.querySelector('.btn-text').hidden = on;
    submitBtn.querySelector('.btn-spinner').hidden = !on;
  }

  function showAlert(type, msg) {
    alertBox.className = `alert ${type}`;
    alertBox.textContent = msg;
    alertBox.hidden = false;
  }

  function clearAlert() { alertBox.hidden = true; alertBox.textContent = ''; }

  function setErr(field, msg) {
    const input = { name: nameInput, email: emailInput, password: pwInput, confirm: confirmInput }[field];
    const el = document.getElementById(field === 'confirm' ? 'confirm-error' : `${field}-error`);
    if (input) { input.classList.add('invalid'); input.setAttribute('aria-invalid', 'true'); }
    if (el) el.textContent = msg;
  }

  function clearErr(field) {
    const input = { name: nameInput, email: emailInput, password: pwInput, confirm: confirmInput }[field];
    const el = document.getElementById(field === 'confirm' ? 'confirm-error' : `${field}-error`);
    if (input) { input.classList.remove('invalid'); input.removeAttribute('aria-invalid'); }
    if (el) el.textContent = '';
  }
})();
