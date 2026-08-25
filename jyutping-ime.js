/**
 * jyutping-ime.js
 * 輕量級網頁版粵拼輸入法 (TypeDuck 風格)
 * 支援無調/帶調粵拼檢索、常用字詞頻優先、詞義提示、數字鍵與空格選字、深淺色主題自適應
 */
(function (global) {
  'use strict';

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 粵語拼音容錯規範化 (支援常見粵語羅馬化變體)
  function normalizeJyutpingFuzzy(str) {
    return str.toLowerCase()
      .replace(/eu/g, 'oe')
      .replace(/ch/g, 'c')
      .replace(/sh/g, 's')
      .replace(/ts/g, 'c')
      .replace(/dz/g, 'z');
  }

  // 粵拼聲調字母映射 (TypeDuck / Rime 粵拼規範：v->1, x->2, q->3, vv->4, xx->5, qq->6)
  function convertToneLettersToDigits(query) {
    return query
      .replace(/vv$/i, '4')
      .replace(/xx$/i, '5')
      .replace(/qq$/i, '6')
      .replace(/v$/i, '1')
      .replace(/x$/i, '2')
      .replace(/q$/i, '3');
  }

  // ==================== 1. 粵拼檢索引擎 ====================

  class JyutpingImeEngine {
    constructor() {
      this.charBySyllable = new Map();  // rawJp -> array of single characters
      this.wordBySyllable = new Map();  // rawJp -> array of multi-character words
      this.tonedIndex = new Map();      // tonedJp -> array of Candidate (exact)
      this.validSyllables = new Set();  // 合法單字音節集合 (用於分音切分)
      this.isReady = false;
    }

    init(dict) {
      if (!dict || typeof dict !== 'object') return;
      this.charBySyllable.clear();
      this.wordBySyllable.clear();
      this.tonedIndex.clear();
      this.validSyllables.clear();

      for (const [key, entry] of Object.entries(dict)) {
        if (!entry || !entry.jyutping) continue;
        const jp = entry.jyutping.toLowerCase().trim();
        const rawJp = jp.replace(/[1-6]/g, '').replace(/\s+/g, '');
        const tonedJp = jp.replace(/\s+/g, '');
        const trad = entry.traditional || key;

        // 收集所有合法單音節
        const syllables = jp.split(/\s+/);
        for (const s of syllables) {
          const sRaw = s.replace(/[1-6]/g, '').trim();
          if (sRaw) this.validSyllables.add(sRaw);
        }

        let exCount = 0;
        let exList = [];
        if (entry.examples && Array.isArray(entry.examples)) {
          for (const it of entry.examples) {
            if (Array.isArray(it)) {
              for (const sub of it) {
                if (sub && sub.yue) {
                  exList.push(sub);
                  exCount++;
                }
              }
            } else if (it && it.yue) {
              exList.push(it);
              exCount++;
            }
          }
        }

        // 計算詞頻評分
        let score = 0;
        score += exCount * 20;
        score += (entry.english || []).length * 5;
        if (trad.length === 1) score += 300;
        if (/^[0-9A-Za-z]+$/.test(trad)) score -= 500;

        // 超高頻常用口語字加權
        if ('係嘅唔乜咁點好咗喺我你佢哋睇邊度聽食瞓玩諗講搵買賣啱快遲仲未先話為回或和運位會問要年事做去得要過到生人天地心家'.includes(trad)) {
          score += 400;
        }

        // 精簡中英詞義 (TypeDuck 風格短釋義)
        let def = '';
        if (entry.english && entry.english.length > 0) {
          for (const e of entry.english) {
            const clean = e.replace(/^\[粵\]\s*/, '').replace(/^\(bound form\)\s*/, '').trim();
            if (clean && !clean.startsWith('[')) {
              def = clean.split(';')[0].split(',')[0].slice(0, 28);
              break;
            }
          }
          if (!def && entry.english[0]) {
            def = entry.english[0].replace(/^\[粵\]\s*/, '').slice(0, 28);
          }
        }

        const item = {
          word: trad,
          simplified: entry.simplified || trad,
          jyutping: jp,
          tonedJp: tonedJp,
          rawJp: rawJp,
          def: def,
          allDefs: (entry.english || []).map(e => e.replace(/^\[粵\]\s*/, '').trim()).filter(Boolean),
          examples: exList,
          score: score
        };

        // 加入帶調精確索引
        if (!this.tonedIndex.has(tonedJp)) this.tonedIndex.set(tonedJp, []);
        this.tonedIndex.get(tonedJp).push(item);

        // 分流到單字音節表與詞語音節表
        if (trad.length === 1) {
          if (!this.charBySyllable.has(rawJp)) this.charBySyllable.set(rawJp, []);
          this.charBySyllable.get(rawJp).push(item);
        } else {
          if (!this.wordBySyllable.has(rawJp)) this.wordBySyllable.set(rawJp, []);
          this.wordBySyllable.get(rawJp).push(item);
        }
      }

      // 音節內依詞頻預排序
      for (const list of this.charBySyllable.values()) {
        list.sort((a, b) => b.score - a.score);
      }
      for (const list of this.wordBySyllable.values()) {
        list.sort((a, b) => b.score - a.score);
      }
      for (const list of this.tonedIndex.values()) {
        list.sort((a, b) => b.score - a.score);
      }

      this.isReady = true;
    }

    search(rawQuery) {
      if (!this.isReady || !rawQuery) return [];
      const converted = convertToneLettersToDigits(rawQuery.toLowerCase().trim());
      const query = converted;
      const hasTone = /[1-6]$/.test(query);
      const raw = query.replace(/[1-6]/g, '');
      const fuzzy = normalizeJyutpingFuzzy(raw);
      const fuzzyToned = normalizeJyutpingFuzzy(query);

      const results = [];
      const seen = new Set();

      const addItem = (it) => {
        const key = it.word + '|' + it.jyutping;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(it);
        }
      };

      // 1. 若末尾含聲調數字 1-6
      if (hasTone) {
        if (this.tonedIndex.has(query)) {
          for (const it of this.tonedIndex.get(query)) addItem(it);
        }
        if (this.tonedIndex.has(fuzzyToned)) {
          for (const it of this.tonedIndex.get(fuzzyToned)) addItem(it);
        }
        return results;
      }

      // 2. 精確音節完全匹配 (當用戶輸入了完整音節如 'wui' 或 'dei' 時優先排列)
      if (this.charBySyllable.has(raw)) {
        for (const it of this.charBySyllable.get(raw)) addItem(it);
      }
      if (fuzzy !== raw && this.charBySyllable.has(fuzzy)) {
        for (const it of this.charBySyllable.get(fuzzy)) addItem(it);
      }
      if (this.wordBySyllable.has(raw)) {
        for (const it of this.wordBySyllable.get(raw)) addItem(it);
      }

      // 3. 前綴匹配：按字母升序 (Alphabetical Order: waa -> wai -> wo -> wu...)
      const matchingCharSyllables = Array.from(this.charBySyllable.keys())
        .filter(s => s.startsWith(raw) || (fuzzy !== raw && s.startsWith(fuzzy)))
        .sort((a, b) => a.localeCompare(b));

      // 第一輪：各前綴音節取頻率前 2 位單字 (多樣化覆蓋)
      for (const s of matchingCharSyllables) {
        const list = this.charBySyllable.get(s) || [];
        for (let i = 0; i < Math.min(2, list.length); i++) {
          addItem(list[i]);
        }
      }

      // 第二輪：追加各前綴音節剩餘單字
      for (const s of matchingCharSyllables) {
        const list = this.charBySyllable.get(s) || [];
        for (let i = 2; i < list.length; i++) {
          addItem(list[i]);
          if (results.length > 250) break;
        }
      }

      // 第三輪：追加多字詞前綴匹配 (按字母順序)
      const matchingWordSyllables = Array.from(this.wordBySyllable.keys())
        .filter(s => s.startsWith(raw) || (fuzzy !== raw && s.startsWith(fuzzy)))
        .sort((a, b) => a.localeCompare(b));

      for (const s of matchingWordSyllables) {
        const list = this.wordBySyllable.get(s) || [];
        for (const it of list) {
          addItem(it);
          if (results.length > 300) break;
        }
        if (results.length > 300) break;
      }

      return results;
    }

    // 正向最大匹配分音演算法 (Syllable Segmentation，純淨依用戶輸入切分，不污染/假造未輸入的聲調)
    segmentJyutping(input) {
      if (!input) return '';
      const raw = input.toLowerCase().trim();
      const tokens = [];
      let i = 0;

      while (i < raw.length) {
        // 若當前字符為聲調數字 1-6，附著到前一個音節末尾
        if (/[1-6]/.test(raw[i])) {
          if (tokens.length > 0) {
            tokens[tokens.length - 1] += raw[i];
          } else {
            tokens.push(raw[i]);
          }
          i++;
          continue;
        }

        // 正向最大匹配音節長度 6 到 1
        let matched = '';
        for (let len = Math.min(6, raw.length - i); len >= 1; len--) {
          const sub = raw.substring(i, i + len);
          if (this.validSyllables.has(sub)) {
            matched = sub;
            break;
          }
        }

        if (matched) {
          tokens.push(matched);
          i += matched.length;
        } else {
          tokens.push(raw[i]);
          i++;
        }
      }

      return tokens.join(' ');
    }
  }

  // ==================== 2. 網頁版輸入法控制器 ====================

  class JyutpingWebIme {
    constructor(engine, options = {}) {
      this.engine = engine;
      this.pageSize = options.pageSize || 6;
      this.enabled = localStorage.getItem('jyutping_web_ime_enabled') !== 'false';
      this.buffer = '';
      this.candidates = [];
      this.pageIndex = 0;
      this.selectedIndex = 0;
      this.activeDetailItem = null;
      this.targetInput = null;
      this.popoverEl = null;
      this.toggleBtnEl = null;
      this.onCommitCallback = options.onCommit || null;
      this.boundKeyHandler = this.handleKeyDown.bind(this);
      this.boundBlurHandler = this.handleBlur.bind(this);
      this.boundPositionHandler = this.updatePosition.bind(this);

      this.createPopover();
    }

    createPopover() {
      if (document.getElementById('jyutpingImePopover')) {
        this.popoverEl = document.getElementById('jyutpingImePopover');
        return;
      }
      const el = document.createElement('div');
      el.id = 'jyutpingImePopover';
      el.className = 'jyutping-ime-popover';
      el.style.display = 'none';
      document.body.appendChild(el);
      this.popoverEl = el;

      // 滑鼠移動/懸停在某個選項上時，才展開該詞條的側邊欄
      this.popoverEl.addEventListener('mouseover', (e) => {
        const itemEl = e.target.closest('.ime-candidate-item');
        if (itemEl && itemEl.dataset.index !== undefined && !e.target.closest('.ime-detail-panel')) {
          const idx = parseInt(itemEl.dataset.index, 10);
          const currentCandidates = this.getCurrentPageCandidates();
          const hoveredItem = currentCandidates[idx];
          if (hoveredItem && (this.activeDetailItem !== hoveredItem || this.selectedIndex !== idx)) {
            this.selectedIndex = idx;
            this.activeDetailItem = hoveredItem;
            this.renderPopover();
          }
        }
      });

      // 滑鼠移出整個候選浮窗時，自動關閉側邊欄 (還原為緊湊候選列表)
      this.popoverEl.addEventListener('mouseleave', () => {
        if (this.activeDetailItem) {
          this.activeDetailItem = null;
          this.renderPopover();
        }
      });

      // 點擊候選詞選中
      this.popoverEl.addEventListener('mousedown', (e) => {
        e.preventDefault(); // 防止失去 input 焦點

        // 點擊關閉詳情按鈕
        const closeDetailBtn = e.target.closest('.ime-detail-close-btn');
        if (closeDetailBtn) {
          e.stopPropagation();
          this.activeDetailItem = null;
          this.renderPopover();
          return;
        }

        // 點擊候選詞
        const itemEl = e.target.closest('.ime-candidate-item');
        if (itemEl && itemEl.dataset.index !== undefined && !e.target.closest('.ime-detail-panel')) {
          const idx = parseInt(itemEl.dataset.index, 10);
          this.commitCandidate(idx);
          return;
        }
        const prevBtn = e.target.closest('.ime-page-prev');
        if (prevBtn) {
          this.prevPage();
          return;
        }
        const nextBtn = e.target.closest('.ime-page-next');
        if (nextBtn) {
          this.nextPage();
          return;
        }
      });
    }

    attach(inputEl, toggleContainerEl = null) {
      if (this.targetInput) {
        this.targetInput.removeEventListener('keydown', this.boundKeyHandler, true);
        this.targetInput.removeEventListener('blur', this.boundBlurHandler);
        window.removeEventListener('resize', this.boundPositionHandler);
        window.removeEventListener('scroll', this.boundPositionHandler, true);
      }

      this.targetInput = inputEl;
      if (!inputEl) return;

      inputEl.addEventListener('keydown', this.boundKeyHandler, true);
      inputEl.addEventListener('blur', this.boundBlurHandler);
      window.addEventListener('resize', this.boundPositionHandler);
      window.addEventListener('scroll', this.boundPositionHandler, true);

      // 建立輸入法切換按鈕
      if (toggleContainerEl) {
        this.createToggleBtn(toggleContainerEl);
      }
    }

    createToggleBtn(container) {
      if (this.toggleBtnEl && this.toggleBtnEl.parentNode) {
        this.toggleBtnEl.parentNode.removeChild(this.toggleBtnEl);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ime-mode-toggle-btn ${this.enabled ? 'is-active' : ''}`;
      btn.title = '切換 Web 版粵拼輸入法';
      btn.innerHTML = `
        <span class="ime-mode-badge">${this.enabled ? '粵' : 'EN'}</span>
        <span class="ime-mode-label">${this.enabled ? 'Web 版粵拼輸入法' : 'Web 版粵拼輸入法 (已關閉)'}</span>
      `;

      btn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // 防止按鈕奪取焦點導致輸入框失焦
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleEnabled();
      });

      container.appendChild(btn);
      this.toggleBtnEl = btn;
    }

    toggleEnabled(forceState) {
      this.enabled = typeof forceState === 'boolean' ? forceState : !this.enabled;
      localStorage.setItem('jyutping_web_ime_enabled', this.enabled ? 'true' : 'false');
      
      if (this.toggleBtnEl) {
        this.toggleBtnEl.classList.toggle('is-active', this.enabled);
        const badge = this.toggleBtnEl.querySelector('.ime-mode-badge');
        const label = this.toggleBtnEl.querySelector('.ime-mode-label');
        if (badge) badge.textContent = this.enabled ? '粵' : 'EN';
        if (label) label.textContent = this.enabled ? 'Web 版粵拼輸入法' : 'Web 版粵拼輸入法 (已關閉)';
      }

      if (!this.enabled) {
        this.clearBuffer();
      }
      if (this.targetInput) this.targetInput.focus();
    }

    handleKeyDown(e) {
      if (!this.enabled) return;

      // 組合鍵 (Ctrl/Cmd/Alt) 不攔截
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // 1. 如果緩衝區為空
      if (!this.buffer) {
        // 大寫字母鍵 (Shift + 字母 或 CapsLock 大寫字母)：直接放行輸入原生英文字母，不觸發輸入法 (如輸入 "A貨")
        if (e.shiftKey || /^[A-Z]$/.test(e.key)) {
          return;
        }

        // 小寫 a-z 字母鍵：啟動粵拼輸入法
        if (e.key.length === 1 && /^[a-z]$/.test(e.key) && !e.isComposing) {
          e.preventDefault();
          this.buffer = e.key;
          this.pageIndex = 0;
          this.selectedIndex = 0;
          this.updateCandidates();
          return;
        }
        return;
      }

      // 2. 如果輸入法正處於活躍狀態 (緩衝區有字母)
      if (this.buffer) {
        // 若此時輸入大寫字母 (Shift + 字母)：先將當前緩衝區字母上屏，然後輸入該大寫英文字母
        if (e.key.length === 1 && (e.shiftKey || /^[A-Z]$/.test(e.key))) {
          e.preventDefault();
          this.commitRawBuffer();
          this.insertTextAtCursor(e.key);
          return;
        }

        // 聲調鍵 (v/x/q)：動態映射為粵拼數字聲調 (v->1, vv->4; x->2, xx->5; q->3, qq->6)
        if (e.key === 'v' || e.key === 'x' || e.key === 'q') {
          e.preventDefault();
          if (e.key === 'v') {
            if (this.buffer.endsWith('1')) {
              this.buffer = this.buffer.slice(0, -1) + '4';
            } else if (/[1-6]$/.test(this.buffer)) {
              this.buffer = this.buffer.slice(0, -1) + '1';
            } else {
              this.buffer += '1';
            }
          } else if (e.key === 'x') {
            if (this.buffer.endsWith('2')) {
              this.buffer = this.buffer.slice(0, -1) + '5';
            } else if (/[1-6]$/.test(this.buffer)) {
              this.buffer = this.buffer.slice(0, -1) + '2';
            } else {
              this.buffer += '2';
            }
          } else if (e.key === 'q') {
            if (this.buffer.endsWith('3')) {
              this.buffer = this.buffer.slice(0, -1) + '6';
            } else if (/[1-6]$/.test(this.buffer)) {
              this.buffer = this.buffer.slice(0, -1) + '3';
            } else {
              this.buffer += '3';
            }
          }
          this.pageIndex = 0;
          this.selectedIndex = 0;
          this.updateCandidates();
          return;
        }

        // 其他小寫 a-z 字母鍵：追加拼音
        if (e.key.length === 1 && /^[a-z]$/.test(e.key)) {
          e.preventDefault();
          this.buffer += e.key;
          this.pageIndex = 0;
          this.selectedIndex = 0;
          this.updateCandidates();
          return;
        }

        // 數字鍵 1-6 (或 1-9)：選詞
        if (/^[1-9]$/.test(e.key)) {
          const num = parseInt(e.key, 10);
          const currentCandidates = this.getCurrentPageCandidates();
          if (num <= currentCandidates.length) {
            e.preventDefault();
            this.commitCandidate(num - 1);
            return;
          }
        }

        // 空格鍵 (Space)：確認當前選中候選詞 (或第 1 個)
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          const currentCandidates = this.getCurrentPageCandidates();
          if (currentCandidates.length > 0) {
            this.commitCandidate(this.selectedIndex);
          } else {
            this.commitRawBuffer();
          }
          return;
        }

        // 回車鍵 (Enter)：上屏原始英文編碼
        if (e.key === 'Enter') {
          e.preventDefault();
          this.commitRawBuffer();
          return;
        }

        // 退格鍵 (Backspace)：支援雙字母聲調退格降調 (4->1, 5->2, 6->3, 1/2/3->無調)
        if (e.key === 'Backspace') {
          e.preventDefault();
          if (this.buffer.endsWith('4')) {
            this.buffer = this.buffer.slice(0, -1) + '1';
          } else if (this.buffer.endsWith('5')) {
            this.buffer = this.buffer.slice(0, -1) + '2';
          } else if (this.buffer.endsWith('6')) {
            this.buffer = this.buffer.slice(0, -1) + '3';
          } else {
            this.buffer = this.buffer.slice(0, -1);
          }

          if (this.buffer) {
            this.pageIndex = 0;
            this.selectedIndex = 0;
            this.updateCandidates();
          } else {
            this.clearBuffer();
          }
          return;
        }

        // Escape 鍵：取消輸入
        if (e.key === 'Escape') {
          e.preventDefault();
          this.clearBuffer();
          return;
        }

        // 上下箭頭：切換選中項目
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const currentCandidates = this.getCurrentPageCandidates();
          if (this.selectedIndex < currentCandidates.length - 1) {
            this.selectedIndex++;
          } else {
            this.selectedIndex = 0;
          }
          this.renderPopover();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const currentCandidates = this.getCurrentPageCandidates();
          if (this.selectedIndex > 0) {
            this.selectedIndex--;
          } else {
            this.selectedIndex = Math.max(0, currentCandidates.length - 1);
          }
          this.renderPopover();
          return;
        }

        // 翻頁：PageDown / PageUp 或 = / - 或 > / <
        if (e.key === 'PageDown' || e.key === '=' || e.key === ']' || e.key === 'ArrowRight') {
          e.preventDefault();
          this.nextPage();
          return;
        }
        if (e.key === 'PageUp' || e.key === '-' || e.key === '[' || e.key === 'ArrowLeft') {
          e.preventDefault();
          this.prevPage();
          return;
        }
      }
    }

    handleBlur() {
      // 延遲關閉，以便點擊候選詞時可以觸發 mousedown
      setTimeout(() => {
        if (document.activeElement !== this.targetInput) {
          this.clearBuffer();
        }
      }, 150);
    }

    updateCandidates() {
      this.candidates = this.engine.search(this.buffer);
      this.pageIndex = 0;
      this.selectedIndex = 0;
      this.activeDetailItem = null; // 輸入新字母時預設不展開側邊欄
      this.renderPopover();
    }

    getCurrentPageCandidates() {
      const start = this.pageIndex * this.pageSize;
      return this.candidates.slice(start, start + this.pageSize);
    }

    getTotalPages() {
      return Math.max(1, Math.ceil(this.candidates.length / this.pageSize));
    }

    nextPage() {
      const total = this.getTotalPages();
      if (this.pageIndex < total - 1) {
        this.pageIndex++;
        this.selectedIndex = 0;
        this.renderPopover();
      }
    }

    prevPage() {
      if (this.pageIndex > 0) {
        this.pageIndex--;
        this.selectedIndex = 0;
        this.renderPopover();
      }
    }

    commitCandidate(pageItemIndex) {
      const currentCandidates = this.getCurrentPageCandidates();
      const item = currentCandidates[pageItemIndex];
      if (!item || !this.targetInput) return;

      this.insertTextAtCursor(item.word);
      if (this.onCommitCallback) {
        this.onCommitCallback(item.word, item);
      }
      this.clearBuffer();
    }

    commitRawBuffer() {
      if (!this.buffer || !this.targetInput) return;
      this.insertTextAtCursor(this.buffer);
      this.clearBuffer();
    }

    insertTextAtCursor(text) {
      const input = this.targetInput;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const val = input.value || '';
      input.value = val.substring(0, start) + text + val.substring(end);
      const newPos = start + text.length;
      input.setSelectionRange(newPos, newPos);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    clearBuffer() {
      this.buffer = '';
      this.candidates = [];
      this.pageIndex = 0;
      this.selectedIndex = 0;
      this.activeDetailItem = null;
      if (this.popoverEl) {
        this.popoverEl.style.display = 'none';
      }
    }

    getCaretCoordinates() {
      const input = this.targetInput;
      if (!input) return { left: 0, top: 0, bottom: 0 };
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const fontSize = parseFloat(style.fontSize) || 16;
      const fontFamily = style.fontFamily || 'inherit';
      const fontWeight = style.fontWeight || 'normal';
      const textAlign = style.textAlign || 'left';
      
      let textWidth = 0;
      let totalTextWidth = 0;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const textBeforeCaret = (input.value || '').substring(0, input.selectionStart || 0);
        textWidth = ctx.measureText(textBeforeCaret).width;
        totalTextWidth = ctx.measureText(input.value || '').width;
      } catch(e) {}

      let caretX = rect.left + paddingLeft;
      if (textAlign === 'center') {
        const availWidth = rect.width - paddingLeft - paddingRight;
        const textStartX = rect.left + paddingLeft + Math.max(0, (availWidth - totalTextWidth) / 2);
        caretX = textStartX + textWidth;
      } else if (textAlign === 'right') {
        caretX = rect.right - paddingRight - (totalTextWidth - textWidth);
      } else {
        caretX = rect.left + paddingLeft + textWidth;
      }

      return {
        left: caretX,
        bottom: rect.bottom,
        top: rect.top,
        height: rect.height
      };
    }

    updatePosition() {
      if (!this.popoverEl || this.popoverEl.style.display === 'none' || !this.targetInput) return;
      const caret = this.getCaretCoordinates();
      const popoverRect = this.popoverEl.getBoundingClientRect();
      
      // 穩定錨定在輸入框游標下方 (防止忽上忽下跳動)
      let top = caret.bottom + 8;
      let left = caret.left - 10; // 稍偏左對齊候選數字

      // 若下方超出可視視窗且上方空間充足時才翻轉到上方
      if (top + popoverRect.height > window.innerHeight - 10 && caret.top - popoverRect.height - 8 > 10) {
        top = caret.top - popoverRect.height - 8;
      }

      // 防止右邊界超出螢幕
      if (left + popoverRect.width > window.innerWidth - 12) {
        left = window.innerWidth - popoverRect.width - 12;
      }
      if (left < 12) left = 12;

      this.popoverEl.style.top = `${top + window.scrollY}px`;
      this.popoverEl.style.left = `${left + window.scrollX}px`;
    }

    getDisplayBuffer() {
      if (!this.buffer) return '';
      return this.engine.segmentJyutping(this.buffer);
    }

    renderPopover() {
      if (!this.popoverEl || !this.buffer) {
        if (this.popoverEl) this.popoverEl.style.display = 'none';
        return;
      }

      const totalPages = this.getTotalPages();
      const currentList = this.getCurrentPageCandidates();

      function formatCandidateHtml(item) {
        const chars = Array.from(item.word || '');
        const syllables = (item.jyutping || '').trim().split(/\s+/).filter(Boolean);

        if (chars.length > 0 && chars.length === syllables.length) {
          let units = '';
          for (let i = 0; i < chars.length; i++) {
            units += `
              <span class="ime-cand-unit">
                <span class="ime-cand-tone">${escapeHtml(syllables[i])}</span>
                <span class="ime-cand-char">${escapeHtml(chars[i])}</span>
              </span>
            `;
          }
          return `<div class="ime-cand-char-group">${units}</div>`;
        }

        return `
          <div class="ime-cand-char-group">
            <span class="ime-cand-unit">
              <span class="ime-cand-tone">${escapeHtml(item.jyutping)}</span>
              <span class="ime-cand-char">${escapeHtml(item.word)}</span>
            </span>
          </div>
        `;
      }

      let html = `
        <div class="ime-main-panel">
          <div class="ime-header">
            <span class="ime-buffer-code">${escapeHtml(this.getDisplayBuffer())}</span>
            <div class="ime-pager">
              <button class="ime-page-btn ime-page-prev" ${this.pageIndex === 0 ? 'disabled' : ''} title="上一頁 (PageUp / -)">‹</button>
              <span class="ime-page-indicator">${this.pageIndex + 1}/${totalPages}</span>
              <button class="ime-page-btn ime-page-next" ${this.pageIndex >= totalPages - 1 ? 'disabled' : ''} title="下一頁 (PageDown / =)">›</button>
            </div>
          </div>
          <div class="ime-candidates-list">
      `;

      if (currentList.length === 0) {
        html += `<div class="ime-no-match">無匹配候選詞 (按 Enter 直接輸入)</div>`;
      } else {
        currentList.forEach((item, idx) => {
          const isSelected = idx === this.selectedIndex;
          const isDetailActive = this.activeDetailItem === item;
          html += `
            <div class="ime-candidate-item ${isSelected ? 'is-active' : ''}" data-index="${idx}">
              <span class="ime-cand-num">${idx + 1}.</span>
              ${formatCandidateHtml(item)}
              ${item.def ? `<span class="ime-cand-def" title="${escapeHtml(item.def)}">${escapeHtml(item.def)}</span>` : ''}
              <span class="ime-cand-info ${isDetailActive ? 'is-open' : ''}" title="查看詳細釋義與例句">ⓘ</span>
            </div>
          `;
        });
      }

      html += `
          </div>
        </div>
      `;

      // 如果有打開的詳細信息側邊欄 (TypeDuck 風格)
      if (this.activeDetailItem) {
        const dItem = this.activeDetailItem;
        html += `
          <div class="ime-detail-panel">
            <div class="ime-detail-header">
              <div class="ime-detail-title-row">
                <span class="ime-detail-word">${escapeHtml(dItem.word)}</span>
                <span class="ime-detail-jyutping">${escapeHtml(dItem.jyutping)}</span>
              </div>
              <button class="ime-detail-close-btn" title="關閉">✕</button>
            </div>
            <div class="ime-detail-content">
              ${dItem.allDefs && dItem.allDefs.length > 0 ? `
                <div class="ime-detail-section-title">釋義 / Definitions</div>
                <div class="ime-detail-defs">
                  ${dItem.allDefs.slice(0, 4).map(d => `<div class="ime-detail-def-item">• ${escapeHtml(d)}</div>`).join('')}
                </div>
              ` : ''}
              ${dItem.examples && dItem.examples.length > 0 ? `
                <div class="ime-detail-section-title" style="margin-top: 8px;">例句 / Examples</div>
                <div class="ime-detail-examples">
                  ${dItem.examples.slice(0, 2).map(ex => `
                    <div class="ime-detail-ex-item">
                      <div class="ime-detail-ex-yue">${escapeHtml(ex.yue)}</div>
                      ${ex.eng ? `<div class="ime-detail-ex-eng">${escapeHtml(ex.eng)}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      this.popoverEl.innerHTML = html;
      this.popoverEl.style.display = 'flex';

      this.updatePosition();
    }
  }

  // 匯出到全域環境
  global.JyutpingImeEngine = JyutpingImeEngine;
  global.JyutpingWebIme = JyutpingWebIme;

})(typeof window !== 'undefined' ? window : this);
