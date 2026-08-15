/**
 * 粵語學習導航 (Roadmap & Hub)
 */

document.addEventListener('DOMContentLoaded', () => {
  // === 1. i18n Internationalization & Resource Rendering ===
  const localeFolders = {
    'zh-HK': 'zh_TW',
    'zh-CN': 'zh_CN',
    'en': 'en',
    'ja': 'ja',
    'ko': 'ko'
  };

  const categoryBadgeMap = {
    phonetics: 'optRoadmapFilterPhonetics',
    dictionary: 'optRoadmapFilterDict',
    tool: 'optRoadmapFilterTool',
    input: 'optRoadmapFilterInput',
    reading: 'optRoadmapFilterReading',
    media: 'optRoadmapFilterMedia'
  };

  let activeDict = {};
  let currentLang = 'zh-HK';
  let currentCategory = 'all';
  let currentSearchQuery = '';

  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const filterPills = document.querySelectorAll('#filterPills .filter-pill');
  const emptyState = document.getElementById('emptyState');
  const resourcesCount = document.getElementById('resourcesCount');
  const resourcesGrid = document.getElementById('resourcesGrid');

  async function loadLanguage(lang) {
    const folder = localeFolders[lang] || 'zh_TW';
    try {
      const res = await fetch(chrome.runtime.getURL(`_locales/${folder}/messages.json`));
      const data = await res.json();
      activeDict = {};
      for (const [key, val] of Object.entries(data)) {
        activeDict[key] = val.message;
      }
    } catch (err) {
      console.error(`Failed to load ${lang} translations:`, err);
    }
  }

  function renderCards(lang) {
    if (!resourcesGrid || !window.ROADMAP_RESOURCES) return;

    // Remove existing rendered cards (keep emptyState)
    resourcesGrid.querySelectorAll('.resource-card').forEach((c) => c.remove());

    const visitText = activeDict['optRoadmapVisit'] || '立即訪問 ↗';

    window.ROADMAP_RESOURCES.forEach((item) => {
      const title = item.title[lang] || item.title['zh-HK'] || item.title['en'] || '';
      const desc = item.desc[lang] || item.desc['zh-HK'] || item.desc['en'] || '';
      const badgeKey = categoryBadgeMap[item.category];
      const badgeText = (badgeKey && activeDict[badgeKey]) || item.category;

      const card = document.createElement('a');
      card.href = item.url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.className = 'resource-card';
      card.dataset.category = item.category;
      card.dataset.keywords = item.keywords || '';

      card.innerHTML = `
        <div class="card-header">
          <div class="card-icon-title">
            <div class="card-icon-box">
              <img src="${item.icon}" alt="${title}" loading="lazy" onerror="this.onerror=null;this.src='icon_favicon.svg'" />
            </div>
            <div class="card-title">${title}</div>
          </div>
          <span class="card-badge badge-${item.category}">${badgeText}</span>
        </div>
        <div class="card-desc">${desc}</div>
        <div class="card-footer">
          <span class="card-domain">${item.domain}</span>
          <span class="card-action">${visitText}</span>
        </div>
      `;

      if (emptyState) {
        resourcesGrid.insertBefore(card, emptyState);
      } else {
        resourcesGrid.appendChild(card);
      }
    });
  }

  const updateResults = () => {
    const cards = resourcesGrid ? resourcesGrid.querySelectorAll('.resource-card') : [];
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
      const countTemplate = activeDict['optRoadmapCount'] || '共 $COUNT$ 個精選資源';
      resourcesCount.textContent = countTemplate.replace('$COUNT$', visibleCount).replace('{count}', visibleCount);
    }

    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? 'flex' : 'none';
    }
  };

  async function applyI18n(lang) {
    currentLang = lang;
    await loadLanguage(lang);

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (activeDict[key]) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = activeDict[key];
        } else {
          if (el.children.length > 0) {
            for (let child of el.childNodes) {
              if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim().length > 0) {
                child.nodeValue = activeDict[key];
                break;
              }
            }
          } else {
            el.innerHTML = activeDict[key];
          }
        }
      }
    });

    // Re-render resource cards in the selected language
    renderCards(lang);
    updateResults();
  }

  // Load language from storage
  chrome.storage.local.get(['uiLang', 'extensionLang'], async (res) => {
    const lang = res.uiLang || res.extensionLang || 'zh-HK';
    await applyI18n(lang);
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.uiLang || changes.extensionLang)) {
      const newLang = (changes.uiLang || changes.extensionLang).newValue || 'zh-HK';
      applyI18n(newLang);
    }
  });

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

  // === 3. Category Filter & Search Event Handlers ===
  function setCategory(category, updateUrl = true) {
    const validCategories = ['all', 'phonetics', 'dictionary', 'tool', 'input', 'reading', 'media'];
    currentCategory = validCategories.includes(category) ? category : 'all';

    filterPills.forEach((pill) => {
      pill.classList.toggle('active', (pill.dataset.filter || 'all') === currentCategory);
    });

    localStorage.setItem('jyutping_roadmap_category', currentCategory);

    if (updateUrl) {
      const newHash = currentCategory === 'all' ? '' : `#${currentCategory}`;
      if (window.location.hash !== newHash) {
        history.replaceState(null, '', newHash || window.location.pathname + window.location.search);
      }
    }

    updateResults();
  }

  // Restore saved category from URL hash or localStorage
  const initialHash = (window.location.hash || '').replace('#', '').toLowerCase();
  const savedCategory = localStorage.getItem('jyutping_roadmap_category');
  const initialCategory = initialHash || savedCategory || 'all';
  setCategory(initialCategory, false);

  window.addEventListener('hashchange', () => {
    const hashCat = (window.location.hash || '').replace('#', '').toLowerCase();
    setCategory(hashCat || 'all', false);
  });

  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const cat = pill.dataset.filter || 'all';
      setCategory(cat, true);
    });
  });

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
