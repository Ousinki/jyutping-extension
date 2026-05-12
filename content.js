/**
 * 粵語懸浮詞典 - Content Script
 * 實現滑鼠懸停中文字顯示粵語發音和解釋
 */

(function() {
  'use strict';

  // 唯一標識此 content script 實例（防止擴展重載後舊腳本重複播放音頻）
  const contentScriptId = Math.random().toString(36).slice(2);
  document.documentElement.setAttribute('data-jyutping-tts-owner', contentScriptId);

  let dictionary = {};
  let popup = null;
  let popupArrow = null; // 彈窗箭頭元素
  let isEnabled = true;
  let displayMode = 'jyutping'; // 'jyutping' 或 'yale'
  let popupDisplayStyle = 'full'; // 'full' 完整彈窗 或 'compact' 僅顯示音標
  let popupTheme = 'classic'; // 懸浮窗主題
  let ttsEnabled = true; // TTS 開關
  let ttsEngine = 'webSpeech'; // TTS 引擎: webSpeech, chromeTts, edgeTts, azureTts
  let edgeTtsMode = 'default'; // Edge TTS 模式: default (預設伺服器) / custom (自定義)
  let edgeTtsUrl = ''; // Edge TTS 伺服器地址
  const EDGE_TTS_DEFAULT_URL = 'http://114.55.243.162:8090';
  let azureTtsMode = 'default'; // Azure TTS 模式: default (代理) / custom (直連)
  let azureTtsKey = ''; // Azure Speech API Key
  let azureTtsRegion = ''; // Azure Speech 區域
  let azureTtsVoice = 'zh-HK-HiuMaanNeural'; // Azure Speech 音色
  let ttsRate = 0.9; // TTS 語速
  let customZhFont = ''; // 自定義中文字體
  let customEnFont = ''; // 自定義英文字體
  let currentRange = null; // 儲存當前選中的範圍
  let highlightSpans = []; // CSS 高亮的 span 元素
  let highlightStyle = 'yellow'; // 高亮樣式: yellow, blue, red, green, gray, underline-dashed, border-dashed
  let currentWord = null; // 追蹤當前顯示的詞
  let currentContextSentence = ''; // 當前高亮詞語所在的上下文句子
  let isMouseOverPopup = false; // 滑鼠是否在彈窗上
  let hideTimeout = null; // 延遲隱藏主彈窗計時器
  let justNavigated = false; // 是否剛進行鏈接導航

  // 翻譯
  let translatePopup = null; // 用於句子選區的獨立浮窗
  let selectionClickTimer = null; // 用於延遲 TTS（可被 dblclick 取消）
  let pendingTranslateWord = null; // 保存待翻譯的詞（給 dblclick 用）

  // AI 翻譯
  let aiEnabled = false;
  let aiLongPressTimer = null; // 長按計時器
  let aiAnimationTimer = null; // 長按動畫延遲計時器


  // ========== i18n 系統 ==========
  const popupI18n = {
    "zh-HK": {
      translating: "翻譯中...",
      mandarin: "普",
      english: "英",
      aiExplaining: "AI 釋義中...",
      noPronunciation: "找不到該詞的讀音",
      speak: "發音",
      copy: "複製",
      cantConnect: "無法連接字典伺服器"
    },
    "en": {
      translating: "Translating...",
      mandarin: "CN",
      english: "EN",
      aiExplaining: "AI explaining...",
      noPronunciation: "Pronunciation not found",
      speak: "Speak",
      copy: "Copy",
      cantConnect: "Cannot connect to server"
    }
  };
  let currentLang = 'zh-HK';
  chrome.storage.local.get(['extensionLang'], (res) => {
    if (res.extensionLang) currentLang = res.extensionLang;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.extensionLang) currentLang = changes.extensionLang.newValue;
  });
  const pt = (key) => (popupI18n[currentLang] || popupI18n['zh-HK'])[key] || key;

  // ========== 主题系统 ==========

  const POPUP_THEMES = {
    classic: {
      name: '經典',
      vars: {
        '--popup-bg': '#ffffff',
        '--popup-border': '#d0d0d0',
        '--popup-text': '#333333',
        '--popup-text-muted': '#666666',
        '--popup-text-label': '#888888',
        '--popup-accent': '#2196f3',
        '--popup-accent-hover': '#1976d2',
        '--popup-word-color': '#1a1a1a',
        '--popup-def-color': '#555555',
        '--popup-def-yue': '#b8860b',
        '--popup-divider': 'rgba(0, 0, 0, 0.08)',
        '--popup-divider-strong': '#eeeeee',
        '--popup-example-bg': '#f9f9f9',
        '--popup-btn-bg': '#f0f0f0',
        '--popup-btn-hover': '#e0e0e0',
        '--popup-btn-speaking': '#2196f3',
        '--popup-btn-speaking-text': '#ffffff',
        '--popup-shadow': '0 4px 12px rgba(0, 0, 0, 0.15)',
        '--popup-active-bg': '#f0f7ff',
      }
    },
    academic: {
      name: '香港紅',
      vars: {
        '--popup-bg': '#ffeaeb',
        '--popup-border': '#fba5a8',
        '--popup-text': '#8A1C1C',
        '--popup-text-muted': '#d46a6a',
        '--popup-text-label': '#e38a8a',
        '--popup-accent': '#D83131',
        '--popup-accent-hover': '#8A1C1C',
        '--popup-word-color': '#610c0c',
        '--popup-def-color': '#8A1C1C',
        '--popup-def-yue': '#D83131',
        '--popup-divider': 'rgba(138, 28, 28, 0.12)',
        '--popup-divider-strong': '#fccacc',
        '--popup-example-bg': '#fce1e3',
        '--popup-btn-bg': '#fce1e3',
        '--popup-btn-hover': '#fba5a8',
        '--popup-btn-speaking': '#D83131',
        '--popup-btn-speaking-text': '#ffffff',
        '--popup-shadow': '0 4px 12px rgba(138, 28, 28, 0.2)',
        '--popup-active-bg': '#fce1e3',
      }
    },
    night: {
      name: '深邃夜色',
      vars: {
        '--popup-bg': '#1a1a2e',
        '--popup-border': '#16213e',
        '--popup-text': '#e0e0e0',
        '--popup-text-muted': '#a0a0b0',
        '--popup-text-label': '#8888a0',
        '--popup-accent': '#7c8cf8',
        '--popup-accent-hover': '#9aa6ff',
        '--popup-word-color': '#f0f0ff',
        '--popup-def-color': '#c0c0d0',
        '--popup-def-yue': '#e8b84e',
        '--popup-divider': 'rgba(255, 255, 255, 0.08)',
        '--popup-divider-strong': '#2a2a40',
        '--popup-example-bg': '#141425',
        '--popup-btn-bg': '#2a2a40',
        '--popup-btn-hover': '#3a3a55',
        '--popup-btn-speaking': '#7c8cf8',
        '--popup-btn-speaking-text': '#1a1a2e',
        '--popup-shadow': '0 4px 16px rgba(0, 0, 0, 0.4)',
        '--popup-active-bg': '#222240',
      }
    },
    ink: {
      name: '墨韻',
      vars: {
        '--popup-bg': '#2d2d2d',
        '--popup-border': '#444444',
        '--popup-text': '#e0e0e0',
        '--popup-text-muted': '#aaaaaa',
        '--popup-text-label': '#999999',
        '--popup-accent': '#64b5f6',
        '--popup-accent-hover': '#90caf9',
        '--popup-word-color': '#f0f0f0',
        '--popup-def-color': '#cccccc',
        '--popup-def-yue': '#daa520',
        '--popup-divider': 'rgba(255, 255, 255, 0.08)',
        '--popup-divider-strong': '#3d3d3d',
        '--popup-example-bg': '#252525',
        '--popup-btn-bg': '#444444',
        '--popup-btn-hover': '#555555',
        '--popup-btn-speaking': '#64b5f6',
        '--popup-btn-speaking-text': '#1a1a1a',
        '--popup-shadow': '0 4px 16px rgba(0, 0, 0, 0.4)',
        '--popup-active-bg': '#383838',
      }
    },
    ocean: {
      name: '海洋藍',
      vars: {
        '--popup-bg': '#e3f2fd',
        '--popup-border': '#90caf9',
        '--popup-text': '#1565c0',
        '--popup-text-muted': '#42a5f5',
        '--popup-text-label': '#64b5f6',
        '--popup-accent': '#0d47a1',
        '--popup-accent-hover': '#1565c0',
        '--popup-word-color': '#0d47a1',
        '--popup-def-color': '#1976d2',
        '--popup-def-yue': '#e65100',
        '--popup-divider': 'rgba(13, 71, 161, 0.1)',
        '--popup-divider-strong': '#bbdefb',
        '--popup-example-bg': '#bbdefb',
        '--popup-btn-bg': '#bbdefb',
        '--popup-btn-hover': '#90caf9',
        '--popup-btn-speaking': '#1565c0',
        '--popup-btn-speaking-text': '#ffffff',
        '--popup-shadow': '0 4px 12px rgba(21, 101, 192, 0.2)',
        '--popup-active-bg': '#bbdefb',
      }
    },
    warm: {
      name: '暖陽',
      vars: {
        '--popup-bg': '#fff8e1',
        '--popup-border': '#ffe082',
        '--popup-text': '#5d4037',
        '--popup-text-muted': '#8d6e63',
        '--popup-text-label': '#a1887f',
        '--popup-accent': '#e65100',
        '--popup-accent-hover': '#f57c00',
        '--popup-word-color': '#3e2723',
        '--popup-def-color': '#6d4c41',
        '--popup-def-yue': '#c62828',
        '--popup-divider': 'rgba(93, 64, 55, 0.1)',
        '--popup-divider-strong': '#ffe0b2',
        '--popup-example-bg': '#fff3e0',
        '--popup-btn-bg': '#ffe0b2',
        '--popup-btn-hover': '#ffcc80',
        '--popup-btn-speaking': '#e65100',
        '--popup-btn-speaking-text': '#ffffff',
        '--popup-shadow': '0 4px 12px rgba(230, 81, 0, 0.15)',
        '--popup-active-bg': '#fff3e0',
      }
    },
    mint: {
      name: '薄荷綠',
      vars: {
        '--popup-bg': '#e8f5e9',
        '--popup-border': '#a5d6a7',
        '--popup-text': '#2e7d32',
        '--popup-text-muted': '#4caf50',
        '--popup-text-label': '#66bb6a',
        '--popup-accent': '#1b5e20',
        '--popup-accent-hover': '#2e7d32',
        '--popup-word-color': '#1b5e20',
        '--popup-def-color': '#388e3c',
        '--popup-def-yue': '#bf360c',
        '--popup-divider': 'rgba(46, 125, 50, 0.1)',
        '--popup-divider-strong': '#c8e6c9',
        '--popup-example-bg': '#c8e6c9',
        '--popup-btn-bg': '#c8e6c9',
        '--popup-btn-hover': '#a5d6a7',
        '--popup-btn-speaking': '#2e7d32',
        '--popup-btn-speaking-text': '#ffffff',
        '--popup-shadow': '0 4px 12px rgba(46, 125, 50, 0.2)',
        '--popup-active-bg': '#c8e6c9',
      }
    },
    glass: {
      name: '毛玻璃',
      vars: {
        '--popup-bg': 'rgba(255, 255, 255, 0.78)',
        '--popup-border': 'rgba(255, 255, 255, 0.3)',
        '--popup-text': '#333333',
        '--popup-text-muted': '#555555',
        '--popup-text-label': '#777777',
        '--popup-accent': '#2196f3',
        '--popup-accent-hover': '#1976d2',
        '--popup-word-color': '#1a1a1a',
        '--popup-def-color': '#444444',
        '--popup-def-yue': '#b8860b',
        '--popup-divider': 'rgba(0, 0, 0, 0.06)',
        '--popup-divider-strong': 'rgba(0, 0, 0, 0.08)',
        '--popup-example-bg': 'rgba(255, 255, 255, 0.5)',
        '--popup-btn-bg': 'rgba(0, 0, 0, 0.06)',
        '--popup-btn-hover': 'rgba(0, 0, 0, 0.1)',
        '--popup-btn-speaking': '#2196f3',
        '--popup-btn-speaking-text': '#ffffff',
        '--popup-shadow': '0 8px 32px rgba(0, 0, 0, 0.12)',
        '--popup-active-bg': 'rgba(33, 150, 243, 0.08)',
      }
    }
  };

  // 應用主題到彈窗
  function applyPopupTheme(themeName) {
    if (!popup) return;
    const theme = POPUP_THEMES[themeName] || POPUP_THEMES.classic;
    
    // 設定 CSS 變量
    for (const [prop, value] of Object.entries(theme.vars)) {
      popup.style.setProperty(prop, value);
      if (translatePopup) translatePopup.style.setProperty(prop, value);
    }
    
    // 處理毛玻璃特殊 class
    popup.classList.remove('popup-theme-glass');
    if (translatePopup) translatePopup.classList.remove('popup-theme-glass');
    if (themeName === 'glass') {
      popup.classList.add('popup-theme-glass');
      if (translatePopup) translatePopup.classList.add('popup-theme-glass');
    }

    // 應用自定義字體
    if (customZhFont) {
      popup.style.setProperty('--popup-font-zh', customZhFont);
      if (translatePopup) translatePopup.style.setProperty('--popup-font-zh', customZhFont);
    } else {
      popup.style.removeProperty('--popup-font-zh');
      if (translatePopup) translatePopup.style.removeProperty('--popup-font-zh');
    }
    
    if (customEnFont) {
      popup.style.setProperty('--popup-font-en', customEnFont);
      if (translatePopup) translatePopup.style.setProperty('--popup-font-en', customEnFont);
    } else {
      popup.style.removeProperty('--popup-font-en');
      if (translatePopup) translatePopup.style.removeProperty('--popup-font-en');
    }
  }
  
  // TTS 音頻緩存（避免重複 API 調用）
  const ttsCache = new Map(); // key: "engine:text" -> audioData
  const TTS_CACHE_MAX = 20;
  let pendingTtsText = ''; // 追蹤正在請求的文本

  // 初始化：創建彈窗元素
  function init() {
    createPopup();
    createTranslatePopup();
    loadDictionary();
    loadSettings();
    setupEventListeners();
  }

  let hasUserSelection = false;

  // 創建句子翻譯用的獨立浮窗（當沒有詞典彈窗時使用）
  function createTranslatePopup() {
    translatePopup = document.createElement('div');
    translatePopup.id = 'cantonese-translate-popup';
    translatePopup.style.display = 'none';
    document.body.appendChild(translatePopup);
    translatePopup.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  let longPressRing = null;
  function createLongPressRing() {
    if (longPressRing) return;
    longPressRing = document.createElement('div');
    longPressRing.id = 'jyutping-longpress-ring';
    longPressRing.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(139, 92, 246, 0.2)" stroke-width="3"></circle>
        <circle class="ring-progress" cx="14" cy="14" r="12" fill="none" stroke="#8b5cf6" stroke-width="3" 
          stroke-dasharray="75.4" stroke-dashoffset="75.4" stroke-linecap="round" 
          transform="rotate(-90 14 14)"></circle>
      </svg>
    `;
    document.body.appendChild(longPressRing);
  }

  function startLongPressAnimation(x, y) {
    if (!longPressRing) createLongPressRing();
    longPressRing.style.left = x + 'px';
    longPressRing.style.top = y + 'px';
    longPressRing.style.opacity = '1';
    
    // 強制重繪
    longPressRing.offsetHeight;
    
    const progressCircle = longPressRing.querySelector('.ring-progress');
    progressCircle.style.transition = 'stroke-dashoffset 0.5s linear';
    progressCircle.style.strokeDashoffset = '0';
  }

  function cancelLongPressAnimation() {
    if (aiAnimationTimer) {
      clearTimeout(aiAnimationTimer);
      aiAnimationTimer = null;
    }
    if (!longPressRing) return;
    longPressRing.style.opacity = '0';
    const progressCircle = longPressRing.querySelector('.ring-progress');
    progressCircle.style.transition = 'none';
    progressCircle.style.strokeDashoffset = '75.4';
  }

  // 定位翻譯和AI浮窗（包含箭頭）
  function positionTranslatePopup(rect) {
    if (!rect) return;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupWidth = translatePopup.offsetWidth || 200;
    const popupHeight = translatePopup.offsetHeight || 60;
    const ARROW_HEIGHT = 8;
    const GAP = 2;

    let left = rect.left;
    let top;
    let arrowDirection = 'up';

    // 水平位置限制
    if (left + 5 + popupWidth > viewportWidth) {
      left = viewportWidth - popupWidth - 10;
      if (left < 5) left = 5;
    } else {
      left = left + 5;
    }

    // 垂直位置限制 (相對於 viewport 計算，最後加 scrollX/Y)
    if (rect.bottom + GAP + ARROW_HEIGHT + popupHeight <= viewportHeight) {
      top = rect.bottom + GAP + ARROW_HEIGHT;
      arrowDirection = 'up';
    } else {
      top = rect.top - popupHeight - GAP - ARROW_HEIGHT;
      arrowDirection = 'down';
      if (top < 5) {
        top = 5;
        arrowDirection = 'up';
      }
    }

    translatePopup.style.position = 'absolute';
    translatePopup.style.left = Math.max(5, left + window.scrollX) + 'px';
    translatePopup.style.top = (top + window.scrollY) + 'px';

    const translatePopupArrow = translatePopup.querySelector('.popup-arrow');
    if (translatePopupArrow) {
      translatePopupArrow.className = 'popup-arrow popup-arrow-' + arrowDirection;
      const highlightCenterX = rect.left + rect.width / 2;
      let arrowCenter = highlightCenterX - left;
      arrowCenter = Math.max(16, Math.min(arrowCenter, popupWidth - 16));
      translatePopupArrow.style.left = arrowCenter + 'px';
    }
  }

  // 發送翻譯請求
  function requestTranslation(text) {
    // 只翻譯包含中文的文本
    const chineseRatio = (text.match(/[\u4e00-\u9fff]/g) || []).length / text.length;
    if (chineseRatio < 0.3) return;

    showTranslatePopup(text, null, null, true);
    chrome.runtime.sendMessage({
      action: 'translate',
      text: text
    });
  }

  // 顯示翻譯結果：優先在詞典彈窗內，否則用獨立浮窗
  function showTranslatePopup(originalText, mandarin, english, loading) {
    // 如果詞典彈窗正在顯示，將翻譯結果插入其中
    if (popup && popup.style.display !== 'none') {
      const translateDiv = popup.querySelector('.popup-translate');
      if (translateDiv) {
        if (loading) {
          translateDiv.innerHTML = `<div class="translate-loading">${pt('translating')}</div>`;
        } else {
          translateDiv.innerHTML = `
            <div class="translate-row"><span class="translate-label">${pt('mandarin')}</span><span class="translate-text">${mandarin || ''}</span></div>
            <div class="translate-row"><span class="translate-label">${pt('english')}</span><span class="translate-text">${english || ''}</span></div>
          `;
        }
        translateDiv.style.display = 'block';
        return;
      }
    }
    
    // 否則用獨立浮窗（句子選區翻譯）
    if (!translatePopup) return;
    
    // 構建帶有 popup-inner 和 popup-arrow 的結構
    let innerContent = '';
    if (loading) {
      innerContent = `
        <div class="translate-header">${pt('translating')}</div>
        <div class="translate-body" style="opacity:0.5;">${originalText}</div>
      `;
    } else {
      innerContent = `
        <div class="translate-row"><span class="translate-label">${pt('mandarin')}</span><span class="translate-text">${mandarin || ''}</span></div>
        <div class="translate-row"><span class="translate-label">${pt('english')}</span><span class="translate-text">${english || ''}</span></div>
      `;
    }

    translatePopup.innerHTML = `
      <div class="popup-arrow"></div>
      <div class="popup-inner">
        ${innerContent}
      </div>
    `;

    translatePopup.style.display = 'block';
    // 調用 applyPopupTheme 確保樣式同步
    if (typeof popupTheme !== 'undefined') applyPopupTheme(popupTheme);

    // 定位在選區下方
    let posRect = null;
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect.width > 0) posRect = rect;
    }
    if (!posRect && typeof currentRange !== 'undefined' && currentRange) {
      posRect = currentRange.getBoundingClientRect();
    }
    if (posRect) {
      positionTranslatePopup(posRect);
    }
  }

  // 隱藏翻譯結果浮窗
  function hideTranslatePopup() {
    if (translatePopup) {
      translatePopup.style.display = 'none';
    }
  }

  // 獲取選中文本所在的段落/句子作為上下文
  function getSurroundingSentence() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return '';
    
    let node = selection.anchorNode;
    if (!node) return '';
    
    // 向上找到塊級元素
    const blockTags = ['P', 'DIV', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'ARTICLE', 'SECTION'];
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && !blockTags.includes(el.tagName)) {
      el = el.parentElement;
    }
    
    if (!el) {
      // fallback: 用 anchorNode 的父元素
      el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    }
    
    const text = (el.textContent || '').trim();
    // 限制長度，避免發送過長的上下文
    return text.length > 500 ? text.substring(0, 500) + '...' : text;
  }

  // 請求 AI 翻譯
  function requestAiTranslation(word) {
    if (!word) return;
    
    const sentence = getSurroundingSentence();
    console.log('[AI] requestAiTranslation, word:', word, 'sentence:', sentence.substring(0, 80));
    
    // 顯示加載狀態
    showAiResult(word, '✨ AI 分析中...');
    
    chrome.runtime.sendMessage({
      action: 'aiTranslate',
      word: word,
      sentence: sentence
    });
  }

  // 顯示 AI 翻譯結果
  function showAiResult(word, explanation) {
    // 如果詞典彈窗正在顯示，插入其中
    if (popup && popup.style.display !== 'none') {
      const translateDiv = popup.querySelector('.popup-translate');
      if (translateDiv) {
        translateDiv.innerHTML = `
          <div class="ai-result">
            <div class="ai-label">✨ AI 語境</div>
            <div class="ai-text">${explanation}</div>
          </div>
        `;
        translateDiv.style.display = 'block';
        return;
      }
    }
    
    // 否則用獨立浮窗
    if (!translatePopup) return;
    translatePopup.innerHTML = `
      <div class="popup-arrow"></div>
      <div class="popup-inner">
        <div class="ai-result">
          <div class="ai-label">✨ AI 語境：${word}</div>
          <div class="ai-text">${explanation}</div>
        </div>
      </div>
    `;

    translatePopup.style.display = 'block';
    // 調用 applyPopupTheme 確保樣式同步
    if (typeof popupTheme !== 'undefined') applyPopupTheme(popupTheme);

    // 定位在選區下方
    let posRect = null;
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect.width > 0) posRect = rect;
    }
    if (!posRect && typeof currentRange !== 'undefined' && currentRange) {
      posRect = currentRange.getBoundingClientRect();
    }
    if (posRect) {
      positionTranslatePopup(posRect);
    }
  }



  // 創建彈窗 DOM 元素
  function createPopup() {
    // 清除舊的彈窗元素（擴展重載後舊 content script 留下的）
    const oldPopup = document.getElementById('cantonese-popup-dict');
    if (oldPopup) oldPopup.remove();
    const oldTranslate = document.getElementById('cantonese-translate-popup');
    if (oldTranslate) oldTranslate.remove();
    
    popup = document.createElement('div');
    popup.id = 'cantonese-popup-dict';
    popup.style.display = 'none';
    
    // 箭頭元素
    popupArrow = document.createElement('div');
    popupArrow.className = 'popup-arrow';
    
    // 內部結構：左側主要內容 + 右側例句 + 翻譯（全部包裹在 overflow hidden 容器中，以免內容溢出圓角）
    popup.innerHTML = `
      <div class="popup-inner" style="border-radius: inherit; overflow: hidden; width: 100%; height: 100%; display: flex; flex-direction: column; position: relative;">
        <!-- 右上角操作按鈕區（包含報告和設定） -->
        <div class="popup-actions-wrapper" style="position: absolute; top: 10px; right: 10px; display: flex; align-items: center; z-index: 10;">
          <!-- 報告錯誤按鈕 (預設隱藏，hover wrapper 時滑出) -->
          <div class="popup-report-btn" title="報告錯誤" style="cursor: pointer; opacity: 0; width: 0; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; height: 24px; border-radius: 4px; background-color: var(--popup-divider); margin-right: 0; color: var(--popup-text); font-size: 12px; white-space: nowrap; padding: 0;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
              <line x1="4" y1="22" x2="4" y2="15"></line>
            </svg>
            <span style="transform: translateY(-0.5px)">報告</span>
          </div>
          <!-- 設定按鈕 -->
          <div class="popup-settings-btn" title="設定" style="cursor: pointer; opacity: 0.4; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--popup-text, currentColor)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
        </div>
        <div class="popup-container">
          <div class="popup-main"></div>
          <div class="popup-examples" style="display:none;"></div>
        </div>
        <div class="popup-translate" style="display:none;"></div>
        
        <!-- 內聯報告表單 (預設隱藏) -->
        <div class="popup-report-form" style="display:none; padding: 12px; flex-direction: column; gap: 8px;">
          <div style="font-weight: bold; color: var(--popup-text); margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span>報告錯誤</span>
            <span class="report-cancel-icon" style="cursor: pointer; opacity: 0.6;">✕</span>
          </div>
          <div style="font-size: 13px; color: var(--popup-text-muted); background: var(--popup-bg); padding: 6px; border-radius: 4px; border: 1px solid var(--popup-divider);">
            <div><strong>詞語：</strong><span class="report-word-preview"></span></div>
            <div style="margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong>句子：</strong><span class="report-sentence-preview"></span></div>
          </div>
          <textarea class="report-textarea" placeholder="請描述具体的错误（例如读音不正确、释义有误等）..." style="width: 100%; height: 60px; padding: 6px; border: 1px solid var(--popup-border); border-radius: 4px; background: var(--popup-bg); color: var(--popup-text); font-size: 13px; resize: none; outline: none !important; box-shadow: none !important; -webkit-appearance: none; box-sizing: border-box;"></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button class="report-cancel-btn" style="padding: 4px 10px; border: 1px solid var(--popup-border); background: transparent; color: var(--popup-text); border-radius: 4px; cursor: pointer; font-size: 12px;">取消</button>
            <button class="report-send-btn" style="padding: 4px 10px; border: none; background: var(--popup-accent); color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">呼叫郵件發送</button>
          </div>
        </div>
      </div>
    `;
    popup.appendChild(popupArrow);
    
    document.body.appendChild(popup);

    // 操作按鈕區事件
    const actionsWrapper = popup.querySelector('.popup-actions-wrapper');
    const settingsBtn = popup.querySelector('.popup-settings-btn');
    const reportBtn = popup.querySelector('.popup-report-btn');
    const popupContainer = popup.querySelector('.popup-container');
    const popupTranslate = popup.querySelector('.popup-translate');
    const reportForm = popup.querySelector('.popup-report-form');

    // Hover 整個 wrapper 時：設定按鈕變亮，報告按鈕向左滑出
    actionsWrapper.addEventListener('mouseenter', () => {
      // 如果報告表單正在顯示，則不顯示按鈕
      if (reportForm.style.display === 'flex') return;
      
      settingsBtn.style.opacity = '1';
      settingsBtn.style.backgroundColor = 'var(--popup-divider)';
      
      reportBtn.style.opacity = '1';
      reportBtn.style.width = '60px'; // 展開寬度
      reportBtn.style.padding = '0 8px';
      reportBtn.style.marginRight = '4px';
    });
    
    actionsWrapper.addEventListener('mouseleave', () => {
      settingsBtn.style.opacity = '0.4';
      settingsBtn.style.backgroundColor = 'transparent';
      
      reportBtn.style.opacity = '0';
      reportBtn.style.width = '0';
      reportBtn.style.padding = '0';
      reportBtn.style.marginRight = '0';
      reportBtn.style.backgroundColor = 'var(--popup-divider)'; // reset hover
    });

    // Report 按鈕獨立 hover 效果
    reportBtn.addEventListener('mouseenter', () => {
      reportBtn.style.backgroundColor = 'var(--popup-divider-strong)';
    });
    reportBtn.addEventListener('mouseleave', () => {
      reportBtn.style.backgroundColor = 'var(--popup-divider)';
    });

    // 點擊報告錯誤：展開內聯表單
    reportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 隱藏主內容，顯示表單
      popupContainer.style.display = 'none';
      if (popupTranslate) popupTranslate.style.display = 'none';
      reportForm.style.display = 'flex';
      actionsWrapper.style.display = 'none'; // 隱藏右上角按鈕
      
      // 填充預覽數據
      popup.querySelector('.report-word-preview').textContent = currentWord || '未知';
      popup.querySelector('.report-sentence-preview').textContent = currentContextSentence || '未知';
      
      // 清空輸入框
      popup.querySelector('.report-textarea').value = '';
    });
    
    // 取消按鈕
    const closeReportForm = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      reportForm.style.display = 'none';
      popupContainer.style.display = 'block';
      actionsWrapper.style.display = 'flex';
    };
    popup.querySelector('.report-cancel-btn').addEventListener('click', closeReportForm);
    popup.querySelector('.report-cancel-icon').addEventListener('click', closeReportForm);
    
    // 發送按鈕
    popup.querySelector('.report-send-btn').addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const btn = e.currentTarget;
      const originalText = btn.textContent;
      const originalBg = btn.style.backgroundColor;
      
      // 按鈕變為發送中狀態
      btn.textContent = '發送中...';
      btn.style.opacity = '0.8';
      btn.style.pointerEvents = 'none';
      
      const userDesc = popup.querySelector('.report-textarea').value;
      const subject = `[Jyutping Extension] 錯誤報告: ${currentWord || '未知'}`;
      const message = `【單詞】：${currentWord || '未知'}\n【上下文】：${currentContextSentence || '未知'}\n\n【錯誤描述】：\n${userDesc || '未提供具體描述'}`;
      
      try {
        // 使用 Web3Forms API 靜默發送郵件 (需替換為你的 Access Key)
        // 获取 Key: https://web3forms.com/ (输入邮箱 ousinki@outlook.com 即可免费获取)
        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            access_key: "d19a0594-b64b-4593-b0e1-baf1cbeb6a4c",
            subject: subject,
            from_name: "Jyutping Extension",
            message: message
          })
        });

        const result = await response.json();
        
        if (response.status === 200) {
          // 發送成功
          btn.textContent = '✓ 報告已送出';
          btn.style.backgroundColor = '#4caf50'; // 綠色
        } else {
          // 服務器返回錯誤
          btn.textContent = '❌ 發送失敗';
          btn.style.backgroundColor = '#f44336'; // 紅色
          console.error('Email API Error:', result);
        }
      } catch (error) {
        // 網絡錯誤
        btn.textContent = '❌ 網絡錯誤';
        btn.style.backgroundColor = '#f44336'; // 紅色
        console.error('Network Error:', error);
      }
      
      // 1.5秒後關閉表單並恢復按鈕狀態
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = originalBg;
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        closeReportForm();
      }, 1500);
    });

    // 點擊設定
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'openOptionsPage' });
    });

    // 滑鼠進入彈窗時固定顯示
    popup.addEventListener('mouseenter', () => {
      isMouseOverPopup = true;
      justNavigated = false; // 進入後重置導航狀態，恢復正常延遲
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    });

    // 滑鼠離開彈窗時隱藏
    popup.addEventListener('mouseleave', () => {
      isMouseOverPopup = false;
      
      // 如果剛導航過（點擊鏈接），則不隱藏彈窗
      if (justNavigated) {
        return;
      }
      
      scheduleHidePopup();
    });

    // 點擊彈窗內部不關閉，且不影響背景選區
    popup.addEventListener('mousedown', (e) => {
      // 允許表單元素獲取焦點
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'input') {
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    });
  }

  // 載入詞典數據
  async function loadDictionary() {
    try {
      const manifest = chrome.runtime.getManifest();
      const url = chrome.runtime.getURL('dictionary.json') + '?v=' + manifest.version;
      const response = await fetch(url, { cache: 'no-cache' });
      dictionary = await response.json();
      console.log('粵語詞典已載入，詞條數：', Object.keys(dictionary).length);
    } catch (error) {
      console.error('載入詞典失敗：', error);
    }
  }

  // 載入用戶設定
  function loadSettings() {
    chrome.storage.sync.get([
      'enabled', 'displayMode', 'popupDisplayStyle', 'popupTheme', 'customZhFont', 'customEnFont', 'highlightStyle', 'ttsEnabled', 
      'ttsEngine', 'edgeTtsMode', 'edgeTtsUrl', 'azureTtsMode', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'ttsRate'
    ], (result) => {
      // enabled 可能在 sync 中設定（Options 頁面），先讀取
      if (result.enabled !== undefined) isEnabled = result.enabled !== false;
      displayMode = result.displayMode || 'jyutping';
      popupDisplayStyle = result.popupDisplayStyle || 'full';
      popupTheme = result.popupTheme || 'classic';
      customZhFont = result.customZhFont || '';
      customEnFont = result.customEnFont || '';
      highlightStyle = result.highlightStyle || 'yellow';
      applyPopupTheme(popupTheme);
      ttsEnabled = result.ttsEnabled !== false;
      ttsEngine = result.ttsEngine || 'chromeTts';
      edgeTtsMode = result.edgeTtsMode || 'default';
      edgeTtsUrl = result.edgeTtsUrl || '';
      azureTtsMode = result.azureTtsMode || 'default';
      azureTtsKey = result.azureTtsKey || '';
      azureTtsRegion = result.azureTtsRegion || '';
      azureTtsVoice = result.azureTtsVoice || 'zh-HK-HiuMaanNeural';
      ttsRate = result.ttsRate || 0.9;
    });
    // enabled 狀態同時從 local storage 讀取（工具欄按鈕寫入 local storage）
    chrome.storage.local.get(['enabled', 'aiEnabled'], (result) => {
      if (result.enabled !== undefined) isEnabled = result.enabled !== false;
      aiEnabled = result.aiEnabled === true;
      console.log('[AI] loadSettings, aiEnabled:', aiEnabled);
    });
  }

  // 粵語朗讀功能
  let lastSpeakTime = 0;
  let ttsPlaybackTimer = null; // 用於追蹤 TTS 播放狀態
  let activeSpeakerBtn = null; // 當前正在播放動畫的按鈕
  
  function startSpeakerAnimation(btn = null) {
    if (activeSpeakerBtn) {
      activeSpeakerBtn.classList.remove('speaking');
    }
    activeSpeakerBtn = btn || (popup ? popup.querySelector('.pronunciation-section .tts-speaker-btn') : null);
    if (activeSpeakerBtn) activeSpeakerBtn.classList.add('speaking');
    
    // 清除上一次的保底計時器
    if (ttsPlaybackTimer) clearTimeout(ttsPlaybackTimer);
  }
  
  function stopSpeakerAnimation() {
    if (activeSpeakerBtn) {
      activeSpeakerBtn.classList.remove('speaking');
      activeSpeakerBtn = null;
    }
    if (ttsPlaybackTimer) { clearTimeout(ttsPlaybackTimer); ttsPlaybackTimer = null; }
  }
  
  // 輔助函數：將 Data URI 轉換為 Blob URL 以繞過 CSP 限制
  function createBlobUrlFromDataUri(dataURI) {
    try {
      if (!dataURI.startsWith('data:')) return dataURI;
      const parts = dataURI.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Data URI to Blob URL failed:', e);
      return dataURI;
    }
  }

  async function speakCantonese(text, targetBtn = null) {
    if (!ttsEnabled) return;
    
    // 全局防抖：300ms 內不重複發音
    const now = Date.now();
    console.trace(`speakCantonese called for "${text}". Time diff: ${now - lastSpeakTime}ms`);
    if (now - lastSpeakTime < 300) {
      console.log('speakCantonese blocked by debounce');
      return;
    }
    lastSpeakTime = now;
    
    console.log('speakCantonese proceeding, engine:', ttsEngine);
    
    // ★ 統一啟動喇叭動畫
    startSpeakerAnimation(targetBtn);
    // 保底超時：最多 10 秒後停止動畫（防止狀態卡死）
    ttsPlaybackTimer = setTimeout(stopSpeakerAnimation, 10000);
    
    // 檢查緩存（僅對需要 API 調用的引擎）
    const cacheKey = `${ttsEngine}:${ttsRate}:${text}`;
    if (['edgeTts', 'azureTts', 'bertVits2'].includes(ttsEngine)) {
      const cachedAudio = ttsCache.get(cacheKey);
      if (cachedAudio) {
        console.log('TTS cache hit:', text);
        const audio = new Audio(cachedAudio);
        audio.onended = stopSpeakerAnimation;
        audio.onerror = stopSpeakerAnimation;
        audio.play();
        return;
      }
    }
    
    // 記錄待處理的文本（用於緩存回傳的音頻）
    pendingTtsText = cacheKey;
    
    try {
      if (ttsEngine === 'webSpeech') {
        speakWithWebSpeech(text);
      } else if (ttsEngine === 'chromeTts') {
        speakWithChromeTts(text);
      } else if (ttsEngine === 'edgeTts') {
        const baseUrl = edgeTtsMode === 'custom' ? edgeTtsUrl : EDGE_TTS_DEFAULT_URL;
        await speakWithEdgeTts(text, baseUrl);
      } else if (ttsEngine === 'bertVits2') {
        await speakWithBertVits2(text);
      } else if (ttsEngine === 'azureTts') {
        if (azureTtsMode === 'custom') {
          chrome.runtime.sendMessage({
            action: 'azureTtsSpeak',
            text: text,
            azureKey: azureTtsKey,
            azureRegion: azureTtsRegion,
            azureVoice: azureTtsVoice,
            rate: ttsRate
          });
        } else {
          chrome.runtime.sendMessage({
            action: 'azureTtsProxySpeak',
            text: text,
            azureVoice: azureTtsVoice,
            rate: ttsRate
          });
        }
      }
    } catch (error) {
      console.error('TTS error:', error);
      stopSpeakerAnimation();
      // 降級到 Web Speech
      speakWithWebSpeech(text);
    }
  }

  // Web Speech API
  function speakWithWebSpeech(text) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-HK';
    utterance.rate = ttsRate;
    utterance.onend = stopSpeakerAnimation;
    utterance.onerror = stopSpeakerAnimation;
    
    const voices = speechSynthesis.getVoices();
    const cantoneseVoice = voices.find(v => 
      v.lang === 'zh-HK' || v.lang.startsWith('zh-HK')
    );
    if (cantoneseVoice) utterance.voice = cantoneseVoice;
    
    speechSynthesis.speak(utterance);
  }

  // Chrome TTS API
  function speakWithChromeTts(text) {
    chrome.runtime.sendMessage({
      action: 'chromeTtsSpeak',
      text: text,
      options: { lang: 'zh-HK', rate: ttsRate }
    });
  }

  // Edge TTS (via background script to avoid CORS)
  async function speakWithEdgeTts(text, baseUrl) {
    baseUrl = baseUrl || EDGE_TTS_DEFAULT_URL;
    
    // Send request through background script (no CORS restrictions)
    chrome.runtime.sendMessage({
      action: 'edgeTtsSpeak',
      text: text,
      baseUrl: baseUrl,
      rate: ttsRate
    });
  }

  // Bert-VITS2 (via background script)
  async function speakWithBertVits2(text) {
    chrome.runtime.sendMessage({
      action: 'bertVits2Speak',
      text: text,
      rate: ttsRate
    });
  }

  // 設置事件監聽器
  function setupEventListeners() {
    let lastX = 0, lastY = 0;
    let isThrottled = false;
    let isSelecting = false; // 用戶正在拖拽選擇文字

    // 使用 mousemove 實現實時跟隨
    document.addEventListener('mousemove', (e) => {
      if (!isEnabled || isSelecting) return;

      // 如果用戶有手動選中的文本，不要觸發懸停查詞（防止覆蓋選區）
      if (hasUserSelection) return;

      // 如果滑鼠在彈窗上，不處理
      if (isMouseOverPopup) return;

      // 如果剛導航過（粘滯模式），不處理頁面文字掃描，直到用戶進入彈窗
      if (justNavigated) return;

      // ★ 最優先檢查：如果有可編輯元素正在獲得焦點，完全跳過
      if (hasEditableFocus()) {
        return;
      }

      // 如果滑鼠在可編輯元素上，也不觸發
      const targetElement = document.elementFromPoint(e.clientX, e.clientY);
      if (isEditableElement(targetElement)) {
        return;
      }

      // 節流：每 50ms 最多觸發一次
      if (isThrottled) return;
      
      // 如果滑鼠位置沒改變太多，跳過
      if (Math.abs(e.clientX - lastX) < 5 && Math.abs(e.clientY - lastY) < 5) {
        return;
      }
      
      lastX = e.clientX;
      lastY = e.clientY;
      
      isThrottled = true;
      setTimeout(() => { isThrottled = false; }, 50);
      
      handleMouseOver(e);
    });

    // 滑鼠離開文檔時隱藏
    document.addEventListener('mouseleave', () => {
      if (hasEditableFocus()) {
        if (popup) popup.style.display = 'none';
        return;
      }
      hidePopup();
    });

    // 點擊時的邏輯

    document.addEventListener('mousedown', (e) => {
      // 如果點擊在彈窗內部，不隱藏
      if (popup && popup.contains(e.target)) {
        return;
      }

      // 如果用戶有手動選中的文本，檢查點擊是否在選區內
      if (hasUserSelection) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && selection.toString().trim()) {
          const range = selection.getRangeAt(0);
          const rects = range.getClientRects();
          let clickInSelection = false;
          for (const rect of rects) {
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
              clickInSelection = true;
              break;
            }
          }
          if (clickInSelection) {
            e.preventDefault();
            // 用延遲區分單擊（TTS）和雙擊（翻譯）
            if (selectionClickTimer) {
              // 第二次點擊 → 取消 TTS，觸發翻譯
              clearTimeout(selectionClickTimer);
              selectionClickTimer = null;
              requestTranslation(selection.toString().trim());
            } else {
              // 第一次點擊 → 延遲觸發 TTS
              const textToSpeak = selection.toString().trim();
              selectionClickTimer = setTimeout(() => {
                selectionClickTimer = null;
                speakCantonese(textToSpeak);
              }, 250);
            }

            // 長按 500ms → 觸發 AI 翻譯（直接從 storage 讀取，避免變量未同步）
            chrome.storage.local.get(['aiEnabled'], (res) => {
              const isAiOn = res.aiEnabled === true;
              console.log('[AI] 檢查 AI 狀態:', isAiOn);
              if (!isAiOn) return;

              if (aiLongPressTimer) {
                clearTimeout(aiLongPressTimer);
                cancelLongPressAnimation();
              }
              const selectedWord = selection.toString().trim();
              console.log('[AI] 長按計時器啟動, word:', selectedWord);
              
              aiAnimationTimer = setTimeout(() => {
                startLongPressAnimation(e.clientX, e.clientY);
              }, 150);
              
              aiLongPressTimer = setTimeout(() => {
                aiLongPressTimer = null;
                cancelLongPressAnimation();
                console.log('[AI] 長按 500ms 觸發! word:', selectedWord);
                // 取消已排隊的 TTS 和 Bing 翻譯
                if (selectionClickTimer) {
                  clearTimeout(selectionClickTimer);
                  selectionClickTimer = null;
                }
                requestAiTranslation(selectedWord);
              }, 650);
            });
            return;
          }
        }
        // 點擊在選區外 → 清除選區
        hasUserSelection = false;
        hideTranslatePopup();
        cancelLongPressAnimation();
      }

      // 如果有高亮詞且點擊在高亮區域內 → 延遲 TTS（可被拖拽取消）
      if (currentWord && currentRange) {
        const rect = currentRange.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 &&
            e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          // 不立即 preventDefault — 先觀察用戶是否在拖拽選擇文本
          const startX = e.clientX;
          const startY = e.clientY;
          let isDragging = false;

          // 保存現有選區（點擊會清除它，之後如果是單擊就恢復）
          const sel = window.getSelection();
          let savedRange = null;
          if (sel.rangeCount > 0 && sel.toString().trim()) {
            savedRange = sel.getRangeAt(0).cloneRange();
          }

          // 保存當前詞，供 dblclick 使用
          pendingTranslateWord = currentWord;
          // 取消之前的計時器，防止重複 TTS
          if (selectionClickTimer) {
            clearTimeout(selectionClickTimer);
            selectionClickTimer = null;
          }

          const wordToSpeak = currentWord;

          // 延遲 TTS，如果用戶拖拽/雙擊則取消
          selectionClickTimer = setTimeout(() => {
            selectionClickTimer = null;
            if (!isDragging) {
              speakCantonese(wordToSpeak);
            }
          }, 300);

          // 長按 500ms → 觸發 AI 翻譯（同樣可被拖拽取消）
          chrome.storage.local.get(['aiEnabled'], (res) => {
            if (res.aiEnabled !== true) return;
            if (aiLongPressTimer) {
              clearTimeout(aiLongPressTimer);
              cancelLongPressAnimation();
            }
            aiAnimationTimer = setTimeout(() => {
              startLongPressAnimation(e.clientX, e.clientY);
            }, 150);
            aiLongPressTimer = setTimeout(() => {
              aiLongPressTimer = null;
              cancelLongPressAnimation();
              if (!isDragging) {
                if (selectionClickTimer) {
                  clearTimeout(selectionClickTimer);
                  selectionClickTimer = null;
                }
                requestAiTranslation(wordToSpeak);
              }
            }, 650);
          });

          // 監聽拖拽：如果移動超過 5px，切換到選擇模式
          const onDragMove = (moveEvt) => {
            const dx = moveEvt.clientX - startX;
            const dy = moveEvt.clientY - startY;
            if (dx * dx + dy * dy > 25) { // 5px 閾值
              isDragging = true;
              isSelecting = true;
              currentWord = null;
              hidePopup();
              // 取消 TTS 和 AI 計時器
              if (selectionClickTimer) {
                clearTimeout(selectionClickTimer);
                selectionClickTimer = null;
              }
              if (aiLongPressTimer) {
                clearTimeout(aiLongPressTimer);
                aiLongPressTimer = null;
                cancelLongPressAnimation();
              }
              pendingTranslateWord = null;
              document.removeEventListener('mousemove', onDragMove);
            }
          };
          document.addEventListener('mousemove', onDragMove);

          // mouseup 時清理拖拽監聽，並恢復選區（如果是單擊）
          const onDragEnd = () => {
            document.removeEventListener('mousemove', onDragMove);
            // 如果不是拖拽且之前有選區，恢復它
            if (!isDragging && savedRange) {
              const s = window.getSelection();
              s.removeAllRanges();
              s.addRange(savedRange);
            }
          };
          document.addEventListener('mouseup', onDragEnd, { once: true });

          return;
        }
      }

      // 既然在非高亮區域點擊，說明不是雙擊高亮詞，清除 pending 狀態
      pendingTranslateWord = null;

      isSelecting = true;
      currentWord = null;
      if (hasEditableFocus()) {
        if (popup) popup.style.display = 'none';
        return;
      }
      hidePopup();
      cancelLongPressAnimation();
    });

    // 雙擊 → 觸發翻譯（比 timer 更可靠）
    document.addEventListener('dblclick', (e) => {
      // 取消待執行的 TTS
      if (selectionClickTimer) {
        clearTimeout(selectionClickTimer);
        selectionClickTimer = null;
      }

      // 情況 1：雙擊高亮詞
      if (pendingTranslateWord) {
        e.preventDefault();
        requestTranslation(pendingTranslateWord);
        pendingTranslateWord = null;
        return;
      }

      // 情況 2：雙擊用戶選區
      if (hasUserSelection) {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text) {
          e.preventDefault();
          requestTranslation(text);
        }
      }
    });

    // 釋放滑鼠後檢查用戶是否手動選中了文本
    document.addEventListener('mouseup', (e) => {
      // 清除 AI 長按計時器
      if (aiLongPressTimer) {
        console.log('[AI] mouseup 清除長按計時器');
        clearTimeout(aiLongPressTimer);
        aiLongPressTimer = null;
        cancelLongPressAnimation();
      }

      // 只有用戶真正拖拽過（isSelecting 為 true）才檢測手動選中
      if (!isSelecting) return;

      setTimeout(() => {
        isSelecting = false;

        // 檢查用戶是否手動選中了文本（超過 1 個字符的選區）
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText.length > 1 && /[\u4e00-\u9fff]/.test(selectedText)) {
          hasUserSelection = true;
          hidePopup();
        } else {
          hasUserSelection = false;
        }
      }, 50);
    });

    // 滾動時隱藏彈窗
    document.addEventListener('scroll', () => {
      hidePopup();
      // 如果用戶仍有選中文字（藍底），保留保護狀態，防止吸附覆蓋選區
      const sel = window.getSelection();
      if (!sel || sel.toString().trim().length === 0) {
        hasUserSelection = false;
      }
      hideTranslatePopup();
      if (aiLongPressTimer) {
        clearTimeout(aiLongPressTimer);
        aiLongPressTimer = null;
      }
      cancelLongPressAnimation();
    }, true);

    // 按 ESC 關閉
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hidePopup();
        hideTranslatePopup();
        hasUserSelection = false;
      }
    });
  }

  // 檢查元素是否可編輯（輸入框、文本域、contenteditable）
  function isEditableElement(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    
    // 輸入框和文本域
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }
    
    // contenteditable 元素
    if (element.isContentEditable) {
      return true;
    }
    
    // 檢查父元素是否可編輯（對於嵌套元素）
    let parent = element.parentElement;
    while (parent) {
      if (parent.isContentEditable) {
        return true;
      }
      parent = parent.parentElement;
    }
    
    return false;
  }

  // 檢查是否有可編輯元素正在獲得焦點
  function hasEditableFocus() {
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    
    return (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable ||
      activeEl.getAttribute('contenteditable') === 'true' ||
      (activeEl.closest && activeEl.closest('[contenteditable="true"]'))
    );
  }

  // 獲取 Shadow DOM 中最深層的元素
  function getDeepestElementAtPoint(x, y) {
    let element = document.elementFromPoint(x, y);
    if (!element) return null;
    
    // 遞歸穿透 Shadow DOM
    while (element && element.shadowRoot) {
      const shadowElement = element.shadowRoot.elementFromPoint(x, y);
      if (!shadowElement || shadowElement === element) break;
      element = shadowElement;
    }
    
    return element;
  }

  // 從 Shadow DOM 中獲取文字範圍
  function getCaretRangeFromPointInShadow(x, y) {
    // 首先嘗試標準方法
    let range = document.caretRangeFromPoint(x, y);
    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      return range;
    }
    
    // 如果標準方法失敗，嘗試穿透 Shadow DOM
    const element = getDeepestElementAtPoint(x, y);
    if (!element) return null;
    
    // 獲取元素所在的根（可能是 ShadowRoot 或 document）
    const root = element.getRootNode();
    
    // 如果是 ShadowRoot，使用它的 caretRangeFromPoint（如果支持）
    if (root && root !== document && typeof root.caretRangeFromPoint === 'function') {
      range = root.caretRangeFromPoint(x, y);
      if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        return range;
      }
    }
    
    // 回退方案：遍歷元素的文字節點
    const textNodes = getTextNodesIn(element);
    for (const textNode of textNodes) {
      const nodeRange = document.createRange();
      for (let i = 0; i < textNode.textContent.length; i++) {
        try {
          nodeRange.setStart(textNode, i);
          nodeRange.setEnd(textNode, i + 1);
          const rect = nodeRange.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            nodeRange.setStart(textNode, i);
            nodeRange.setEnd(textNode, i);
            return nodeRange;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return null;
  }

  // 獲取元素內的所有文字節點
  function getTextNodesIn(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }
    return textNodes;
  }

  // 處理滑鼠懸停事件
  function handleMouseOver(e) {
    if (!isEnabled) return;
    if (isMouseOverPopup) return; // 滑鼠在彈窗上時不處理，保留高亮
    
    // 如果是用戶正在瀏覽的導航彈窗，且滑鼠不在彈窗上
    // 此時不應該讓移動滑鼠打斷導航，除非用戶再次進入
    // (這部分邏輯已在 setupEventListeners 中處理)

    const clientX = e.clientX;
    const clientY = e.clientY;

    // ★ 檢查是否懸停在已高亮的文字上
    const targetElement = document.elementFromPoint(clientX, clientY);
    if (targetElement && targetElement.classList.contains('jyutping-highlight')) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      return;
    }

    // ★ 測試滑鼠是否在文字上
    let range = getCaretRangeFromPointInShadow(clientX, clientY);
    if (!range) {
      // 滑鼠在空白處
      if (!justNavigated) {
        scheduleHidePopup();
      }
      return; // ★ 核心修復：在空白處移動時，保留舊的高亮，讓它跟隨彈窗生命週期
    }

    // 到這裡說明滑鼠在真正的文字上。移除舊高亮並清理 DOM。
    const previousWord = currentWord;
    if (highlightSpans.length > 0) {
      removeHighlight();
      // 由於 removeHighlight 調用了 normalize() 合併了文字節點，
      // 原來的 range.startContainer 可能已經失效，所以必須重新獲取一次
      range = getCaretRangeFromPointInShadow(clientX, clientY);
      if (!range) {
        if (!justNavigated) scheduleHidePopup();
        return;
      }
    }

    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
      if (!justNavigated) scheduleHidePopup();
      return;
    }

    // 使用精確定位找出最近的字符
    const offset = getAccurateOffset(textNode, clientX, clientY);
    if (offset === -1) {
      if (!justNavigated) scheduleHidePopup();
      return;
    }

    // 提取文字內容
    const text = textNode.textContent;
    currentContextSentence = text.trim();
    
    // 從當前位置往後取 15 個字符（標準查詞行為：只匹配光標後的詞）
    // 這樣符合大多數詞典插件（如 Zhongwen, Rikaikun）的習慣
    const searchText = text.substring(offset, offset + 15);
    const result = lookupWord(searchText);
    
    if (result) {
      // 如果是用戶正在瀏覽的導航彈窗，而現在滑鼠移到了其他文字上
      // 我們應該取消導航狀態，轉為顯示新詞
      justNavigated = false;

      // 無論是否同詞，都重新應用高亮（因為上面已經移除了）
      highlightText(textNode, offset, result.length);

      // 如果是同一個詞，且彈窗已顯示，不需要重建彈窗內容
      if (previousWord === result.word && popup.style.display !== 'none') {
        currentWord = result.word;
        // 如果有待執行的隱藏任務，取消它（因為用戶又回來了）
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        return;
      }
      
      // 新詞，更新顯示
      currentWord = result.word;
      
      // 使用文字本身的位置來定位彈窗（而非滑鼠位置）
      if (currentRange) {
        // 對於多行文字，找出滑鼠所在的那個矩形
        const rects = currentRange.getClientRects();
        let bestRect = null;
        
        // 優先找包含滑鼠的矩形
        for (const rect of rects) {
          if (clientX >= rect.left && clientX <= rect.right &&
              clientY >= rect.top && clientY <= rect.bottom) {
            bestRect = rect;
            break;
          }
        }
        
        // 如果沒找到（可能滑鼠在邊緣），找最近的
        if (!bestRect && rects.length > 0) {
          let minDistance = Infinity;
          for (const rect of rects) {
            const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
            const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
            const dist = dx * dx + dy * dy;
            if (dist < minDistance) {
              minDistance = dist;
              bestRect = rect;
            }
          }
        }
        
        showPopup(result, bestRect || currentRange.getBoundingClientRect());
      } else {
        // 如果沒有選區（這應該不可能發生，除非 selection 失敗），使用滑鼠位置
        showPopup(result, {
          left: clientX, right: clientX, 
          top: clientY, bottom: clientY,
          width: 0, height: 0
        });
      }
    } else {
      // 未匹配到詞
      currentWord = null;
      if (!justNavigated) {
        scheduleHidePopup();
      }
    }
  }

  // 精確定位：只有光標直接在中文字符上才返回
  function getAccurateOffset(textNode, clientX, clientY) {
    const text = textNode.textContent;
    if (!text) return -1;

    const range = document.createRange();

    // 遍歷每個字符，檢查光標是否直接在其上面
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // 只考慮中文字符
      if (!/[\u4e00-\u9fff]/.test(char)) continue;

      try {
        range.setStart(textNode, i);
        range.setEnd(textNode, i + 1);
        const rect = range.getBoundingClientRect();
        
        // 跳過不可見的字符
        if (rect.width === 0 || rect.height === 0) continue;

        // 只有光標直接在字符範圍內才返回
        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
          return i;
        }
      } catch (e) {
        // 忽略 range 操作錯誤
      }
    }

    // 光標不在任何中文字符上，不顯示
    return -1;
  }

  // 查詞函數：從長到短匹配（標準：從左向右）
  function lookupWord(text) {
    if (!text) return null;
    
    // 只處理中文字符
    if (!/[\u4e00-\u9fff]/.test(text)) {
      return null;
    }

    // 從最長開始匹配（最多 8 個字）
    for (let len = Math.min(text.length, 8); len > 0; len--) {
      const word = text.substring(0, len);
      
      if (dictionary[word]) {
        return {
          word: word,
          entry: dictionary[word],
          length: len
        };
      }
    }

    return null;
  }

  // 發音函數
  function speakText(text) {
    if (!ttsEnabled) return;
    
    if (ttsEngine === 'chromeTts') {
      chrome.runtime.sendMessage({
        action: 'chromeTtsSpeak',
        text: text,
        options: { lang: 'zh-HK', rate: ttsRate }
      });
    } else if (ttsEngine === 'edgeTts') {
      const baseUrl = edgeTtsMode === 'custom' ? edgeTtsUrl : EDGE_TTS_DEFAULT_URL;
      chrome.runtime.sendMessage({
        action: 'edgeTtsSpeak',
        text: text,
        baseUrl: baseUrl,
        rate: ttsRate
      });
    } else if (ttsEngine === 'bertVits2') {
      chrome.runtime.sendMessage({
        action: 'bertVits2Speak',
        text: text,
        rate: ttsRate
      });
    } else if (ttsEngine === 'azureTts') {
      if (azureTtsMode === 'custom') {
        chrome.runtime.sendMessage({
          action: 'azureTtsSpeak',
          text: text,
          azureKey: azureTtsKey,
          azureRegion: azureTtsRegion,
          azureVoice: azureTtsVoice,
          rate: ttsRate
        });
      } else {
        chrome.runtime.sendMessage({
          action: 'azureTtsProxySpeak',
          text: text,
          azureVoice: azureTtsVoice,
          rate: ttsRate
        });
      }
    } else {
      // Web Speech API 回退（直接在 content script 中執行）
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-HK';
      utterance.rate = ttsRate;
      speechSynthesis.speak(utterance);
    }
  }

  // ========== 精簡模式彈窗：僅顯示音標 ==========
  function showCompactPopup(result, entry, pronunciation, rect) {
    if (!pronunciation) {
      hidePopup();
      return;
    }

    const popupMain = popup.querySelector('.popup-main');
    const popupExamples = popup.querySelector('.popup-examples');
    const popupTranslate = popup.querySelector('.popup-translate');
    const actionsWrapper = popup.querySelector('.popup-actions-wrapper');
    const reportForm = popup.querySelector('.popup-report-form');

    // 重置/隱藏非必要元素
    popupExamples.style.display = 'none';
    popupExamples.innerHTML = '';
    if (popupTranslate) { popupTranslate.style.display = 'none'; popupTranslate.innerHTML = ''; }
    if (actionsWrapper) actionsWrapper.style.display = 'none';
    if (reportForm) reportForm.style.display = 'none';
    popup.classList.remove('expanded-mode');

    // 設定精簡模式的寬度為 auto
    popup.style.width = 'auto';
    popup.classList.add('compact-mode');

    // 構建精簡內容：僅拼音文字（點擊可發聲）
    popupMain.innerHTML = `
      <div class="compact-pronunciation">
        <span class="compact-text">${pronunciation}</span>
      </div>
    `;

    // 綁定 TTS（點擊拼音文字即可播放）
    const compactText = popupMain.querySelector('.compact-text');
    if (compactText) {
      compactText.style.cursor = 'pointer';
      compactText.addEventListener('click', (e) => {
        e.stopPropagation();
        speakCantonese(entry.traditional);
        
        // 觸發點擊動畫
        compactText.classList.remove('playing');
        void compactText.offsetWidth; // 強制瀏覽器重繪
        compactText.classList.add('playing');
      });
    }

    // 定位：固定顯示在文字上方
    if (rect) {
      popup.style.visibility = 'hidden';
      popup.style.display = 'block';
      
      const popupWidth = popup.offsetWidth || 120;
      const popupHeight = popup.offsetHeight || 36;
      const viewportWidth = window.innerWidth;
      const ARROW_HEIGHT = 8;
      const GAP = 2;

      // 水平：居中對齊高亮文字
      let left = rect.left + rect.width / 2 - popupWidth / 2;
      if (left + popupWidth > viewportWidth - 5) left = viewportWidth - popupWidth - 5;
      if (left < 5) left = 5;

      // 垂直：優先顯示在上方
      let top = rect.top - popupHeight - GAP - ARROW_HEIGHT;
      let arrowDirection = 'down'; // 箭頭朝下指向文字

      if (top < 5) {
        // 上方空間不足，放下方
        top = rect.bottom + GAP + ARROW_HEIGHT;
        arrowDirection = 'up';
      }

      popup.style.position = 'fixed';
      popup.style.left = left + 'px';
      popup.style.top = top + 'px';

      // 箭頭
      if (popupArrow) {
        popupArrow.className = 'popup-arrow popup-arrow-' + arrowDirection;
        const highlightCenterX = rect.left + rect.width / 2;
        let arrowCenter = highlightCenterX - left;
        arrowCenter = Math.max(16, Math.min(arrowCenter, popupWidth - 16));
        popupArrow.style.left = arrowCenter + 'px';
      }
      
      popup.style.visibility = 'visible';
    } else {
      popup.style.display = 'block';
      if (popupArrow) popupArrow.className = 'popup-arrow popup-arrow-hidden';
    }
    popup.style.pointerEvents = 'auto';
  }

  // 顯示彈窗
  // rect: { left, right, top, bottom, width, height }
  function showPopup(result, rect) {
    const entry = result.entry;
    
    // 選擇顯示的拼音格式
    const pronunciation = displayMode === 'yale' 
      ? (entry.yale || entry.jyutping)
      : entry.jyutping;

    // ========== 精簡模式：僅顯示音標 ==========
    if (popupDisplayStyle === 'compact') {
      showCompactPopup(result, entry, pronunciation, rect);
      return;
    }

    // 構建 HTML 內容
    let html = `
      <div class="word-section">
        <span class="word-text">${entry.traditional}</span>
        ${entry.simplified !== entry.traditional ? 
          `<span class="word-simplified">${entry.simplified}</span>` : ''}
      </div>
    `;

    if (pronunciation) {
      html += `
        <div class="pronunciation-section">
          <span class="pronunciation-label">${displayMode === 'yale' ? 'Yale' : '粵拼'}:</span>
          <span class="pronunciation-text">${pronunciation}</span>
          <button class="tts-speaker-btn" title="播放發音" aria-label="播放發音">
            <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </button>
        </div>
      `;
    }

    const popupMain = popup.querySelector('.popup-main');
    const popupExamples = popup.querySelector('.popup-examples');
    const popupTranslate = popup.querySelector('.popup-translate');
    
    // 重置樣式
    popupExamples.style.display = 'none';
    popupExamples.innerHTML = '';
    if (popupTranslate) { popupTranslate.style.display = 'none'; popupTranslate.innerHTML = ''; }
    popupMain.innerHTML = '';
    popup.classList.remove('expanded-mode');
    popup.classList.remove('compact-mode');
    popup.style.width = '320px'; // 默認寬度
    // 恢復完整模式下的操作按鈕
    const actionsWrapper = popup.querySelector('.popup-actions-wrapper');
    if (actionsWrapper) actionsWrapper.style.display = 'flex';
    const reportForm = popup.querySelector('.popup-report-form');
    if (reportForm) reportForm.style.display = 'none';

    // 清空之前的 html 内容，只保留 Header (词头+拼音)
    // 注意：目前的 html 變量包含了 Header。
    // 我们需要把 Header 放入 popupMain，然后追加 Definitions。
    // 但是 popupMain.innerHTML = html 会覆盖？
    // 让我们重构一下：html 变量只包含 Definition？
    // 不，Header 也是需要的。
    // 现在的 html 变量包含了 Header + (Double Definition Block 1)。
    // 我们删除了 Block 1。
    // 所以 html 依然包含 Header。
    // 然后追加 Block 2 的 Definition 到 html。
    // 最后 popupMain.innerHTML = html。
    // 这样 Header + Definition 都在 popupMain 里。
    // 正确。

    if (entry.english && entry.english.length > 0) {
      const defItems = entry.english.slice(0, 5).map((def, index) => {
        let className = 'def-item';
        let hasExamples = false;
        
        if (entry.examples && entry.examples[index] && entry.examples[index].length > 0) {
          className += ' has-examples';
          hasExamples = true;
        }

        if (def.startsWith('[粵]')) {
          className += ' def-yue';
        }
        
        return `<div class="${className}" ${hasExamples ? `data-example-index="${index}"` : ''}>${def}</div>`;
      }).join('');
      
      html += `
        <div class="definition-section">
          ${defItems}
        </div>
      `;
    }
    // 近義詞、反義詞、參觀 放在同一個區塊
    const refLines = [];

    if (entry.sims && entry.sims.length > 0) {
      const simLinks = entry.sims.map(w => 
        `<span class="see-also-link" data-word="${w}">${w}</span>`
      ).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">近義：</span>${simLinks}</div>`);
    }

    if (entry.ants && entry.ants.length > 0) {
      const antLinks = entry.ants.map(w => 
        `<span class="see-also-link" data-word="${w}">${w}</span>`
      ).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">反義：</span>${antLinks}</div>`);
    }

    if (entry.see_also && entry.see_also.length > 0) {
      const seeLinks = entry.see_also.map(w => 
        `<span class="see-also-link" data-word="${w}">${w}</span>`
      ).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">異體：</span>${seeLinks}</div>`);
    }

    if (refLines.length > 0) {
      html += `<div class="see-also-section">${refLines.join('')}</div>`;
    }

    popupMain.innerHTML = html;

    // 綁定點擊發音 (Word)
    const wordSection = popupMain.querySelector('.word-section');
    if (wordSection) {
      wordSection.style.cursor = 'pointer';
      wordSection.addEventListener('click', (e) => {
        e.stopPropagation();
        speakCantonese(entry.traditional);
      });
    }

    // 綁定發音點擊（拼音文字 + 喇叭按鈕均可觸發發聲）
    const pronunciationText = popupMain.querySelector('.pronunciation-text');
    const speakerBtn = popupMain.querySelector('.tts-speaker-btn');
    
    function triggerTTS(e) {
      e.stopPropagation();
      speakCantonese(entry.traditional, speakerBtn);
    }
    
    if (pronunciationText) {
      pronunciationText.style.cursor = 'pointer';
      pronunciationText.addEventListener('click', triggerTTS);
    }
    if (speakerBtn) {
      speakerBtn.addEventListener('click', triggerTTS);
    }

    // 綁定例句點擊事件
    if (entry.examples) {
      popupMain.querySelectorAll('.has-examples').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation(); // 防止觸發 document click
          
          // 如果已經是 active 狀態，點擊則收回
          if (el.classList.contains('active')) {
            el.classList.remove('active');
            popupExamples.style.display = 'none';
            popup.classList.remove('expanded-mode');
            popup.style.width = '320px';
            adjustPopupPosition();
            return;
          }
          
          // 移除其他 active 狀態
          popupMain.querySelectorAll('.def-item').forEach(d => d.classList.remove('active'));
          el.classList.add('active');

          const index = parseInt(el.dataset.exampleIndex);
          const examples = entry.examples[index];
          
          if (examples && examples.length > 0) {
            renderExamples(examples);
            popupExamples.style.display = 'block';
            popup.classList.add('expanded-mode');
            popup.style.width = '640px'; // 變寬
            
            // 重新調整位置，確保不超出屏幕邊緣
            adjustPopupPosition();
          }
        });
      });
    }

    // 綁定近義、反義、異體鏈接的點擊事件
    popup.querySelectorAll('.see-also-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const word = link.dataset.word;
        if (dictionary[word]) {
          // 防止重新渲染期間彈窗被隱藏
          isMouseOverPopup = true;
          justNavigated = true; // 標記為剛導航
          
          currentWord = word;
          // 傳入 null 表示保持當前位置
          showPopup({ word, entry: dictionary[word], length: word.length }, null);
          isMouseOverPopup = true; // 重新渲染後重設
        }
      });
    });

    // 如果傳入了座標，則重新計算位置
    if (rect) {
      // 先隱藏顯示以計算尺寸
      popup.style.visibility = 'hidden';
      popup.style.display = 'block';
      
      const popupWidth = popup.offsetWidth || (popup.classList.contains('expanded-mode') ? 640 : 320);
      const popupHeight = popup.offsetHeight || 150;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left, top;
      let arrowDirection = 'up'; // 箭頭方向：up = 彈窗在下方，箭頭朝上指向詞語
      
      const x = rect.left;
      const y = rect.bottom; // 默認參考點
      const ARROW_HEIGHT = 8; // 箭頭高度
      const GAP = 2; // 箭頭與文字的間距

      // 水平位置：默認居中對齊或者靠左
      if (x + 5 + popupWidth <= viewportWidth) {
        left = x + 5;
      } else {
        // 右側空間不足，往左放
        left = viewportWidth - popupWidth - 10;
        if (left < 5) left = 5;
      }

      // 垂直位置：優先顯示在文字下方
      if (rect.bottom + GAP + ARROW_HEIGHT + popupHeight <= viewportHeight) {
        top = rect.bottom + GAP + ARROW_HEIGHT;
        arrowDirection = 'up';
      } else {
        // 下方不足，放上方
        top = rect.top - popupHeight - GAP - ARROW_HEIGHT;
        arrowDirection = 'down';
        
        if (top < 5) {
            top = 5;
            arrowDirection = 'up';
        }
      }
      
      popup.style.position = 'fixed';
      popup.style.left = left + 'px';
      popup.style.top = top + 'px';
      
      // 設置箭頭位置和方向
      if (popupArrow) {
        popupArrow.className = 'popup-arrow popup-arrow-' + arrowDirection;
        // 計算箭頭水平位置：指向高亮文字的中心
        const highlightCenterX = rect.left + rect.width / 2;
        let arrowCenter = highlightCenterX - left;
        // 確保箭頭在彈窗範圍內
        arrowCenter = Math.max(16, Math.min(arrowCenter, popupWidth - 16));
        popupArrow.style.left = arrowCenter + 'px';
      }
      
      popup.style.visibility = 'visible';
    } else {
       popup.style.display = 'block';
       // 保持當前位置時隱藏箭頭
       if (popupArrow) popupArrow.className = 'popup-arrow popup-arrow-hidden';
    }
    popup.style.pointerEvents = 'auto'; // 允許交互

    // 朗讀（如果是新詞）
    // speakCantonese(result.word); 
  }

  // 渲染例句到右側面板
  function renderExamples(examples) {
    const popupExamples = popup.querySelector('.popup-examples');
    let html = '<div class="example-title">例句</div>';
    
    examples.forEach((eg, i) => {
      const engPart = eg.eng ? `<div class="example-eng">${eg.eng}</div>` : '';
      html += `
        <div class="example-item">
          <div class="example-yue">
            <span class="example-yue-text">${eg.yue}</span>
            <button class="tts-speaker-btn example-tts-btn" data-index="${i}" title="播放例句" aria-label="播放例句">
              <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            </button>
          </div>
          ${engPart}
        </div>
      `;
    });
    popupExamples.innerHTML = html;

    // 綁定例句喇叭點擊事件
    const exampleBtns = popupExamples.querySelectorAll('.example-tts-btn');
    exampleBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = btn.getAttribute('data-index');
        if (examples[index] && examples[index].yue) {
          // 移除任何標點符號再朗讀效果更好，但這裡直接傳原文
          speakCantonese(examples[index].yue, btn);
        }
      });
    });
  }

  // 調整彈窗位置（當變寬時）
  function adjustPopupPosition() {
    const rect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const targetWidth = 640; // 擴展後的目標寬度
    
    // 檢查擴展後的右邊界是否會超出屏幕
    // 注意：由於有 CSS transition，rect.right 和 rect.width 可能還是舊值
    // 所以我們使用 rect.left + targetWidth 來判斷
    if (rect.left + targetWidth > viewportWidth) {
      let newLeft = viewportWidth - targetWidth - 10;
      if (newLeft < 5) newLeft = 5;
      popup.style.left = newLeft + 'px';
    }
  }

  // 延遲隱藏（給用戶時間移動到彈窗上）
  function scheduleHidePopup(delay = 200) {
    if (hideTimeout) return;
    hideTimeout = setTimeout(() => {
      // 只有在滑鼠移出且不是粘滯的情況下隱藏
      // 現在主要依賴點擊隱藏，但離開彈窗也會隱藏
      if (!isMouseOverPopup) {
        hidePopup();
      }
      hideTimeout = null;
    }, delay); 
  }

  // 隱藏彈窗
  function hidePopup() {
    if (popup) {
      popup.style.display = 'none';
    }
    currentWord = null;
    // 如果用戶有手動選中的文本，不清除選區
    if (!hasUserSelection) {
      removeHighlight();
    }
  }

  // 選中文字（使用 CSS 高亮 span 代替原生 Selection）
  function highlightText(textNode, offset, length) {
    try {
      // 先移除舊的高亮
      removeHighlight();
      
      const end = Math.min(offset + length, textNode.textContent.length);
      
      // 創建 Range 用於定位彈窗
      const range = document.createRange();
      range.setStart(textNode, offset);
      range.setEnd(textNode, end);
      
      // 使用 span 包裹高亮文字（替代原生 Selection）
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'jyutping-highlight hl-' + (highlightStyle || 'yellow');
      range.surroundContents(highlightSpan);
      
      highlightSpans.push(highlightSpan);
      
      // 更新 currentRange 指向高亮 span 的範圍（用於彈窗定位）
      currentRange = document.createRange();
      currentRange.selectNodeContents(highlightSpan);
    } catch (e) {
      console.log('Highlight failed:', e);
      // 回退方案：如果 surroundContents 失敗（跨元素），嘗試簡單 range
      try {
        const range = document.createRange();
        range.setStart(textNode, offset);
        range.setEnd(textNode, Math.min(offset + length, textNode.textContent.length));
        currentRange = range;
      } catch (e2) {
        console.log('Fallback range also failed:', e2);
      }
    }
  }

  // 移除高亮
  function removeHighlight() {
    // 移除所有高亮 span，恢復原始文字節點
    highlightSpans.forEach(span => {
      if (span && span.parentNode) {
        const parent = span.parentNode;
        // 將 span 內容提取回父節點
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
        // 合併相鄰的文字節點
        parent.normalize();
      }
    });
    highlightSpans = [];
    currentRange = null;
  }

  // 監聽來自 popup 的消息（切換開關、設定等）
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleEnabled') {
      isEnabled = request.enabled;
      if (!isEnabled) hidePopup();
    } else if (request.action === 'changeDisplayMode') {
      displayMode = request.mode;
    } else if (request.action === 'changePopupDisplayStyle') {
      popupDisplayStyle = request.style;
    } else if (request.action === 'changeHighlightStyle') {
      highlightStyle = request.style;
    } else if (request.action === 'changePopupTheme') {
      popupTheme = request.theme;
      applyPopupTheme(popupTheme);
    } else if (request.action === 'changeCustomFont') {
      if (request.customZhFont !== undefined) customZhFont = request.customZhFont;
      if (request.customEnFont !== undefined) customEnFont = request.customEnFont;
      applyPopupTheme(popupTheme);
    } else if (request.action === 'changeTtsEnabled') {
      ttsEnabled = request.ttsEnabled;
    } else if (request.action === 'changeTtsEngine') {
      ttsEngine = request.ttsEngine;
    } else if (request.action === 'changeEdgeTtsUrl') {
      edgeTtsUrl = request.edgeTtsUrl;
    } else if (request.action === 'changeEdgeTtsMode') {
      edgeTtsMode = request.edgeTtsMode;
    } else if (request.action === 'changeAzureTtsKey') {
      azureTtsKey = request.azureTtsKey;
    } else if (request.action === 'changeAzureTtsRegion') {
      azureTtsRegion = request.azureTtsRegion;
    } else if (request.action === 'changeAzureTtsMode') {
      azureTtsMode = request.azureTtsMode;
    } else if (request.action === 'changeAzureTtsVoice') {
      azureTtsVoice = request.azureTtsVoice;
    } else if (request.action === 'changeTtsRate') {
      ttsRate = request.ttsRate;
    } else if (request.action === 'playAudio') {
      // 防止舊 content script 重複播放（擴展重載後舊腳本仍在監聽）
      const myId = document.documentElement.getAttribute('data-jyutping-tts-owner');
      if (myId !== contentScriptId) return;
      
      const audioSrc = request.audioData.startsWith('data:') ? createBlobUrlFromDataUri(request.audioData) : request.audioData;

      // 緩存音頻數據
      if (pendingTtsText) {
        if (ttsCache.size >= TTS_CACHE_MAX) {
          // 刪除最舊的緩存條目
          const firstKey = ttsCache.keys().next().value;
          const oldAudioSrc = ttsCache.get(firstKey);
          if (oldAudioSrc && oldAudioSrc.startsWith('blob:')) {
            URL.revokeObjectURL(oldAudioSrc);
          }
          ttsCache.delete(firstKey);
        }
        ttsCache.set(pendingTtsText, audioSrc);
        pendingTtsText = '';
      }
      // 播放音頻
      const audio = new Audio(audioSrc);
      audio.onended = stopSpeakerAnimation;
      audio.onerror = stopSpeakerAnimation;
      audio.play();
    } else if (request.action === 'translateResult') {
      if (request.success) {
        showTranslatePopup(null, request.mandarin, request.english, false);
      } else {
        showTranslatePopup(null, '❌ ' + request.error, '', false);
      }
    } else if (request.action === 'aiTranslateResult') {
      if (request.success) {
        showAiResult(request.word, request.explanation);
      } else {
        showAiResult(request.word, '❌ ' + request.error);
      }
    } else if (request.action === 'changeAiEnabled') {
      aiEnabled = request.aiEnabled;
    }
  });

  // 啟動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
