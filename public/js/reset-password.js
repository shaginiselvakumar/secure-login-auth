'use strict';

(function () {
  console.log('[Reset Password] Script loaded');
  
  // Form elements
  const form          = document.getElementById('reset-form');
  const passwordInput = document.getElementById('password');
  const confirmInput  = document.getElementById('confirm-password');
  const submitBtn     = document.getElementById('submit-btn');
  const alertBox      = document.getElementById('alert-box');
  const csrfField     = document.getElementById('csrf-token');
  const resetTokenField = document.getElementById('reset-token');
  
  console.log('[Reset Password] Form elements:', {
    form: !!form,
    passwordInput: !!passwordInput,
    confirmInput: !!confirmInput,
    submitBtn: !!submitBtn
  });
  
  // Strength meter elements
  const bar1          = document.getElementById('bar1');
  const bar2          = document.getElementById('bar2');
  const bar3          = document.getElementById('bar3');
  const bar4          = document.getElementById('bar4');
  const strengthLabel = document.getElementById('strength-label');
  
  console.log('[Reset Password] Strength elements:', {
    bar1: !!bar1,
    bar2: !!bar2,
    bar3: !!bar3,
    bar4: !!bar4,
    strengthLabel: !!strengthLabel
  });
  
  // Password requirements (divs, not checkboxes)
  const reqLen        = document.getElementById('req-len');
  const reqUpper      = document.getElementById('req-upper');
  const reqLower      = document.getElementById('req-lower');
  const reqNum        = document.getElementById('req-num');
  const reqSpecial    = document.getElementById('req-special');
  
  console.log('[Reset Password] Requirement elements:', {
    reqLen: !!reqLen,
    reqUpper: !!reqUpper,
    reqLower: !!reqLower,
    reqNum: !!reqNum,
    reqSpecial: !!reqSpecial
  });
  
  // Toggle button
  const togglePwBtn   = document.getElementById('toggle-pw');
  
  // Error message elements
  const passwordError = document.getElementById('password-error');
  const confirmError  = document.getElementById('confirm-error');

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    showAlert('error', 'Invalid reset link. Please request a new one.');
    submitBtn.disabled = true;
    return;
  }

  // Store token in hidden field
  resetTokenField.value = token;

  // Fetch CSRF token and focus password field
  fetchCsrfToken();
  passwordInput.focus();

  // Event listeners
  form.addEventListener('submit', handleSubmit);
  passwordInput.addEventListener('input', updateStrength);
  passwordInput.addEventListener('blur', () => validatePassword(true));
  confirmInput.addEventListener('input', () => validateConfirm(false));
  confirmInput.addEventListener('blur', () => validateConfirm(true));
  togglePwBtn.addEventListener('click', togglePasswordVisibility);

  /**
   * Fetch CSRF token from server
   */
  async function fetchCsrfToken() {
    try {
      const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        csrfField.value = data.token || '';
      }
    } catch (err) {
      console.warn('CSRF token fetch failed:', err);
    }
  }

  /**
   * Toggle password visibility
   */
  function togglePasswordVisibility() {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePwBtn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
    togglePwBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  }

  /**
   * Calculate password strength score (0-5)
   */
  function scorePassword(pw) {
    let score = 0;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  /**
   * Update password strength meter and requirements
   */
  function updateStrength() {
    const pw = passwordInput.value;
    
    // Update requirements (add/remove 'met' class)
    const hasLength = pw.length >= 12;
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNum = /[0-9]/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    
    updateRequirement(reqLen, hasLength);
    updateRequirement(reqUpper, hasUpper);
    updateRequirement(reqLower, hasLower);
    updateRequirement(reqNum, hasNum);
    updateRequirement(reqSpecial, hasSpecial);
    
    // Update strength bars
    if (!pw) {
      clearStrengthBars();
      strengthLabel.textContent = '';
      return;
    }
    
    const score = scorePassword(pw);
    const levels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
    const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];
    
    // Update bars based on score
    clearStrengthBars();
    if (score >= 1) bar1.style.background = colors[Math.min(score, 5)];
    if (score >= 2) bar2.style.background = colors[Math.min(score, 5)];
    if (score >= 3) bar3.style.background = colors[Math.min(score, 5)];
    if (score >= 4) bar4.style.background = colors[Math.min(score, 5)];
    
    strengthLabel.textContent = levels[Math.min(score, 5)] || 'Weak';
    // Remove inline style to comply with CSP - use CSS classes instead
    strengthLabel.className = 'strength-label strength-' + (levels[Math.min(score, 5)] || 'weak').toLowerCase().replace(' ', '-');
  }

  /**
   * Clear all strength bars
   */
  function clearStrengthBars() {
    bar1.style.background = '';
    bar2.style.background = '';
    bar3.style.background = '';
    bar4.style.background = '';
  }

  /**
   * Update requirement item (add/remove 'met' class and change symbol)
   */
  function updateRequirement(element, isMet) {
    if (isMet) {
      element.classList.add('met');
      const span = element.querySelector('span');
      if (span) span.textContent = '✓';
    } else {
      element.classList.remove('met');
      const span = element.querySelector('span');
      if (span) span.textContent = '○';
    }
  }

  /**
   * Validate password field
   */
  function validatePassword(showError) {
    const val = passwordInput.value;
    
    if (!val) {
      if (showError) passwordError.textContent = 'Password is required';
      return false;
    }
    
    if (val.length < 12) {
      if (showError) passwordError.textContent = 'Password must be at least 12 characters';
      return false;
    }
    
    if (!/[A-Z]/.test(val)) {
      if (showError) passwordError.textContent = 'Password must contain an uppercase letter';
      return false;
    }
    
    if (!/[a-z]/.test(val)) {
      if (showError) passwordError.textContent = 'Password must contain a lowercase letter';
      return false;
    }
    
    if (!/[0-9]/.test(val)) {
      if (showError) passwordError.textContent = 'Password must contain a number';
      return false;
    }
    
    if (!/[^A-Za-z0-9]/.test(val)) {
      if (showError) passwordError.textContent = 'Password must contain a special character';
      return false;
    }
    
    passwordError.textContent = '';
    return true;
  }

  /**
   * Validate confirm password field
   */
  function validateConfirm(showError) {
    const val = confirmInput.value;
    
    if (!val) {
      if (showError) confirmError.textContent = 'Please confirm your password';
      return false;
    }
    
    if (passwordInput.value !== val) {
      if (showError) confirmError.textContent = 'Passwords do not match';
      return false;
    }
    
    confirmError.textContent = '';
    return true;
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(e) {
    e.preventDefault();
    clearAlert();

    // Validate both fields
    const isPasswordValid = validatePassword(true);
    const isConfirmValid = validateConfirm(true);
    
    if (!isPasswordValid || !isConfirmValid) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          token:    token,
          password: passwordInput.value,
          _csrf:    csrfField.value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert('error', data.message || 'Failed to reset password. Please try again.');
        fetchCsrfToken();
        setLoading(false);
        return;
      }

      // Show success state
      document.getElementById('step-reset').hidden = true;
      document.getElementById('step-success').hidden = false;

    } catch (err) {
      console.error('Reset password error:', err);
      showAlert('error', 'Connection error. Please try again.');
      setLoading(false);
    }
  }

  /**
   * Set loading state on submit button
   */
  function setLoading(on) {
    submitBtn.disabled = on;
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    if (btnText) btnText.hidden = on;
    if (btnSpinner) btnSpinner.hidden = !on;
  }

  /**
   * Show alert message
   */
  function showAlert(type, msg) {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.hidden = false;
  }

  /**
   * Clear alert message
   */
  function clearAlert() {
    alertBox.hidden = true;
    alertBox.textContent = '';
  }

})();
