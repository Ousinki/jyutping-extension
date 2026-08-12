/**
 * 生詞本管理頁面邏輯
 * wordbook.js
 */
(function () {
  'use strict';

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderSimpleMarkdown(text) {
    // Escape HTML first for safety
    let html = escapeHtml(text);

    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_ (not inside words)
    html = html.replace(/(?<![\w*])\*([^*]+?)\*(?![\w*])/g, '<em>$1</em>');
    html = html.replace(/(?<![\w_])_([^_]+?)_(?![\w_])/g, '<em>$1</em>');

    // Inline code: `code`
    html = html.replace(/`([^`]+?)`/g, '<code style="background: var(--border); padding: 1px 4px; border-radius: 3px; font-size: 12px;">$1</code>');

    // Split into lines for block-level processing
    const lines = html.split('\n');
    const result = [];
    let inOl = false, inUl = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const olMatch = line.match(/^(\d+)\.\s+(.*)/);
      const ulMatch = line.match(/^[-*]\s+(.*)/);

      if (olMatch) {
        if (!inOl) { if (inUl) { result.push('</ul>'); inUl = false; } result.push('<ol>'); inOl = true; }
        result.push('<li>' + olMatch[2] + '</li>');
      } else if (ulMatch) {
        if (!inUl) { if (inOl) { result.push('</ol>'); inOl = false; } result.push('<ul>'); inUl = true; }
        result.push('<li>' + ulMatch[1] + '</li>');
      } else {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (line.trim() === '') {
          result.push('<br>');
        } else {
          result.push(line);
        }
      }
    }
    if (inOl) result.push('</ol>');
    if (inUl) result.push('</ul>');

    return result.join('\n');
  }

  const WORDBOOK_KEY = 'wordbook';
  let dictionary = null;
  let isDetailMode = localStorage.getItem('jyutping_detail_mode') === 'true';

  // ==================== 存儲工具 ====================

  async function getWordbook() {
    return new Promise(resolve => {
      chrome.storage.local.get([WORDBOOK_KEY], result => {
        resolve(result[WORDBOOK_KEY] || []);
      });
    });
  }

  async function saveWordbook(wordbook) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [WORDBOOK_KEY]: wordbook }, resolve);
    });
  }

  async function getStorageUsage() {
    return new Promise(resolve => {
      chrome.storage.local.getBytesInUse([WORDBOOK_KEY], bytes => {
        const quota = 5 * 1024 * 1024;
        resolve({ used: bytes, quota, percentage: Math.round((bytes / quota) * 1000) / 10 });
      });
    });
  }

  // ==================== i18n ====================

  const i18nStrings = {
    'zh-HK': {
      wordbookTitle: '我的生詞本',
      wordbookSubtitle: 'My Cantonese Word Book',
      wordbookBackToSettings: '返回設定',
      wordbookWarning: '生詞本數據僅保存在本機，不會上傳雲端。卸載插件或清除瀏覽數據可能導致生詞丟失。建議定期',
      wordbookWarningExport: '導出備份',
      wordbookWarningEnd: '以防數據遺失。',
      wordbookTotal: '共',
      wordbookWords: '詞',
      wordbookToday: '今日',
      wordbookWeek: '本週',
      wordbookSearchPlaceholder: '搜索生詞…',
      wordbookSortNewest: '最新',
      wordbookSortOldest: '最早',
      wordbookSortAlpha: '字符',
      wordbookSortJyutping: '粵拼',
      wordbookExport: '導出',
      wordbookSelectAll: '全選',
      wordbookDeleteSelected: '刪除選中',
      wordbookCancel: '取消',
      wordbookConfirmImport: '確認導入',
      wordbookImportTitle: '導入生詞',
      wordbookEmptyTitle: '尚無生詞',
      wordbookEmptyDesc: '在網頁上懸停查詞時，點擊懸浮窗中的 ⭐ 按鈕即可收藏。<br>也可以在任何模式下按 <kbd class="kbd">S</kbd> 鍵快速收藏當前高亮詞。',
      wordbookDeleteConfirm: '確定要刪除選中的 {n} 個詞嗎？',
      wordbookImportSuccess: '成功導入 {added} 個新詞（跳過 {skipped} 個重複）',
      wordbookExported: '已導出 {format} 文件',
      wordbookDetailMode: '詞典模式',
      wordbookEmptyDetail: '點擊左側單字<br>查看詳細詞典釋義'
    },
    'zh-CN': {
      wordbookTitle: '我的生词本',
      wordbookSubtitle: 'My Cantonese Word Book',
      wordbookBackToSettings: '返回设定',
      wordbookWarning: '生词本数据仅保存在本机，不会上传云端。卸载插件或清除浏览数据可能导致生词丢失。建议定期',
      wordbookWarningExport: '导出备份',
      wordbookWarningEnd: '以防数据遗失。',
      wordbookTotal: '共',
      wordbookWords: '词',
      wordbookToday: '今日',
      wordbookWeek: '本周',
      wordbookSearchPlaceholder: '搜索生词…',
      wordbookSortNewest: '最新',
      wordbookSortOldest: '最早',
      wordbookSortAlpha: '字符',
      wordbookSortJyutping: '粤拼',
      wordbookExport: '导出',
      wordbookSelectAll: '全选',
      wordbookDeleteSelected: '删除选中',
      wordbookCancel: '取消',
      wordbookConfirmImport: '确认导入',
      wordbookImportTitle: '导入生词',
      wordbookEmptyTitle: '暂无生词',
      wordbookEmptyDesc: '在网页上悬停查词时，点击悬浮窗中的 ⭐ 按钮即可收藏。<br>也可以在任何模式下按 <kbd class="kbd">S</kbd> 键快速收藏当前高亮词。',
      wordbookDeleteConfirm: '确定要删除选中的 {n} 个词吗？',
      wordbookImportSuccess: '成功导入 {added} 个新词（跳过 {skipped} 个重复）',
      wordbookExported: '已导出 {format} 文件',
      wordbookDetailMode: '词典模式',
      wordbookEmptyDetail: '点击左侧单词<br>查看详细词典释义'
    },
    'en': {
      wordbookTitle: 'My Word Book',
      wordbookSubtitle: 'Cantonese Vocabulary',
      wordbookBackToSettings: 'Back to Settings',
      wordbookWarning: 'Word Book data is stored locally only, not synced to cloud. Uninstalling the extension or clearing browser data may delete your words. Please',
      wordbookWarningExport: 'export a backup',
      wordbookWarningEnd: 'regularly to prevent data loss.',
      wordbookTotal: 'Total',
      wordbookWords: 'words',
      wordbookToday: 'Today',
      wordbookWeek: 'This week',
      wordbookSearchPlaceholder: 'Search words…',
      wordbookSortNewest: 'Newest',
      wordbookSortOldest: 'Oldest',
      wordbookSortAlpha: 'Character',
      wordbookSortJyutping: 'Jyutping',
      wordbookExport: 'Export',
      wordbookSelectAll: 'Select All',
      wordbookDeleteSelected: 'Delete selected',
      wordbookCancel: 'Cancel',
      wordbookConfirmImport: 'Confirm Import',
      wordbookImportTitle: 'Import Words',
      wordbookEmptyTitle: 'No words saved',
      wordbookEmptyDesc: 'Hover over Chinese text on any page and click the ⭐ button to save.<br>You can also press <kbd class="kbd">S</kbd> to quickly save the highlighted word in any mode.',
      wordbookDeleteConfirm: 'Delete {n} selected words?',
      wordbookImportSuccess: 'Imported {added} new words (skipped {skipped} duplicates)',
      wordbookExported: 'Exported {format} file',
      wordbookDetailMode: 'Dictionary Mode',
      wordbookEmptyDetail: 'Click a word on the left<br>to view dictionary details'
    },
    'ja': {
      wordbookTitle: '単語帳',
      wordbookSubtitle: '広東語ボキャブラリー',
      wordbookBackToSettings: '設定に戻る',
      wordbookWarning: '単語帳データはローカルにのみ保存され、クラウドには同期されません。拡張機能のアンインストールやブラウザデータの消去により、データが失われる可能性があります。定期的に',
      wordbookWarningExport: 'バックアップをエクスポート',
      wordbookWarningEnd: 'することをお勧めします。',
      wordbookTotal: '合計',
      wordbookWords: '語',
      wordbookToday: '今日',
      wordbookWeek: '今週',
      wordbookSearchPlaceholder: '検索…',
      wordbookSortNewest: '最新',
      wordbookSortOldest: '最古',
      wordbookSortAlpha: '文字',
      wordbookSortJyutping: '粤拼',
      wordbookExport: 'エクスポート',
      wordbookSelectAll: '全選択',
      wordbookDeleteSelected: '選択を削除',
      wordbookCancel: 'キャンセル',
      wordbookConfirmImport: 'インポート確認',
      wordbookImportTitle: '単語のインポート',
      wordbookEmptyTitle: '単語がありません',
      wordbookEmptyDesc: 'ウェブページで漢字にホバーし、⭐ ボタンをクリックして保存できます。<br>任意のモードで <kbd class="kbd">S</kbd> キーを押すと素早く保存できます。',
      wordbookDeleteConfirm: '選択した {n} 個の単語を削除しますか？',
      wordbookImportSuccess: '{added} 個の新しい単語をインポートしました（{skipped} 個の重複をスキップ）',
      wordbookExported: '{format} ファイルをエクスポートしました',
      wordbookDetailMode: '辞書モード',
      wordbookEmptyDetail: '左側の単語をクリックして<br>辞書の詳細を表示します'
    },
    'ko': {
      wordbookTitle: '단어장',
      wordbookSubtitle: '광둥어 어휘',
      wordbookBackToSettings: '설정으로 돌아가기',
      wordbookWarning: '단어장 데이터는 로컬에만 저장되며 클라우드에 동기화되지 않습니다. 확장 프로그램 제거 또는 브라우저 데이터 삭제 시 데이터가 손실될 수 있습니다. 정기적으로',
      wordbookWarningExport: '백업 내보내기',
      wordbookWarningEnd: '를 권장합니다.',
      wordbookTotal: '총',
      wordbookWords: '단어',
      wordbookToday: '오늘',
      wordbookWeek: '이번 주',
      wordbookSearchPlaceholder: '검색…',
      wordbookSortNewest: '최신',
      wordbookSortOldest: '오래된 순',
      wordbookSortAlpha: '문자',
      wordbookSortJyutping: '월병',
      wordbookExport: '내보내기',
      wordbookSelectAll: '전체 선택',
      wordbookDeleteSelected: '선택 삭제',
      wordbookCancel: '취소',
      wordbookConfirmImport: '가져오기 확인',
      wordbookImportTitle: '단어 가져오기',
      wordbookEmptyTitle: '저장된 단어 없음',
      wordbookEmptyDesc: '웹페이지에서 한자에 마우스를 올리고 ⭐ 버튼을 클릭하여 저장하세요.<br>어떤 모드에서든 <kbd class="kbd">S</kbd> 키를 눌러 선택한 단어를 빠르게 저장할 수도 있습니다.',
      wordbookDeleteConfirm: '선택한 {n}개의 단어를 삭제하시겠습니까?',
      wordbookImportSuccess: '{added}개의 새 단어 가져오기 완료 ({skipped}개의 중복 항목 건너뜀)',
      wordbookExported: '{format} 파일이 내보내졌습니다',
      wordbookDetailMode: '사전 모드',
      wordbookEmptyDetail: '왼쪽 단어를 클릭하여<br>사전 세부 정보를 봅니다'
    }
  };

  let currentLang = 'zh-HK';

  function t(key) {
    return (i18nStrings[currentLang] || i18nStrings['zh-HK'])[key] || key;
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val) el.innerHTML = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = t(key);
      if (val) el.placeholder = val;
    });
    // Sort select options
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.querySelectorAll('option').forEach(opt => {
        const key = opt.getAttribute('data-i18n');
        if (key) opt.textContent = t(key);
      });
    }
  }

  // ==================== State ====================

  let wordbook = [];
  let filteredWords = [];
  let selectedIds = new Set();
  let currentSort = 'newest';
  let searchQuery = '';

  // ==================== DOM References ====================

  const wordListEl = document.getElementById('wordList');
  const searchInput = document.getElementById('searchInput');

  const exportBtn = document.getElementById('exportBtn');
  const exportMenu = document.getElementById('exportMenu');
  const importBtn = document.getElementById('importBtn');
  const importModal = document.getElementById('importModal');
  const importCancelBtn = document.getElementById('importCancelBtn');
  const importConfirmBtn = document.getElementById('importConfirmBtn');
  const importFileInput = document.getElementById('importFileInput');
  const importPreview = document.getElementById('importPreview');
  const dropZone = document.getElementById('dropZone');
  const chooseFileLink = document.getElementById('chooseFileLink');
  const selectAllCheckbox = document.getElementById('selectAll');
  const bulkActions = document.getElementById('bulkActions');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const selectedCountEl = document.getElementById('selectedCount');
  const themeToggle = document.getElementById('themeToggle');
  const warningExportBtn = document.getElementById('warningExportBtn');

  // ==================== Theme ====================

  function initTheme() {
    chrome.storage.sync.get(['uiTheme'], (res) => {
      const theme = res.uiTheme || 'auto';
      localStorage.setItem('jyutping_ui_theme', theme);
      const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.uiTheme) {
        const theme = changes.uiTheme.newValue || 'auto';
        const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      }
    });
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    chrome.storage.sync.set({ uiTheme: newTheme });
    localStorage.setItem('jyutping_ui_theme', newTheme);
  });

  // ==================== Rendering ====================

  function filterAndSort() {
    const q = searchQuery.toLowerCase();
    filteredWords = wordbook.filter(w => {
      if (!q) return true;
      return (w.character || '').toLowerCase().includes(q)
        || (w.simplified || '').toLowerCase().includes(q)
        || (w.jyutping || '').toLowerCase().includes(q)
        || (w.yale || '').toLowerCase().includes(q)
        || (w.pinyin || '').toLowerCase().includes(q);
    });

    switch (currentSort) {
      case 'oldest':
        filteredWords.sort((a, b) => a.timestamp - b.timestamp);
        break;
      case 'alpha':
        filteredWords.sort((a, b) => (a.character || '').localeCompare(b.character || '', 'zh'));
        break;
      case 'jyutping':
        filteredWords.sort((a, b) => (a.jyutping || '').localeCompare(b.jyutping || ''));
        break;
      default: // newest
        filteredWords.sort((a, b) => b.timestamp - a.timestamp);
    }
  }

  function renderList() {
    filterAndSort();

    if (filteredWords.length === 0) {
      if (wordbook.length === 0) {
        wordListEl.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              <line x1="12" y1="8" x2="12" y2="14"></line>
              <line x1="9" y1="11" x2="15" y2="11"></line>
            </svg>
            <h3>${t('wordbookEmptyTitle')}</h3>
            <p>${t('wordbookEmptyDesc')}</p>
          </div>
        `;
      } else {
        wordListEl.innerHTML = `
          <div class="empty-state">
            <h3>🔍</h3>
            <p>沒有匹配的結果</p>
          </div>
        `;
      }
      bulkActions.style.display = 'none';
      return;
    }

    bulkActions.style.display = 'flex';

    const headerHTML = `
      <div class="table-header">
        <div class="col-selection col-header-sortable" id="colHeaderId">
          <span>ID</span>
          <svg class="sort-indicator" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="${currentSort === 'oldest' ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"></polyline>
          </svg>
        </div>
        <div class="col-char">Character</div>
        <div class="col-jyutping">Jyutping</div>
        <div class="col-meaning">Meaning</div>
        <div class="col-date">Date</div>
      </div>
    `;

    const rowsHTML = filteredWords.map((word, index) => {
      const date = new Date(word.timestamp).toLocaleDateString();
      const englishText = (word.english || []).join('; ') || '—';
      const isChecked = selectedIds.has(word.id) ? 'checked' : '';
      const displayId = filteredWords.length - index;
      const isLong = word.character.length > 4;

      if (isLong) {
        return `
          <div class="table-row word-card row-compact" data-id="${word.id}">
            <div class="col-selection">
              <label class="selection-label">
                <input type="checkbox" class="word-card-checkbox" data-id="${word.id}" ${isChecked} />
                <span class="selection-text">${displayId}</span>
              </label>
            </div>
            <div class="col-char-jyutping-merged">
              <span class="word-character" data-word="${word.character}" title="點擊發音">${word.character}</span>
              <span class="jyutping-text merged-jyutping" data-word="${word.character}" title="點擊發音">${word.jyutping || ''}</span>
            </div>
            <div class="col-meaning"></div>
            <div class="col-date">${date}</div>
          </div>
        `;
      }

      return `
        <div class="table-row word-card" data-id="${word.id}">
          <div class="col-selection">
            <label class="selection-label">
              <input type="checkbox" class="word-card-checkbox" data-id="${word.id}" ${isChecked} />
              <span class="selection-text">${displayId}</span>
            </label>
          </div>
          <div class="col-char word-character" data-word="${word.character}" title="點擊發音">${word.character}</div>
          <div class="col-jyutping word-jyutping">
            <span class="jyutping-text" data-word="${word.character}" title="點擊發音">${word.jyutping || ''}</span>
          </div>
          <div class="col-meaning"></div>
          <div class="col-date">${date}</div>
        </div>
      `;
    }).join('');

    wordListEl.innerHTML = headerHTML + rowsHTML;

    updateSelectionUI();
    // Re-apply column visibility after re-render
    if (typeof applyColumnVisibility === 'function') applyColumnVisibility();
  }

  function updateStats() {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

    document.getElementById('statTotal').textContent = wordbook.length;
    document.getElementById('statToday').textContent = wordbook.filter(w => w.timestamp >= todayStart).length;
    document.getElementById('statWeek').textContent = wordbook.filter(w => w.timestamp >= weekStart).length;
  }

  async function updateStorage() {
    const usage = await getStorageUsage();
    const storageText = document.getElementById('storageText');
    const storageFill = document.getElementById('storageProgressFill');
    if (storageText) {
      const usedKB = (usage.used / 1024).toFixed(1);
      const quotaMB = (usage.quota / (1024 * 1024)).toFixed(0);
      storageText.textContent = `${usedKB} KB / ${quotaMB} MB（${t('wordbookTotal')} ${wordbook.length} ${t('wordbookWords')}）`;
    }
    if (storageFill) {
      storageFill.style.width = Math.min(usage.percentage, 100) + '%';
    }
  }

  // ==================== Selection ====================

  function updateSelectionUI() {
    const count = selectedIds.size;
    selectedCountEl.textContent = count;
    bulkDeleteBtn.disabled = count === 0;
    selectAllCheckbox.checked = filteredWords.length > 0 && filteredWords.every(w => selectedIds.has(w.id));
  }

  // ==================== Event Handlers ====================

  // Header collapse toggle
  const headerCollapsible = document.getElementById('headerCollapsible');
  const headerCollapseToggle = document.getElementById('headerCollapseToggle');
  if (headerCollapsible && headerCollapseToggle) {
    const isCollapsed = localStorage.getItem('jyutping_header_collapsed') === 'true';
    if (isCollapsed) {
      headerCollapsible.classList.add('collapsed');
      headerCollapseToggle.classList.add('collapsed');
      headerCollapseToggle.title = '展開表頭';
    }
    headerCollapseToggle.addEventListener('click', () => {
      const collapsed = headerCollapsible.classList.toggle('collapsed');
      headerCollapseToggle.classList.toggle('collapsed', collapsed);
      headerCollapseToggle.title = collapsed ? '展開表頭' : '收起表頭';
      localStorage.setItem('jyutping_header_collapsed', collapsed);
    });
  }

  // Unified table header context menu (sort + column visibility)
  const tableHeaderMenu = document.getElementById('tableHeaderMenu');
  // Column visibility state
  const defaultCols = { 'col-char': true, 'col-jyutping': true, 'col-meaning': true, 'col-date': true };
  let visibleCols = { ...defaultCols };
  try {
    const saved = JSON.parse(localStorage.getItem('jyutping_visible_cols'));
    if (saved) visibleCols = { ...defaultCols, ...saved };
  } catch(e) {}

  function applyColumnVisibility() {
    Object.entries(visibleCols).forEach(([col, visible]) => {
      document.querySelectorAll('.' + col).forEach(el => {
        el.style.display = visible ? '' : 'none';
      });
    });

    // Rebuild grid-template-columns based on visible columns
    // Order: col-selection(ID) | col-char | col-jyutping | col-meaning | col-date
    const colDefs = [
      { col: null,            size: '32px'  }, // ID — always visible
      { col: 'col-char',      size: '100px' },
      { col: 'col-jyutping',  size: '150px' },
      { col: 'col-meaning',   size: '1fr'   }, // takes all remaining space
      { col: 'col-date',      size: '85px'  },
    ];
    const gridCols = colDefs
      .filter(c => c.col === null || visibleCols[c.col] !== false)
      .map(c => c.size)
      .join(' ');
    document.querySelectorAll('.table-header, .table-row').forEach(el => {
      el.style.gridTemplateColumns = gridCols;
    });

    // Update checkboxes in menu
    if (tableHeaderMenu) {
      tableHeaderMenu.querySelectorAll('.sort-context-menu-toggle').forEach(toggle => {
        const cb = toggle.querySelector('input');
        if (cb) cb.checked = visibleCols[toggle.dataset.col] !== false;
      });
    }
  }

  // Apply on initial render
  setTimeout(applyColumnVisibility, 0);

  if (tableHeaderMenu) {
    // Right-click on any table header column
    document.addEventListener('contextmenu', (e) => {
      const header = e.target.closest('.table-header');
      if (header) {
        e.preventDefault();
        tableHeaderMenu.style.left = e.clientX + 'px';
        tableHeaderMenu.style.top = e.clientY + 'px';
        // Update sort active state
        tableHeaderMenu.querySelectorAll('.sort-context-menu-item').forEach(item => {
          item.classList.toggle('active', item.dataset.sort === currentSort);
        });
        // Update checkbox state
        tableHeaderMenu.querySelectorAll('.sort-context-menu-toggle').forEach(toggle => {
          const cb = toggle.querySelector('input');
          if (cb) cb.checked = visibleCols[toggle.dataset.col] !== false;
        });
        tableHeaderMenu.classList.add('show');
      }
    });

    // Left-click on ID header toggles sort
    document.addEventListener('click', (e) => {
      const idHeader = e.target.closest('#colHeaderId');
      if (idHeader) {
        currentSort = currentSort === 'newest' ? 'oldest' : 'newest';
        renderList();
        applyColumnVisibility();
      }
      // Close menu on any click outside
      if (!e.target.closest('.sort-context-menu')) {
        tableHeaderMenu.classList.remove('show');
      }
    });

    // Sort selection
    tableHeaderMenu.addEventListener('click', (e) => {
      const sortItem = e.target.closest('.sort-context-menu-item');
      if (sortItem) {
        currentSort = sortItem.dataset.sort;
        renderList();
        applyColumnVisibility();
        tableHeaderMenu.classList.remove('show');
      }
    });

    // Column visibility toggle
    tableHeaderMenu.addEventListener('change', (e) => {
      const toggle = e.target.closest('.sort-context-menu-toggle');
      if (toggle) {
        const col = toggle.dataset.col;
        visibleCols[col] = e.target.checked;
        localStorage.setItem('jyutping_visible_cols', JSON.stringify(visibleCols));
        applyColumnVisibility();
      }
    });
  }

  // Search (wordbook list filtering + dictionary dropdown)
  const dictSearchDropdown = document.getElementById('dictSearchDropdown');
  let dictSearchTimer = null;
  let dictActiveIndex = -1;
  let dictResults = [];
  let searchMode = 'wordbook'; // 'wordbook' or 'dict'

  // Search mode toggle
  const searchModeToggle = document.getElementById('searchModeToggle');
  if (searchModeToggle) {
    searchModeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.search-mode-btn');
      if (!btn || btn.classList.contains('active')) return;

      // Switch mode
      searchModeToggle.querySelectorAll('.search-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      searchMode = btn.dataset.mode;

      // Update placeholder
      if (searchMode === 'dict') {
        searchInput.placeholder = currentLang === 'en' ? 'Search dictionary…'
          : currentLang === 'ja' ? '辞書検索…'
          : currentLang === 'ko' ? '사전 검색…'
          : currentLang === 'zh-CN' ? '词典查词…'
          : '詞典查詞…';
      } else {
        searchInput.placeholder = t('wordbookSearchPlaceholder');
      }

      // Clear and re-trigger search with current query
      const query = searchInput.value.trim();
      if (searchMode === 'wordbook') {
        hideDictDropdown();
        searchQuery = query;
        renderList();
      } else {
        // In dict mode, restore the full word list
        searchQuery = '';
        renderList();
        // Trigger dict search if there's text
        if (query.length >= 1) {
          buildDictSearchIndex();
          const results = searchDictionary(query);
          renderDictDropdown(results, query);
        }
      }

      searchInput.focus();
    });
  }

  // Build a flat search index from dictionary for faster lookup
  let dictSearchIndex = null;

  function buildDictSearchIndex() {
    if (!dictionary || dictSearchIndex) return;
    dictSearchIndex = [];
    for (const key of Object.keys(dictionary)) {
      const entry = dictionary[key];
      dictSearchIndex.push({
        key,
        traditional: entry.traditional || '',
        simplified: entry.simplified || '',
        jyutping: (entry.jyutping || '').toLowerCase(),
        pinyin: (entry.pinyin || '').toLowerCase(),
        english: (entry.english || []).join(' ').toLowerCase(),
        entry
      });
    }
  }

  function searchDictionary(query) {
    if (!dictSearchIndex || !query || query.length < 1) return [];

    const q = query.toLowerCase();
    const results = [];
    const savedChars = new Set(wordbook.map(w => w.character));
    const seenTraditional = new Set(); // Deduplicate entries with same traditional form
    const MAX_RESULTS = 30;

    // Detect query type
    const isLatin = /^[a-zA-Z0-9\s]+$/.test(query);
    const isChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(query);
    // Toneless mode: query has letters but no digits (e.g. 'hoeng gong')
    const hasTones = /\d/.test(query);
    const stripTones = (s) => s.replace(/[0-9]/g, '');
    const qNoTone = hasTones ? q : stripTones(q);

    // Pass 1: Exact matches first (e.g. '香港' before '香港仔', 'hoeng1 gong2' exact)
    for (let i = 0; i < dictSearchIndex.length && results.length < MAX_RESULTS; i++) {
      const item = dictSearchIndex[i];
      if (seenTraditional.has(item.traditional)) continue;
      let isExact = false;
      if (isChinese && (item.traditional === query || item.simplified === query)) {
        isExact = true;
      } else if (isLatin) {
        if (hasTones && (item.jyutping === q || item.pinyin === q)) {
          isExact = true;
        } else if (!hasTones && (stripTones(item.jyutping) === qNoTone || stripTones(item.pinyin) === qNoTone)) {
          isExact = true;
        }
      }
      if (isExact) {
        seenTraditional.add(item.traditional);
        results.push({ ...item, matchType: isChinese ? 'char-exact' : 'jyutping-exact', isSaved: savedChars.has(item.traditional) });
      }
    }

    // Pass 2: Partial / prefix matches
    for (let i = 0; i < dictSearchIndex.length && results.length < MAX_RESULTS; i++) {
      const item = dictSearchIndex[i];
      if (seenTraditional.has(item.traditional)) continue;

      let matched = false;
      let matchType = '';

      if (isChinese) {
        if (item.traditional.includes(query) || item.simplified.includes(query)) {
          matched = true;
          matchType = 'char';
        }
      } else if (isLatin) {
        // Compare with or without tones
        const itemJp = hasTones ? item.jyutping : stripTones(item.jyutping);
        const itemPy = hasTones ? item.pinyin : stripTones(item.pinyin);
        const cmpQ = hasTones ? q : qNoTone;

        if (itemJp.startsWith(cmpQ) || itemJp === cmpQ) {
          matched = true;
          matchType = 'jyutping-exact';
        } else if (itemPy.startsWith(cmpQ) || itemPy === cmpQ) {
          matched = true;
          matchType = 'pinyin-exact';
        } else if (itemJp.includes(cmpQ)) {
          matched = true;
          matchType = 'jyutping';
        } else if (itemPy.includes(cmpQ)) {
          matched = true;
          matchType = 'pinyin';
        } else if (item.english.includes(q)) {
          matched = true;
          matchType = 'english';
        }
      } else {
        if (item.traditional.includes(query) || item.simplified.includes(query)) {
          matched = true;
          matchType = 'char';
        } else if (item.jyutping.includes(q)) {
          matched = true;
          matchType = 'jyutping';
        }
      }

      if (matched) {
        seenTraditional.add(item.traditional);
        results.push({
          ...item,
          matchType,
          isSaved: savedChars.has(item.traditional)
        });
      }
    }

    results.sort((a, b) => {
      // Exact character match first
      if (a.matchType === 'char-exact' && b.matchType !== 'char-exact') return -1;
      if (a.matchType !== 'char-exact' && b.matchType === 'char-exact') return 1;
      if (a.matchType === 'char' && b.matchType !== 'char') return -1;
      if (a.matchType !== 'char' && b.matchType === 'char') return 1;
      if (a.matchType.includes('exact') && !b.matchType.includes('exact')) return -1;
      if (!a.matchType.includes('exact') && b.matchType.includes('exact')) return 1;
      return a.traditional.length - b.traditional.length;
    });

    return results;
  }

  function renderDictDropdown(results, query) {
    if (!results || results.length === 0) {
      if (query && query.length >= 1) {
        dictSearchDropdown.innerHTML = `<div class="dict-dropdown-empty">未在詞典中找到匹配結果</div>`;
        dictSearchDropdown.classList.add('show');
      } else {
        dictSearchDropdown.classList.remove('show');
      }
      dictResults = [];
      dictActiveIndex = -1;
      return;
    }

    dictResults = results;
    dictActiveIndex = -1;

    let html = `<div class="dict-dropdown-header">
      <span>📖 詞典搜索</span>
      <span class="dict-count">${results.length} 個結果</span>
    </div>`;

    results.forEach((item, idx) => {
      const def = (item.entry.english || []).filter(d => !d.startsWith('[粵]')).slice(0, 2).join('; ') || '';
      const truncDef = def.length > 60 ? def.slice(0, 57) + '…' : def;
      const savedStar = item.isSaved ? '<span style="color:#D4AF37;font-size:20px;margin-left:5px;line-height:0;vertical-align:-1px;">★</span>' : '';

      html += `<div class="dict-dropdown-item" data-idx="${idx}" data-word="${item.key}">
        <span class="dict-item-char">${item.traditional}</span>
        <div class="dict-item-info">
          <div class="dict-item-jyutping"><span>${item.entry.jyutping || ''}</span>${savedStar}</div>
          <div class="dict-item-def">${truncDef}</div>
        </div>
      </div>`;
    });

    dictSearchDropdown.innerHTML = html;
    dictSearchDropdown.classList.add('show');
  }

  function hideDictDropdown() {
    dictSearchDropdown.classList.remove('show');
    dictResults = [];
    dictActiveIndex = -1;
  }

  function selectDictItem(index) {
    if (index < 0 || index >= dictResults.length) return;
    const item = dictResults[index];

    // Activate detail mode if not active
    if (!isDetailMode) {
      const detailModeToggleBtn = document.getElementById('detailModeToggleBtn');
      if (detailModeToggleBtn) detailModeToggleBtn.click();
    }

    renderDetailPanel(item.key);

    // Highlight in list if exists
    document.querySelectorAll('.table-row').forEach(r => {
      r.classList.remove('active-row');
      const charEl = r.querySelector('.word-character');
      if (charEl && charEl.dataset.word === item.key) {
        r.classList.add('active-row');
        r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    hideDictDropdown();
    searchInput.blur();
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();

    if (searchMode === 'wordbook') {
      // Wordbook mode: filter list, no dropdown
      searchQuery = query;
      renderList();
      hideDictDropdown();
    } else {
      // Dict mode: show dropdown, don't filter list
      searchQuery = '';
      renderList();
      clearTimeout(dictSearchTimer);
      if (!query || query.length < 1) {
        hideDictDropdown();
        return;
      }
      dictSearchTimer = setTimeout(() => {
        buildDictSearchIndex();
        const results = searchDictionary(query);
        renderDictDropdown(results, query);
      }, 150);
    }
  });

  // Keyboard navigation for dropdown
  searchInput.addEventListener('keydown', (e) => {
    if (searchMode !== 'dict') return;
    if (!dictSearchDropdown.classList.contains('show') || dictResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      dictActiveIndex = Math.min(dictActiveIndex + 1, dictResults.length - 1);
      updateDictActiveItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      dictActiveIndex = Math.max(dictActiveIndex - 1, 0);
      updateDictActiveItem();
    } else if (e.key === 'Enter' && dictActiveIndex >= 0) {
      e.preventDefault();
      selectDictItem(dictActiveIndex);
    } else if (e.key === 'Escape') {
      hideDictDropdown();
    }
  });

  function updateDictActiveItem() {
    dictSearchDropdown.querySelectorAll('.dict-dropdown-item').forEach((el, i) => {
      el.classList.toggle('active', i === dictActiveIndex);
      if (i === dictActiveIndex) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // Click handler for dropdown items
  dictSearchDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dict-dropdown-item');
    if (item) {
      const idx = parseInt(item.dataset.idx);
      selectDictItem(idx);
    }
  });

  // Prevent dropdown from closing when clicking inside it
  dictSearchDropdown.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      hideDictDropdown();
    }
  });

  // Reopen dropdown when refocusing search input with existing query
  searchInput.addEventListener('focus', () => {
    if (searchMode !== 'dict') return;
    const query = searchInput.value.trim();
    if (query && query.length >= 1 && dictResults.length === 0) {
      buildDictSearchIndex();
      const results = searchDictionary(query);
      renderDictDropdown(results, query);
    } else if (dictResults.length > 0) {
      dictSearchDropdown.classList.add('show');
    }
  });


  // Export dropdown
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    exportMenu.classList.remove('show');
  });

  exportMenu.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const format = btn.dataset.format;
    if (format) {
      await doExport(format);
      exportMenu.classList.remove('show');
    }
  });

  warningExportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    doExport('json');
  });

  // ==================== Multi-Engine TTS ====================
  const EDGE_TTS_DEFAULT_URL = 'http://114.55.243.162:8090';
  let speakingBtn = null;
  let speakingTimer = null;
  let currentAudio = null;

  function startSpeaking(btn) {
    if (speakingBtn) speakingBtn.classList.remove('speaking');
    if (speakingTimer) clearTimeout(speakingTimer);
    speakingBtn = btn;
    if (btn) btn.classList.add('speaking');
    // Fallback timeout: stop animation after 8s max
    speakingTimer = setTimeout(stopSpeaking, 8000);
  }

  function stopSpeaking() {
    if (speakingBtn) speakingBtn.classList.remove('speaking');
    speakingBtn = null;
    if (speakingTimer) { clearTimeout(speakingTimer); speakingTimer = null; }
  }

  function playTts(text, ttsBtn) {
    if (!text) return;
    // Stop any currently playing audio
    speechSynthesis.cancel();
    if (chrome.tts) chrome.tts.stop();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
    startSpeaking(ttsBtn);
    chrome.storage.sync.get([
      'ttsEngine', 'edgeTtsMode', 'edgeTtsUrl', 'azureTtsMode', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'ttsRate'
    ], async (result) => {
      const engine = result.ttsEngine || 'edgeTts';
      const rate = result.ttsRate || 0.9;

      if (engine === 'webSpeech') {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-HK';
        utterance.rate = rate;
        utterance.onend = stopSpeaking;
        utterance.onerror = stopSpeaking;
        const cantoneseVoice = speechSynthesis.getVoices().find(v => v.lang.startsWith('zh-HK'));
        if (cantoneseVoice) utterance.voice = cantoneseVoice;
        speechSynthesis.speak(utterance);
      } else if (engine === 'chromeTts') {
        if (chrome.tts) {
          chrome.tts.speak(text, {
            lang: 'zh-HK', rate: rate,
            onEvent: (e) => { if (e.type === 'end' || e.type === 'error') stopSpeaking(); }
          });
        }
      } else if (engine === 'edgeTts') {
        try {
          const baseUrl = (result.edgeTtsMode === 'custom' ? result.edgeTtsUrl : EDGE_TTS_DEFAULT_URL).replace(/\/$/, '');
          const resp = await fetch(baseUrl + '/v1/audio/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: text, voice: 'zh-HK-HiuMaanNeural', model: 'tts-1', speed: rate })
          });
          if (!resp.ok) throw new Error('Edge TTS error: ' + resp.status);
          const blob = await resp.blob();
          const audio = new Audio(URL.createObjectURL(blob));
          currentAudio = audio;
          audio.onended = () => { URL.revokeObjectURL(audio.src); currentAudio = null; stopSpeaking(); };
          audio.onerror = () => { currentAudio = null; stopSpeaking(); };
          audio.play();
        } catch (e) {
          console.warn('[Wordbook] Edge TTS failed, falling back to Chrome TTS:', e);
          if (chrome.tts) chrome.tts.speak(text, { lang: 'zh-HK', rate: rate });
          stopSpeaking();
        }
      } else if (engine === 'bertVits2') {
        try {
          const resp = await fetch('http://127.0.0.1:5000/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, speed: rate })
          });
          if (!resp.ok) throw new Error('BertVits2 error: ' + resp.status);
          const blob = await resp.blob();
          const audio = new Audio(URL.createObjectURL(blob));
          currentAudio = audio;
          audio.onended = () => { URL.revokeObjectURL(audio.src); currentAudio = null; stopSpeaking(); };
          audio.onerror = () => { currentAudio = null; stopSpeaking(); };
          audio.play();
        } catch (e) {
          console.warn('[Wordbook] BertVits2 failed, falling back to Chrome TTS:', e);
          if (chrome.tts) chrome.tts.speak(text, { lang: 'zh-HK', rate: rate });
          stopSpeaking();
        }
      } else if (engine === 'azureTts') {
        const action = result.azureTtsMode === 'custom' ? 'azureTtsSpeak' : 'azureTtsProxySpeak';
        const msg = { action, text, rate, azureVoice: result.azureTtsVoice || 'zh-HK-HiuMaanNeural' };
        if (result.azureTtsMode === 'custom') {
          msg.azureKey = result.azureTtsKey;
          msg.azureRegion = result.azureTtsRegion;
        }
        chrome.runtime.sendMessage(msg, (response) => {
          if (response && response.audioData) {
            const audio = new Audio(response.audioData);
            currentAudio = audio;
            audio.onended = () => { currentAudio = null; stopSpeaking(); };
            audio.onerror = () => { currentAudio = null; stopSpeaking(); };
            audio.play().catch(() => stopSpeaking());
          } else {
            if (chrome.tts) chrome.tts.speak(text, { lang: 'zh-HK', rate: rate });
            stopSpeaking();
          }
        });
      }
    });
  }

  // ==================== Event Handlers ====================

  // Word card events (delegated)
  wordListEl.addEventListener('click', async (e) => {
    // Row click selection for detail panel (only in Detail Mode)
    const row = e.target.closest('.table-row');
    if (isDetailMode && row && !e.target.closest('.bulk-actions') && !e.target.closest('.word-card-checkbox') && !e.target.closest('.word-character') && !e.target.closest('.jyutping-text')) {
      const charEl = row.querySelector('.word-character');
      if (charEl) {
        const character = charEl.dataset.word;
        // Toggle: clicking the same active row deselects it
        if (row.classList.contains('active-row')) {
          row.classList.remove('active-row');
          showGenericAiPanel();
          return;
        }
        document.querySelectorAll('.table-row').forEach(r => r.classList.remove('active-row'));
        row.classList.add('active-row');
        renderDetailPanel(character);
      }
    }

    // Character or Jyutping click → TTS
    const ttsTarget = e.target.closest('.word-character') || e.target.closest('.jyutping-text');
    if (ttsTarget) {
      e.stopPropagation();
      playTts(ttsTarget.dataset.word, ttsTarget);
      return;
    }



    // Checkbox
    const checkbox = e.target.closest('.word-card-checkbox');
    if (checkbox && checkbox.dataset.id) {
      const id = checkbox.dataset.id;
      if (checkbox.checked) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }
      updateSelectionUI();
      return;
    }
  });

  // Select all
  selectAllCheckbox.addEventListener('change', () => {
    if (selectAllCheckbox.checked) {
      filteredWords.forEach(w => selectedIds.add(w.id));
    } else {
      filteredWords.forEach(w => selectedIds.delete(w.id));
    }
    // Re-render to update checkboxes
    renderList();
  });

  // Bulk delete
  bulkDeleteBtn.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    const msg = t('wordbookDeleteConfirm').replace('{n}', selectedIds.size);
    if (!confirm(msg)) return;

    wordbook = wordbook.filter(w => !selectedIds.has(w.id));
    selectedIds.clear();
    await saveWordbook(wordbook);
    renderList();
    updateStats();
    updateStorage();
  });

  // ==================== Export ====================

  async function doExport(format) {
    const wb = await getWordbook();

    let content, mimeType, ext;

    switch (format) {
      case 'json':
        content = JSON.stringify(wb, null, 2);
        mimeType = 'application/json';
        ext = 'json';
        break;

      case 'csv': {
        const header = '漢字,粵拼,Yale,英文釋義,添加日期,來源\n';
        const rows = wb.map(w =>
          `"${w.character}","${w.jyutping}","${w.yale || ''}","${(w.english || []).join('; ')}","${new Date(w.timestamp).toLocaleDateString()}","${w.sourceUrl || ''}"`
        ).join('\n');
        content = '\uFEFF' + header + rows;
        mimeType = 'text/csv;charset=utf-8';
        ext = 'csv';
        break;
      }

      case 'markdown': {
        const mdHeader = '| 漢字 | 粵拼 | 英文 | 日期 |\n|------|------|------|------|\n';
        const mdRows = wb.map(w =>
          `| ${w.character} | ${w.jyutping} | ${(w.english || []).join('; ')} | ${new Date(w.timestamp).toLocaleDateString()} |`
        ).join('\n');
        content = `# 我的粵語生詞本\n\n共 ${wb.length} 詞\n\n${mdHeader}${mdRows}\n`;
        mimeType = 'text/markdown';
        ext = 'md';
        break;
      }

      case 'txt':
        content = wb.map(w =>
          `${w.character}\t${w.jyutping}\t${(w.english || []).join('; ')}`
        ).join('\n');
        mimeType = 'text/plain';
        ext = 'txt';
        break;

      default:
        return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wordbook_${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==================== Import ====================

  let pendingImportData = null;

  importBtn.addEventListener('click', () => {
    importModal.classList.add('show');
    exportMenu.classList.remove('show');
    resetImportUI();
  });

  importCancelBtn.addEventListener('click', () => {
    importModal.classList.remove('show');
    resetImportUI();
  });

  importModal.addEventListener('click', (e) => {
    if (e.target === importModal) {
      importModal.classList.remove('show');
      resetImportUI();
    }
  });

  chooseFileLink.addEventListener('click', (e) => {
    e.preventDefault();
    importFileInput.click();
  });

  dropZone.addEventListener('click', () => {
    importFileInput.click();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processImportFile(file);
  });

  importFileInput.addEventListener('change', () => {
    if (importFileInput.files[0]) {
      processImportFile(importFileInput.files[0]);
    }
  });

  function resetImportUI() {
    pendingImportData = null;
    importPreview.style.display = 'none';
    importPreview.innerHTML = '';
    importConfirmBtn.style.display = 'none';
    importFileInput.value = '';
    dropZone.style.display = 'block';
  }

  async function processImportFile(file) {
    const text = await file.text();
    let data;

    try {
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('JSON must be an array');
      } else if (file.name.endsWith('.csv')) {
        data = parseCSV(text);
      } else {
        throw new Error('Unsupported file format');
      }
    } catch (err) {
      importPreview.innerHTML = `<span style="color: #ef4444">❌ ${err.message}</span>`;
      importPreview.style.display = 'block';
      return;
    }

    // Preview
    const existingChars = new Set(wordbook.map(w => w.character));
    let newCount = 0, skipCount = 0;
    data.forEach(item => {
      if (existingChars.has(item.character)) skipCount++;
      else newCount++;
    });

    pendingImportData = data;
    dropZone.style.display = 'none';
    importPreview.innerHTML = `
      <p>📄 <strong>${file.name}</strong></p>
      <p>總詞數：${data.length}</p>
      <p>新增：<strong>${newCount}</strong> | 重複（跳過）：${skipCount}</p>
    `;
    importPreview.style.display = 'block';
    importConfirmBtn.style.display = 'inline-flex';
  }

  importConfirmBtn.addEventListener('click', async () => {
    if (!pendingImportData) return;

    const existingChars = new Set(wordbook.map(w => w.character));
    let added = 0, skipped = 0;

    for (const item of pendingImportData) {
      if (!item.character || existingChars.has(item.character)) {
        skipped++;
        continue;
      }

      wordbook.unshift({
        id: 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        character: item.character,
        simplified: item.simplified || item.character,
        jyutping: item.jyutping || '',
        yale: item.yale || '',
        english: Array.isArray(item.english) ? item.english : (item.english ? [item.english] : []),
        timestamp: item.timestamp || Date.now(),
        sourceUrl: item.sourceUrl || '',
        sourceTitle: item.sourceTitle || '',
        tags: item.tags || [],
        notes: item.notes || ''
      });
      existingChars.add(item.character);
      added++;
    }

    await saveWordbook(wordbook);
    importModal.classList.remove('show');
    resetImportUI();
    renderList();
    updateStats();
    updateStorage();

    alert(t('wordbookImportSuccess').replace('{added}', added).replace('{skipped}', skipped));
  });

  function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    // Auto-detect header
    const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

    return lines.slice(1).map(line => {
      const cols = line.match(/(".*?"|[^",]+|(?<=,)(?=,))/g) || [];
      const clean = cols.map(c => c.replace(/^"|"$/g, '').trim());

      const charIdx = header.findIndex(h => /漢字|character|字/i.test(h));
      const jpIdx = header.findIndex(h => /粵拼|jyutping/i.test(h));
      const yaleIdx = header.findIndex(h => /yale/i.test(h));
      const enIdx = header.findIndex(h => /英文|english|釋義|definition/i.test(h));

      return {
        character: clean[charIdx !== -1 ? charIdx : 0] || '',
        jyutping: clean[jpIdx !== -1 ? jpIdx : 1] || '',
        yale: clean[yaleIdx !== -1 ? yaleIdx : 2] || '',
        english: (clean[enIdx !== -1 ? enIdx : 3] || '').split(';').map(s => s.trim()).filter(Boolean)
      };
    }).filter(item => item.character);
  }

  // ==================== Detail Panel Rendering ====================

  function showGenericAiPanel() {
    const detailPane = document.getElementById('detailPane');
    if (!detailPane) return;
    detailPane.style.display = 'flex';
    delete detailPane.dataset.activeWord;

    detailPane.innerHTML = `
      <div class="detail-empty-state" style="flex: 1;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 8px;">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <p style="font-size: 13px; margin: 0;">點擊左側單詞查看詳情</p>
        <p style="font-size: 11px; margin: 4px 0 0; opacity: 0.6;">或直接在下方提問</p>
      </div>
      <div class="ai-response-area" id="aiResponseArea"></div>
      <div class="ai-chat-section" id="aiChatSection">
        <div class="ai-chat-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          AI 問答
        </div>
        <div class="ai-input-row">
          <input class="ai-input" id="aiChatInput" type="text" placeholder="問任何關於粵語的問題..." />
          <button class="ai-send-btn" id="aiSendBtn" title="發送">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    `;

    // Bind generic AI chat
    const aiChatSection = document.getElementById('aiChatSection');
    const aiChatInput = document.getElementById('aiChatInput');
    const aiSendBtn = document.getElementById('aiSendBtn');
    const aiResponseArea = document.getElementById('aiResponseArea');

    if (!aiChatSection) return;

    chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel'], (settings) => {
      const { aiBaseUrl, aiApiKey, aiModel } = settings;
      if (!aiBaseUrl || !aiApiKey || !aiModel) {
        aiChatSection.querySelector('.ai-input-row').style.display = 'none';
        aiResponseArea.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">尚未配置 AI API，<a id="aiGoToSettings" style="color: var(--primary); cursor: pointer; text-decoration: none;">前往設定</a></div>`;
        const goBtn = document.getElementById('aiGoToSettings');
        if (goBtn) goBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openOptionsPage' }));
        return;
      }
    });

    let aiChatHistory = [];
    let aiIsLoading = false;

    const sendGenericQuestion = (question) => {
      if (!question.trim() || aiIsLoading) return;
      aiIsLoading = true;
      aiSendBtn.disabled = true;
      aiChatInput.disabled = true;
      const startTime = performance.now();

      aiResponseArea.innerHTML = `
        <div class="ai-typing-indicator">
          <div class="ai-typing-dot"></div>
          <div class="ai-typing-dot"></div>
          <div class="ai-typing-dot"></div>
        </div>
      `;

      chrome.runtime.sendMessage({
        action: 'aiChatQuery',
        word: '',
        sentence: '',
        originalTranslation: '',
        question: question,
        history: aiChatHistory
      }, (response) => {
        aiIsLoading = false;
        aiSendBtn.disabled = false;
        aiChatInput.disabled = false;
        aiChatInput.focus();
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

        if (response && response.success) {
          aiChatHistory.push({ role: 'user', content: question });
          aiChatHistory.push({ role: 'assistant', content: response.reply });
          aiResponseArea.innerHTML = `<div class="ai-response-bubble"><div class="ai-response-meta"><span class="ai-badge">AI</span><span class="ai-timing">思考了 ${elapsed}s</span></div><div class="ai-response-content">${renderSimpleMarkdown(response.reply)}</div></div>`;
        } else {
          const errMsg = response?.error || '請求失敗';
          aiResponseArea.innerHTML = `<div class="ai-response-bubble"><div class="ai-response-meta"><span class="ai-badge">AI</span><span class="ai-timing">${elapsed}s</span></div><div class="ai-response-content" style="color: var(--text-muted);">${escapeHtml(errMsg)}</div></div>`;
        }
      });
    };

    aiSendBtn.addEventListener('click', () => {
      sendGenericQuestion(aiChatInput.value);
      aiChatInput.value = '';
    });

    aiChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        sendGenericQuestion(aiChatInput.value);
        aiChatInput.value = '';
      }
    });
  }

  function renderDetailPanel(character) {
    const detailPane = document.getElementById('detailPane');
    if (!detailPane) return;
    
    detailPane.style.display = 'flex';
    detailPane.dataset.activeWord = character;

    if (!dictionary || !dictionary[character]) {
      detailPane.innerHTML = `
        <div class="detail-empty-state">
          <p>詞典中未找到 <strong>${character}</strong> 的詳細釋義。</p>
        </div>
      `;
      return;
    }

    const entry = dictionary[character];
    const pronunciation = entry.jyutping || '';
    const isSaved = wordbook.some(w => w.character === character);
    
    // Header
    let html = `
      <div id="cantonese-popup-dict" style="position: static; width: 100%; filter: none; margin: 0; padding: 0; background: transparent;">
        <div class="popup-main" style="width: 100%; min-width: auto; padding: 0; position: relative;">
          <!-- Action Buttons -->
          <div class="detail-actions-wrapper" id="detailActionsWrapper">
            <div class="detail-report-btn" id="detailReportBtn" title="報告錯誤">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 3px;">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
              <span>報告</span>
            </div>
            <div class="detail-bookmark-btn" id="detailBookmarkBtn" title="${isSaved ? '從生詞本移除' : '加入生詞本'}">
              <svg width="14" height="14" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                ${isSaved
                  ? '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#D4AF37" stroke="#D4AF37" stroke-width="1.5"></polygon>'
                  : '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" stroke-width="1.5"></polygon>'
                }
              </svg>
            </div>
          </div>
          <div class="word-section" style="cursor: pointer; border-bottom: none; padding-bottom: 0;" id="detailWordSection">
            <span class="word-text" style="font-size: 28px;">${entry.traditional}</span>
            ${entry.simplified !== entry.traditional ? `<span class="word-simplified" style="font-size: 18px;">${entry.simplified}</span>` : ''}
          </div>
    `;

    if (pronunciation) {
      html += `
        <div class="pronunciation-section" style="margin-top: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--popup-divider-strong); padding-bottom: 12px;">
          <span class="pronunciation-label">粵拼:</span>
          <span class="pronunciation-text" id="detailPronunciationText" style="cursor: pointer; font-size: 15px;">${pronunciation}</span>
          <button class="tts-speaker-btn" id="detailSpeakerBtn" title="播放發音" aria-label="播放發音">
            <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </button>
        </div>
      `;
    }

    // Definitions
    if (entry.english && entry.english.length > 0) {
      const defItems = entry.english.slice(0, 10).map((def, idx) => {
        let className = 'def-item';
        if (def.startsWith('[粵]')) {
          className += ' def-yue';
        }
        
        let exampleHtml = '';
        if (entry.examples && entry.examples[idx] && entry.examples[idx].length > 0) {
          const exList = entry.examples[idx].map(ex => `
            <div class="example-item" style="margin-bottom: 6px; cursor: text;">
              <div style="color: var(--text-primary); font-size: 15px; display: flex; align-items: center;">
                <span>${ex.yue}</span>
                <button class="tts-speaker-btn example-tts-btn" data-text="${ex.yue.replace(/"/g, '&quot;')}" title="播放發音" aria-label="播放發音" style="margin-left: 6px; transform: scale(0.85); transform-origin: left center; cursor: pointer; border: none; background: transparent;">
                  <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                  </svg>
                </button>
              </div>
              <div style="color: var(--text-muted); font-size: 13px; margin-top: 2px;">${ex.eng}</div>
            </div>
          `).join('');
          
          exampleHtml = `
            <div class="def-examples" style="display: none; margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--primary);">
              ${exList}
            </div>
          `;
          
          // Make the definition clickable to expand examples
          return `
            <div class="${className} has-inline-examples" style="position: relative;">
              <div class="def-text" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <span>${def}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; flex-shrink: 0; margin-left: 8px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              ${exampleHtml}
            </div>
          `;
        }
        
        return `<div class="${className}">${def}</div>`;
      }).join('');
      
      html += `
        <div class="definition-section">
          ${defItems}
        </div>
      `;
    }
    
    // Related Words
    const refLines = [];
    if (entry.sims && entry.sims.length > 0) {
      const simLinks = entry.sims.map(w => `<span class="see-also-link" data-word="${w}">${w}</span>`).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">近義：</span>${simLinks}</div>`);
    }
    if (entry.ants && entry.ants.length > 0) {
      const antLinks = entry.ants.map(w => `<span class="see-also-link" data-word="${w}">${w}</span>`).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">反義：</span>${antLinks}</div>`);
    }
    if (entry.see_also && entry.see_also.length > 0) {
      const seeLinks = entry.see_also.map(w => `<span class="see-also-link" data-word="${w}">${w}</span>`).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">異體：</span>${seeLinks}</div>`);
    }
    
    if (refLines.length > 0) {
      html += `<div class="see-also-section" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--popup-divider-strong);">${refLines.join('')}</div>`;
    }

    // Report Form (hidden by default)
    html += `
      <div class="detail-report-form" id="detailReportForm" style="display: none;">
        <div class="detail-report-header">
          <span>報告錯誤</span>
          <span class="detail-report-close" id="detailReportClose">✕</span>
        </div>
        <div class="detail-report-preview">
          <div><strong>詞語：</strong><span id="detailReportWord">${character}</span></div>
        </div>
        <textarea id="detailReportTextarea" class="detail-report-textarea" placeholder="請描述具體的錯誤（例如讀音不正確、釋義有誤等）..."></textarea>
        <div class="detail-report-actions">
          <button class="btn" id="detailReportCancelBtn">取消</button>
          <button class="btn btn-primary" id="detailReportSendBtn">發送報告</button>
        </div>
      </div>
    `;

    // Close popup-main and cantonese-popup-dict first
    html += `
        </div>
      </div>
    `;

    // AI Response Area — placed between dictionary content and AI controls
    html += `<div class="ai-response-area" id="aiResponseArea"></div>`;

    // AI Chat Controls — pushed to bottom via margin-top: auto
    html += `
      <div class="ai-chat-section" id="aiChatSection" style="margin-top: auto;">
        <div class="ai-chat-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          AI 問答
        </div>
        <div class="ai-quick-questions" id="aiQuickQuestions">
          <button class="ai-quick-btn" data-q="用呢個詞造一個粵語例句">造句</button>
          <button class="ai-quick-btn" data-q="呢個詞嘅粵語語源係咩？">語源</button>
          <button class="ai-quick-btn" data-q="呢個詞喺日常粵語入面點用？">日常用法</button>
          <button class="ai-quick-btn" data-q="呢個詞有咩近義詞同反義詞？">近義反義</button>
        </div>
        <div class="ai-input-row">
          <input class="ai-input" id="aiChatInput" type="text" placeholder="問關於「${character}」的問題..." data-word="${character}" />
          <button class="ai-send-btn" id="aiSendBtn" title="發送">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    `;

    detailPane.innerHTML = html;

    // Bind TTS
    const triggerTTS = () => playTts(entry.traditional, document.getElementById('detailSpeakerBtn'));
    const wordSec = document.getElementById('detailWordSection');
    const pronText = document.getElementById('detailPronunciationText');
    const speakBtn = document.getElementById('detailSpeakerBtn');
    
    if (wordSec) wordSec.addEventListener('click', triggerTTS);
    if (pronText) pronText.addEventListener('click', triggerTTS);
    if (speakBtn) speakBtn.addEventListener('click', triggerTTS);
    
    // Bind Example Toggles
    detailPane.querySelectorAll('.has-inline-examples .def-text').forEach(defText => {
      defText.addEventListener('click', (e) => {
        const examplesDiv = e.currentTarget.nextElementSibling;
        const icon = e.currentTarget.querySelector('svg');
        if (examplesDiv.style.display === 'none') {
          examplesDiv.style.display = 'block';
          icon.style.transform = 'rotate(180deg)';
        } else {
          examplesDiv.style.display = 'none';
          icon.style.transform = '';
        }
      });
    });

    // Bind Example TTS
    detailPane.querySelectorAll('.example-tts-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playTts(btn.dataset.text, btn);
      });
    });

    // Bind See Also Links
    detailPane.querySelectorAll('.see-also-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const word = link.dataset.word;
        if (dictionary[word]) {
          renderDetailPanel(word);
          // Highlight in list if exists
          document.querySelectorAll('.table-row').forEach(r => {
            r.classList.remove('active-row');
            const charEl = r.querySelector('.word-character');
            if (charEl && charEl.dataset.word === word) {
              r.classList.add('active-row');
              r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          });
        }
      });
    });

    // Bind Bookmark Button
    const bookmarkBtn = document.getElementById('detailBookmarkBtn');
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Bounce animation
        bookmarkBtn.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
        bookmarkBtn.style.transform = 'scale(1.3)';
        setTimeout(() => { bookmarkBtn.style.transform = 'scale(1)'; }, 200);

        const isSavedNow = wordbook.some(w => w.character === character);
        if (isSavedNow) {
          // Remove from wordbook
          wordbook = wordbook.filter(w => w.character !== character);
          await saveWordbook(wordbook);
          renderList();
          updateStats();
          updateStorage();
          // Update button state
          const svg = bookmarkBtn.querySelector('svg');
          svg.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" stroke-width="1.5"></polygon>';
          bookmarkBtn.title = '加入生詞本';
        } else {
          // Add to wordbook
          const newWord = {
            id: 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            character: character,
            simplified: entry.simplified || character,
            jyutping: entry.jyutping || '',
            yale: entry.yale || '',
            english: entry.english || [],
            timestamp: Date.now(),
            sourceUrl: '',
            sourceTitle: '',
            tags: [],
            notes: ''
          };
          wordbook.unshift(newWord);
          await saveWordbook(wordbook);
          renderList();
          updateStats();
          updateStorage();
          // Update button state
          const svg = bookmarkBtn.querySelector('svg');
          svg.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#D4AF37" stroke="#D4AF37" stroke-width="1.5"></polygon>';
          bookmarkBtn.title = '從生詞本移除';
        }
      });
    }

    // Bind Report Button
    const reportBtn = document.getElementById('detailReportBtn');
    const reportForm = document.getElementById('detailReportForm');
    const reportClose = document.getElementById('detailReportClose');
    const reportCancel = document.getElementById('detailReportCancelBtn');
    const reportSend = document.getElementById('detailReportSendBtn');

    if (reportBtn && reportForm) {
      reportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        reportForm.style.display = 'block';
      });

      const closeReport = () => {
        reportForm.style.display = 'none';
        const textarea = document.getElementById('detailReportTextarea');
        if (textarea) textarea.value = '';
      };

      if (reportClose) reportClose.addEventListener('click', closeReport);
      if (reportCancel) reportCancel.addEventListener('click', closeReport);

      if (reportSend) {
        reportSend.addEventListener('click', async (e) => {
          e.stopPropagation();
          const originalText = reportSend.textContent;
          reportSend.textContent = '發送中...';
          reportSend.style.opacity = '0.8';
          reportSend.style.pointerEvents = 'none';

          const userDesc = document.getElementById('detailReportTextarea').value;
          const subject = `[Jyutping Extension] 錯誤報告: ${character}`;
          const message = `【單詞】：${character}\n【來源】：生詞本詞典面板\n\n【錯誤描述】：\n${userDesc || '未提供具體描述'}`;

          try {
            const response = await fetch('https://api.web3forms.com/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({
                access_key: 'd19a0594-b64b-4593-b0e1-baf1cbeb6a4c',
                subject,
                from_name: 'Jyutping Extension',
                message
              })
            });
            const result = await response.json();
            if (response.status === 200) {
              reportSend.textContent = '✓ 報告已送出';
              reportSend.style.background = '#4caf50';
              reportSend.style.borderColor = '#4caf50';
            } else {
              reportSend.textContent = '❌ 發送失敗';
              reportSend.style.background = '#f44336';
              reportSend.style.borderColor = '#f44336';
              console.error('Email API Error:', result);
            }
          } catch (error) {
            reportSend.textContent = '❌ 網絡錯誤';
            reportSend.style.background = '#f44336';
            reportSend.style.borderColor = '#f44336';
            console.error('Network Error:', error);
          }

          setTimeout(() => {
            reportSend.textContent = originalText;
            reportSend.style.background = '';
            reportSend.style.borderColor = '';
            reportSend.style.opacity = '1';
            reportSend.style.pointerEvents = 'auto';
            closeReport();
          }, 1500);
        });
      }
    }

    // ==================== AI Chat Section Binding ====================
    const aiChatSection = document.getElementById('aiChatSection');
    const aiChatInput = document.getElementById('aiChatInput');
    const aiSendBtn = document.getElementById('aiSendBtn');
    const aiResponseArea = document.getElementById('aiResponseArea');
    const aiQuickQuestions = document.getElementById('aiQuickQuestions');

    if (aiChatSection) {
      // Check if AI is configured
      chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel'], (settings) => {
        const { aiBaseUrl, aiApiKey, aiModel } = settings;
        if (!aiBaseUrl || !aiApiKey || !aiModel) {
          // Show subtle hint at bottom
          aiChatSection.querySelector('.ai-quick-questions').style.display = 'none';
          aiChatSection.querySelector('.ai-input-row').style.display = 'none';
          aiResponseArea.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">尚未配置 AI API，<a id="aiGoToSettings" style="color: var(--primary); cursor: pointer; text-decoration: none;">前往設定</a></div>`;
          const goBtn = document.getElementById('aiGoToSettings');
          if (goBtn) {
            goBtn.addEventListener('click', () => {
              chrome.runtime.sendMessage({ action: 'openOptionsPage' });
            });
          }
          return;
        }
      });

      let aiChatHistory = [];
      let aiIsLoading = false;

      const sendAiQuestion = (question) => {
        if (!question.trim() || aiIsLoading) return;
        aiIsLoading = true;
        aiSendBtn.disabled = true;
        aiChatInput.disabled = true;

        const startTime = performance.now();

        // Show typing indicator
        aiResponseArea.innerHTML = `
          <div class="ai-typing-indicator">
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
          </div>
        `;

        // Build context from dictionary entry
        const definitions = (entry.english || [])
          .filter(d => d)
          .map(d => typeof d === 'string' ? d : '')
          .filter(Boolean)
          .join('; ');

        chrome.runtime.sendMessage({
          action: 'aiChatQuery',
          word: character,
          sentence: `${character}（${pronunciation}）：${definitions}`,
          originalTranslation: definitions,
          question: question,
          history: aiChatHistory
        }, (response) => {
          aiIsLoading = false;
          aiSendBtn.disabled = false;
          aiChatInput.disabled = false;
          aiChatInput.focus();

          const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

          if (response && response.success) {
            // Add to conversation history
            aiChatHistory.push({ role: 'user', content: question });
            aiChatHistory.push({ role: 'assistant', content: response.reply });

            aiResponseArea.innerHTML = `<div class="ai-response-bubble"><div class="ai-response-meta"><span class="ai-badge">AI</span><span class="ai-timing">思考了 ${elapsed}s</span></div><div class="ai-response-content">${renderSimpleMarkdown(response.reply)}</div></div>`;
          } else {
            const errMsg = response?.error || '請求失敗';
            aiResponseArea.innerHTML = `<div class="ai-response-bubble"><div class="ai-response-meta"><span class="ai-badge">AI</span><span class="ai-timing">${elapsed}s</span></div><div class="ai-response-content" style="color: var(--text-muted);">${escapeHtml(errMsg)}</div></div>`;
          }
        });
      };

      // Bind send button
      if (aiSendBtn) {
        aiSendBtn.addEventListener('click', () => {
          sendAiQuestion(aiChatInput.value);
          aiChatInput.value = '';
        });
      }

      // Bind Enter key
      if (aiChatInput) {
        aiChatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            sendAiQuestion(aiChatInput.value);
            aiChatInput.value = '';
          }
        });
      }

      // Bind quick question buttons
      if (aiQuickQuestions) {
        aiQuickQuestions.querySelectorAll('.ai-quick-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const q = btn.dataset.q;
            aiChatInput.value = q;
            sendAiQuestion(q);
            aiChatInput.value = '';
          });
        });
      }
    }
  }

  // ==================== Storage Change Listener ====================

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[WORDBOOK_KEY]) {
      wordbook = changes[WORDBOOK_KEY].newValue || [];
      renderList();
      updateStats();
      updateStorage();
    }
  });

  // ==================== Init ====================

  async function init() {
    initTheme();

    // Detect language
    chrome.storage.local.get(['extensionLang'], (res) => {
      if (res.extensionLang) currentLang = res.extensionLang;
      applyI18n();
    });

    // Load wordbook
    wordbook = await getWordbook();
    
    // Load dictionary for the detail panel
    try {
      const url = chrome.runtime.getURL('dictionary.json');
      const res = await fetch(url);
      dictionary = await res.json();
    } catch (e) {
      console.error('Failed to load dictionary.json', e);
      dictionary = {};
    }

    // Detail Mode Toggle
    const detailModeToggleBtn = document.getElementById('detailModeToggleBtn');
    if (detailModeToggleBtn) {
      document.body.classList.toggle('detail-mode-active', isDetailMode);
      if (isDetailMode) {
        detailModeToggleBtn.classList.add('btn-primary', 'active');
        showGenericAiPanel();
      } else {
        detailModeToggleBtn.classList.remove('btn-primary', 'active');
      }

      detailModeToggleBtn.addEventListener('click', () => {
        isDetailMode = !isDetailMode;
        localStorage.setItem('jyutping_detail_mode', isDetailMode);
        document.body.classList.toggle('detail-mode-active', isDetailMode);
        
        if (isDetailMode) {
          detailModeToggleBtn.classList.add('btn-primary', 'active');
          showGenericAiPanel();
        } else {
          detailModeToggleBtn.classList.remove('btn-primary', 'active');
          // Remove active rows if disabled
          document.querySelectorAll('.table-row').forEach(r => r.classList.remove('active-row'));
          
          // Reset panel state and let CSS handle visibility
          const detailPane = document.getElementById('detailPane');
          if (detailPane) {
            detailPane.style.display = '';
            detailPane.innerHTML = '';
          }
        }
        renderList();
      });
    }

    renderList();
    updateStats();
    updateStorage();
  }

  init();
})();
