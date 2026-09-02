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

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (activeDict[key]) {
        el.placeholder = activeDict[key];
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

  // === 4. Resource Recommendation Modal & JYUT.HK Submission ===
  const openRecommendModalBtn = document.getElementById('openRecommendModalBtn');
  const recommendModal = document.getElementById('recommendModal');
  const closeRecommendModalBtn = document.getElementById('closeRecommendModalBtn');
  const cancelRecommendBtn = document.getElementById('cancelRecommendBtn');
  const recommendForm = document.getElementById('recommendForm');
  const recContentInput = document.getElementById('recContentInput');
  const submitRecommendBtn = document.getElementById('submitRecommendBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  const recommendFormBody = document.getElementById('recommendFormBody');
  const originalFormBodyHTML = recommendFormBody ? recommendFormBody.innerHTML : '';
  const recommendFormFooter = document.getElementById('recommendFormFooter');
  const originalFormFooterHTML = recommendFormFooter ? recommendFormFooter.innerHTML : '';

  function openModal() {
    if (!recommendModal) return;
    recommendModal.classList.add('show');
    recommendModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const inputEl = document.getElementById('recContentInput');
    if (inputEl) inputEl.focus();
  }

  function closeModal() {
    if (!recommendModal) return;
    recommendModal.classList.remove('show');
    recommendModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(resetFormToInitial, 300);
  }

  function resetFormToInitial() {
    if (recommendFormBody && originalFormBodyHTML) {
      recommendFormBody.innerHTML = originalFormBodyHTML;
    }
    if (recommendFormFooter && originalFormFooterHTML) {
      recommendFormFooter.innerHTML = originalFormFooterHTML;
      document.getElementById('cancelRecommendBtn')?.addEventListener('click', closeModal);
    }
    if (recommendForm) {
      recommendForm.reset();
    }
    applyI18n(currentLang);
  }

  if (openRecommendModalBtn) {
    openRecommendModalBtn.addEventListener('click', openModal);
  }

  if (closeRecommendModalBtn) {
    closeRecommendModalBtn.addEventListener('click', closeModal);
  }

  if (cancelRecommendBtn) {
    cancelRecommendBtn.addEventListener('click', closeModal);
  }

  // Close on backdrop click
  if (recommendModal) {
    recommendModal.addEventListener('click', (e) => {
      if (e.target === recommendModal) {
        closeModal();
      }
    });
  }

  // Close on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && recommendModal && recommendModal.classList.contains('show')) {
      closeModal();
    }
  });

  // Handle Form Submission
  if (recommendForm) {
    recommendForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const inputEl = document.getElementById('recContentInput');
      const currentSubmitBtn = document.getElementById('submitRecommendBtn');
      const currentSubmitText = document.getElementById('submitBtnText');

      const content = inputEl ? inputEl.value.trim() : '';

      if (!content) {
        alert(activeDict['optRoadmapRecSinglePlaceholder'] || '請填寫網站網址或推薦內容');
        return;
      }

      // Try to detect URL for a clean subject
      const urlMatch = content.match(/https?:\/\/[^\s]+/) || content.match(/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/);
      const subjectPreview = urlMatch ? urlMatch[0].slice(0, 40) : content.slice(0, 30);

      // Format structured email message
      const messageBody = `
【粵語學習導航 - 用戶推薦資源投稿】
=======================================
用戶提交內容：
${content}
=======================================
客戶端環境：
擴展版本：${chrome.runtime?.getManifest?.()?.version || '1.5.8'}
提交時間：${new Date().toLocaleString()}
瀏覽器語言：${navigator.language}
用戶界面語言：${currentLang}
      `.trim();

      // Set Loading State
      if (currentSubmitBtn) {
        currentSubmitBtn.disabled = true;
        if (currentSubmitText) {
          currentSubmitText.textContent = activeDict['optRoadmapRecSubmitting'] || '發送中...';
        }
      }

      try {
        const formData = new FormData();
        formData.append('source', '粵語學習導航推薦系統');
        formData.append('subject', `[學習導航推薦] ${subjectPreview} - 粵語資源投稿`);
        formData.append('message', messageBody);

        const response = await fetch('https://jyut.hk/api/feedback', {
          method: 'POST',
          body: formData
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
          const successMsg = activeDict['optRoadmapRecSuccess'] || '🎉 感謝推薦！我們已收到您的投稿，審核後將收錄進導航庫。';
          
          if (recommendFormBody && recommendFormFooter) {
            recommendFormBody.innerHTML = `
              <div class="rec-success-box">
                <div class="rec-success-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-top: 4px; line-height: 1.5;">${successMsg}</div>
              </div>
            `;
            const okText = activeDict['optConfirm'] || '確定';
            recommendFormFooter.innerHTML = `
              <button type="button" class="btn-cancel" id="okRecommendBtn" style="padding: 8px 24px; font-weight: 600;">${okText}</button>
            `;
            document.getElementById('okRecommendBtn')?.addEventListener('click', () => {
              closeModal();
            });
          }
        } else {
          throw new Error('網絡請求失敗');
        }
      } catch (err) {
        console.error('Failed to submit resource recommendation:', err);
        alert(activeDict['optRoadmapRecError'] || '發送失敗，請檢查網絡後重試。');
        if (currentSubmitBtn) {
          currentSubmitBtn.disabled = false;
          if (currentSubmitText) {
            currentSubmitText.textContent = activeDict['optRoadmapRecSubmitBtn'] || '發送推薦';
          }
        }
      }
    });
  }
});
