/**
 * 粵語學習導航 (Roadmap & Hub)
 */

document.addEventListener('DOMContentLoaded', () => {
  // === 1. i18n Internationalization ===
  const applyI18n = () => {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const msg = chrome.i18n.getMessage(key);
      if (msg) {
        el.textContent = msg;
      }
    });
  };
  applyI18n();

  // === 2. Theme Management (Fully synchronized with Options & Wordbook) ===
  const applyUITheme = (theme) => {
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  // Initial theme load
  chrome.storage.sync.get(['uiTheme'], (result) => {
    const currentTheme = result.uiTheme || 'auto';
    localStorage.setItem('jyutping_ui_theme', currentTheme);
    applyUITheme(currentTheme);
  });

  // Single toggle button click (Light <-> Dark)
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      chrome.storage.sync.set({ uiTheme: newTheme });
      localStorage.setItem('jyutping_ui_theme', newTheme);
      applyUITheme(newTheme);
    });
  }

  // Cross-page storage sync (Options <-> Wordbook <-> Roadmap)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.uiTheme) {
      const newTheme = changes.uiTheme.newValue || 'auto';
      localStorage.setItem('jyutping_ui_theme', newTheme);
      applyUITheme(newTheme);
    }
  });

  // System OS dark mode change listener
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    chrome.storage.sync.get(['uiTheme'], (res) => {
      if ((res.uiTheme || 'auto') === 'auto') {
        applyUITheme('auto');
      }
    });
  });

  // === 3. Search & Category Filtering ===
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const filterPills = document.querySelectorAll('#filterPills .filter-pill');
  const cards = Array.from(document.querySelectorAll('#resourcesGrid .resource-card'));
  const emptyState = document.getElementById('emptyState');
  const resourcesCount = document.getElementById('resourcesCount');

  let currentCategory = 'all';
  let currentSearchQuery = '';

  const updateResults = () => {
    let visibleCount = 0;

    cards.forEach((card) => {
      const category = card.dataset.category || '';
      const keywords = (card.dataset.keywords || '').toLowerCase();
      const title = (card.querySelector('.card-title')?.textContent || '').toLowerCase();
      const desc = (card.querySelector('.card-desc')?.textContent || '').toLowerCase();
      const domain = (card.querySelector('.card-domain')?.textContent || '').toLowerCase();

      const matchesCategory = currentCategory === 'all' || category === currentCategory;
      const matchesSearch =
        !currentSearchQuery ||
        title.includes(currentSearchQuery) ||
        desc.includes(currentSearchQuery) ||
        domain.includes(currentSearchQuery) ||
        keywords.includes(currentSearchQuery);

      if (matchesCategory && matchesSearch) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    if (resourcesCount) {
      resourcesCount.textContent = `共 ${visibleCount} 個精選資源`;
    }

    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? 'flex' : 'none';
    }
  };

  // Category Pills Click
  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.filter || 'all';
      updateResults();
    });
  });

  // Search Input & Clear
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      if (searchClearBtn) {
        searchClearBtn.style.display = currentSearchQuery ? 'flex' : 'none';
      }
      updateResults();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      currentSearchQuery = '';
      searchClearBtn.style.display = 'none';
      updateResults();
    });
  }
});
