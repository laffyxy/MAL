// Shared script for the static info pages: theme sync, theme toggle,
// footer year, and the "clear local data" action on the privacy page.
(function () {
  const MOON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>';
  const SUN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';

  // Saved choice wins; otherwise follow the system setting (same rule as app.js)
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const THEME_COLORS = { light: '#ffffff', dark: '#0a0a0a' };

  function savedTheme() {
    try {
      const t = localStorage.getItem('theme');
      return t === 'dark' || t === 'light' ? t : null;
    } catch { return null; }
  }

  function readTheme() {
    return savedTheme() || (systemDark.matches ? 'dark' : 'light');
  }

  const toggleBtn = document.getElementById('themeToggleBtn');

  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
    if (toggleBtn) {
      toggleBtn.innerHTML = theme === 'dark' ? SUN : MOON;
      toggleBtn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }
  }

  applyTheme(readTheme());
  const onSystemChange = function () { if (!savedTheme()) applyTheme(readTheme()); };
  if (systemDark.addEventListener) systemDark.addEventListener('change', onSystemChange);
  else if (systemDark.addListener) systemDark.addListener(onSystemChange);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      const next = document.documentElement.classList.contains('dark-mode') ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch { /* storage unavailable */ }
      applyTheme(next);
    });
  }

  const year = document.getElementById('footerYear');
  if (year) year.textContent = new Date().getFullYear();

  const clearBtn = document.getElementById('clearDataBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (!confirm('Delete your saved API key, settings, theme and translation history from this browser?')) return;
      try {
        ['gemini_api_key', 'gemini_model', 'translation_history', 'theme', 'policies_accepted'].forEach(function (k) {
          localStorage.removeItem(k);
        });
        clearBtn.textContent = 'All local data cleared';
        clearBtn.disabled = true;
        applyTheme(readTheme());
      } catch {
        alert('Could not clear storage in this browser.');
      }
    });
  }
})();
