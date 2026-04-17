'use strict';

(function () {
  const form       = document.getElementById('forgot-form');
  const emailInput = document.getElementById('email');
  const submitBtn  = document.getElementById('submit-btn');
  const alertBox   = document.getElementById('alert-box');
  const csrfField  = document.getElementById('csrf-token');
  const stepEmail  = document.getElementById('step-email');
  const stepSuccess= document.getElementById('step-success');

  fetchCsrfToken();
  emailInput.focus();

  form.addEventListener('submit', handleSubmit);
  emailInput.addEventListener('blur', () => validateEmail(true));
  emailInput.addEventListener('focus', () => clearErr('email-error'));

  async function fetchCsrfToken() {
    try {
      const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
      if (res.ok) csrfField.value = (await res.json()).token || '';
    } catch { console.warn('CSRF token fetch failed'); }
  }

  function validateEmail(show) {
    const val = emailInput.value.trim();
    const ok = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(val) && val.length <= 254;
    if (!ok && show) setErr('email-error', 'Enter a valid email address');
    else clearErr('email-error');
    return ok;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearAlert();

    if (!validateEmail(true)) return;

    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email:  emailInput.value.trim().toLowerCase(),
          _csrf:  csrfField.value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert('error', data.error || 'Failed to send reset link. Please try again.');
        fetchCsrfToken();
        setLoading(false);
        return;
      }

      // Show success state (always, for anti-enumeration)
      stepEmail.hidden = true;
      stepSuccess.hidden = false;

    } catch (err) {
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

  function setErr(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
    emailInput.classList.add('invalid');
    emailInput.setAttribute('aria-invalid', 'true');
  }

  function clearErr(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
    emailInput.classList.remove('invalid');
    emailInput.removeAttribute('aria-invalid');
  }
})();
