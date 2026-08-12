try {
  var theme = localStorage.getItem('jyutping_ui_theme') || 'auto';
  var isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.backgroundColor = '#0f172a';
  }
} catch (e) {}
