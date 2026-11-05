// Shared script for the static info pages: theme sync, theme toggle,
// footer year, and the "clear local data" action on the privacy page.
(function () {
  const MOON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="22" height="22"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>';
  const SUN = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="22" height="22"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>';

  // Saved choice wins; otherwise follow the system setting (same rule as app.js)
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const THEME_COLORS = { light: '#f8fafc', dark: '#07080d' };

  function savedTheme() {
    try {
      const t = localStorage.getItem('theme');
      return t === 'dark' || t === 'light' ? t : null;
    } catch (e) { return null; }
  }

  function readTheme() {
    return savedTheme() || (systemDark.matches ? 'dark' : 'light');
  }

  const toggleBtn = document.getElementById('themeToggleBtn');

  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
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
      const next = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
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
      } catch (e) {
        alert('Could not clear storage in this browser.');
      }
    });
  }
})();
