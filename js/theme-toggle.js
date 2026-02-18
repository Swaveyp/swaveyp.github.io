/* ── Theme Toggle: Light (default) / Dark ── */

/* FOUC prevention — runs synchronously before CSS renders */
(function() {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

/* Attach toggle behavior after DOM ready */
document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('themeToggle');
  if (!btn) return;

  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  /* Update icon visibility */
  function updateIcons() {
    var sun  = btn.querySelector('.theme-icon-sun');
    var moon = btn.querySelector('.theme-icon-moon');
    if (sun)  sun.style.display  = isDark ? 'block' : 'none';
    if (moon) moon.style.display = isDark ? 'none'  : 'block';
  }

  /* Update splash intro inline bg if on homepage */
  function updateSplash() {
    var splash = document.getElementById('splashIntro');
    if (splash) {
      splash.style.background = isDark ? '#0a1628' : '#e8f0f8';
    }
  }

  updateIcons();
  updateSplash();

  btn.addEventListener('click', function() {
    isDark = !isDark;
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
    updateIcons();
    updateSplash();
  });
});
