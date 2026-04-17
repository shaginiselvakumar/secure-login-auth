'use strict';

(async function () {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) { window.location.replace('/'); return; }
    const { user } = await res.json();

    const firstName = user.name ? user.name.split(' ')[0] : null;
    document.getElementById('welcome-title').textContent =
      firstName ? 'Welcome, ' + firstName + ' \uD83D\uDC4B' : 'Welcome back \uD83D\uDC4B';
    document.getElementById('user-name').textContent  = user.name  || 'No name set';
    document.getElementById('user-email').textContent = user.email || '';

    const loginTime = user.loginTimestamp
      ? new Date(user.loginTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now';
    document.getElementById('login-time').textContent = 'Signed in at ' + loginTime;

  } catch {
    window.location.replace('/');
    return;
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      const csrfRes = await fetch('/api/csrf-token', { credentials: 'same-origin' });
      const { token } = await csrfRes.json();
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ _csrf: token }),
      });
    } finally {
      window.location.replace('/');
    }
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    alert('Account settings coming soon.');
  });
})();
