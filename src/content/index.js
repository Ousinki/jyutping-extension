/**
 * 粵語懸浮詞典 - Content Script
 * 實現滑鼠懸停中文字顯示粵語發音和解釋
 */

import { renderMarkdown } from './markdown.js';
import { getElementBackgroundColor, isElementOnDarkBackground } from './colors.js';
import { convertToSuperscriptTone } from './text-utils.js';
import { isEditableElement, hasEditableFocus, getCaretRangeFromPointInShadow, getAccurateOffset } from './dom.js';
import { createBlobUrlFromDataUri } from './tts.js';
import { sanitizeTranslatedHtml } from './paragraph-translate.js';
import { addWord, isWordSaved, removeWordByCharacter } from './wordbook-storage.js';

(function() {
  'use strict';

  // 唯一標識此 content script 實例（防止擴展重載後舊腳本重複播放音頻）
  const contentScriptId = Math.random().toString(36).slice(2);
  document.documentElement.setAttribute('data-jyutping-tts-owner', contentScriptId);

  let dictionary = {};
  let popup = null;
  let lastPopupShowTime = 0; // 記錄上次顯示彈窗的時間，用於過濾幽靈 mouseleave 事件
  let popupArrow = null; // 彈窗箭頭元素
  let isEnabled = true;
  let displayMode = 'jyutping';
  let toneStyle = 'superscript'; // 'superscript' 數字為上標 或 'inline' 數字跟在後方
  let popupDisplayStyle = 'full'; // 'full' 完整彈窗 或 'compact' 僅顯示音標
  let popupTheme = 'classic'; // 懸浮窗主題
  let ttsEnabled = true; // TTS 開關
  let ttsEngine = 'edgeTts'; // TTS 引擎: webSpeech, chromeTts, edgeTts, azureTts
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
  let highlightedRubyElement = null; // 全文注音模式下高亮的 ruby 元素
  let activePopupRubyElement = null; // 當前懸浮窗所對應的 ruby 元素
  let highlightStyle = 'yellow'; // 高亮樣式: yellow, blue, red, green, gray, underline-dashed, border-dashed
  let rubyHoverStyle = 'ruby-red'; // Ruby 懸停樣式: ruby-red, ruby-blue, ruby-green, ruby-orange, ruby-purple, ruby-underline, ruby-border
  let rubyRtBackground = 'none'; // Hover Ruby 音標背景模式：'none' | 'fade' | 'solid'
  let currentWord = null; // 追蹤當前顯示的詞
  let currentContextSentence = ''; // 當前高亮詞語所在的上下文句子
  let hoverModifier = 'none'; // 懸停觸發按鍵
  let isMouseOverPopup = false; // 滑鼠是否在彈窗上
  let hideTimeout = null; // 延遲隱藏主彈窗計時器
  let justNavigated = false; // 是否剛進行鏈接導航
  let compactExpandBtn = true; // 精簡模式展開按鈕
  const EXPAND_GRACE_MS = 400; // 展開後的隱藏/重繪寬限時長
  let expandGraceUntil = 0; // 展開寬限截止時間戳（performance.now()），期間不自動隱藏或重繪
  let rubyFadeMask = null; // 消散模式：主 DOM 中的隱形遮罩層

  let lastPopupResult = null;
  let lastPopupRect = null;
  let lastTranslateRect = null;
  let currentMouseX = 0; // 用於記錄絕對鼠標 X 位置
  let currentMouseY = 0; // 用於記錄絕對鼠標 Y 位置

  // 段落整段翻譯（按鍵觸發，譯文內聯顯示在原文下方）
  let paragraphTransKey = 'shift'; // 觸發鍵：'off' | 'shift' | 'alt' | 'ctrl' | 'meta'（可在選項頁設定）
  let paragraphTransMode = 'below'; // 顯示方式：'below' | 'replace'
  let paragraphTransEngine = 'bing'; // 引擎：'bing' | 'ai'
  let paragraphTransDirection = 'yue_to_target'; // 翻譯方向：'yue_to_target' | 'target_to_yue'
  let paraTransSeq = 0; // 翻譯請求自增 id
  const pendingParaTrans = new Map(); // id -> { block, translationEl }

  // Q&A 隨身問答狀態
  let activeQAContext = {
    word: '',
    sentence: '',
    originalTranslation: '',
    history: []
  };

  function clearQAContext() {
    activeQAContext = {
      word: '',
      sentence: '',
      originalTranslation: '',
      history: []
    };
  }

  // 翻譯
  let transLangs = ['zh-Hans', 'en'];
  let transTrigger = 'dblclick';
  let transHoverEngine = 'bing';
  let translatePopup = null; // 用於句子選區的獨立浮窗
  let pendingTranslateWord = null; // 保存待翻譯的詞（給 dblclick 或 單擊 翻譯用）

  // AI 翻譯
  let aiEnabled = false;
  let aiLongPressTimer = null; // 長按計時器
  let aiAnimationTimer = null; // 長按動畫延遲計時器
  let ignoreNextRubyClick = false; // 忽略下一次點擊事件

  // ========== i18n 系統 ==========
  const popupI18n = {
    "zh-HK": {
      translating: "翻譯中...",
      mandarin: "普",
      english: "英",
      japanese: "日",
      korean: "韓",
      aiExplaining: "AI 釋義中...",
      noPronunciation: "找不到該詞的讀音",
      speak: "發音",
      copy: "複製",
      cantConnect: "無法連接字典伺服器",
      wordbookSaved: "已加入生詞本",
      wordbookExists: "此詞已在生詞本中",
      wordbookRemoved: "已從生詞本移除",
      wordbookSaveFailed: "收藏失敗，請重試"
    },
    "zh-CN": {
      translating: "翻译中...",
      mandarin: "普",
      english: "英",
      japanese: "日",
      korean: "韩",
      aiExplaining: "AI 释义中...",
      noPronunciation: "找不到该词的读音",
      speak: "发音",
      copy: "复制",
      cantConnect: "无法连接字典服务器",
      wordbookSaved: "已加入生词本",
      wordbookExists: "此词已在生词本中",
      wordbookRemoved: "已从生词本移除",
      wordbookSaveFailed: "收藏失败，请重试"
    },
    "en": {
      translating: "Translating...",
      mandarin: "CN",
      english: "EN",
      japanese: "JA",
      korean: "KO",
      aiExplaining: "AI explaining...",
      noPronunciation: "Pronunciation not found",
      speak: "Speak",
      copy: "Copy",
      cantConnect: "Cannot connect to server",
      wordbookSaved: "Saved to Word Book",
      wordbookExists: "Already in Word Book",
      wordbookRemoved: "Removed from Word Book",
      wordbookSaveFailed: "Save failed, please retry"
    },
    "ja": {
      translating: "翻訳中...",
      mandarin: "普",
      english: "英",
      japanese: "日",
      korean: "韓",
      aiExplaining: "AI 解説中...",
      noPronunciation: "発音が見つかりません",
      speak: "発音",
      copy: "コピー",
      cantConnect: "サーバーに接続できません",
      wordbookSaved: "単語帳に保存しました",
      wordbookExists: "単語帳に登録済み",
      wordbookRemoved: "単語帳から削除しました",
      wordbookSaveFailed: "保存に失敗しました"
    },
    "ko": {
      translating: "번역 중...",
      mandarin: "普",
      english: "英",
      japanese: "日",
      korean: "韓",
      aiExplaining: "AI 설명 중...",
      noPronunciation: "발음을 찾을 수 없습니다",
      speak: "발음",
      copy: "복사",
      cantConnect: "서버에 연결할 수 없습니다",
      wordbookSaved: "단어장에 저장됨",
      wordbookExists: "이미 단어장에 있음",
      wordbookRemoved: "단어장에서 삭제됨",
      wordbookSaveFailed: "저장 실패, 다시 시도해주세요"
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

  // ========== Toast 多語言翻譯 ==========
  const toastI18n = {
    'zh-HK': {
      toastRubyEnabled: '全文粵語注音已開啟。<br>如遇排版重疊，請刷新網頁 (F5) 以適應高度。',
      toastRubyDisabled: '全文粵語注音已關閉。<br>如遇排版異常，請刷新網頁 (F5)。'
    },
    'zh-CN': {
      toastRubyEnabled: '全文粤语注音已开启。<br>如遇排版重叠，请刷新网页 (F5) 以适应高度。',
      toastRubyDisabled: '全文粤语注音已关闭。<br>如遇排版异常，请刷新网页 (F5)。'
    },
    'en': {
      toastRubyEnabled: 'Full-page Cantonese Ruby enabled.<br>If layouts overlap, refresh page (F5) to adjust height.',
      toastRubyDisabled: 'Full-page Cantonese Ruby disabled.<br>If layouts are abnormal, refresh page (F5).'
    },
    'ja': {
      toastRubyEnabled: '全ページ広東語ルビが有効になりました。<br>レイアウトが崩れる場合は、ページを更新 (F5) してください。',
      toastRubyDisabled: '全ページ広東語ルビが無効になりました。<br>表示がおかしい場合は、ページを更新 (F5) してください。'
    },
    'ko': {
      toastRubyEnabled: '전체 페이지 광둥어 발음기호가 활성화되었습니다.<br>레이아웃이 겹치면 페이지를 새로고침(F5) 해주세요.',
      toastRubyDisabled: '전체 페이지 광둥어 발음기호가 비활성화되었습니다.<br>표시가 비정상적이면 페이지를 새로고침(F5) 해주세요.'
    }
  };
  const tt = (key) => (toastI18n[currentLang] || toastI18n['zh-HK'])[key] || key;

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
    
    dark: {
      name: '深色',
      vars: {
        '--popup-bg': '#1e1e1e',
        '--popup-border': '#333333',
        '--popup-text': '#e0e0e0',
        '--popup-text-muted': '#aaaaaa',
        '--popup-text-label': '#888888',
        '--popup-accent': '#ef4444',
        '--popup-accent-hover': '#f87171',
        '--popup-word-color': '#f5f5f5',
        '--popup-def-color': '#cccccc',
        '--popup-def-yue': '#d4af37',
        '--popup-divider': 'rgba(255, 255, 255, 0.1)',
        '--popup-divider-strong': '#444444',
        '--popup-example-bg': '#2a2a2a',
        '--popup-btn-bg': '#333333',
        '--popup-btn-hover': '#444444',
        '--popup-btn-speaking': '#ef4444',
        '--popup-btn-speaking-text': '#ffffff',
        '--popup-shadow': '0px 4px 16px rgba(0, 0, 0, 0.5)',
        '--popup-active-bg': '#3f1a1a',
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
        '--popup-bg': 'rgba(255, 255, 255, 0.95)',
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

  // ==================== Shadow DOM 樣式隔離 ====================
  let shadowRoot = null; // 彈窗的影子根，實現 CSS 完全隔離

  async function createShadowHost() {
    // 清除舊的 Shadow Host（擴展重載後殘留的）
    const oldHost = document.getElementById('jyutping-shadow-host');
    if (oldHost) oldHost.remove();
    // 同時清除舊的宿主頁面樣式標籤
    const oldHostStyles = document.getElementById('jyutping-host-styles');
    if (oldHostStyles) oldHostStyles.remove();

    const host = document.createElement('div');
    host.id = 'jyutping-shadow-host';
    host.style.cssText = 'position: absolute; top: 0; left: 0; width: 0; height: 0; overflow: visible; z-index: 2147483647; pointer-events: none;';

    shadowRoot = host.attachShadow({ mode: 'closed' });

    // 動態加載 popup.css 到 Shadow Root 內部
    try {
      const cssUrl = chrome.runtime.getURL('popup.css');
      const resp = await fetch(cssUrl);
      const cssText = await resp.text();
      const style = document.createElement('style');
      style.textContent = cssText;
      shadowRoot.appendChild(style);
    } catch (e) {
      console.error('[Jyutping] Failed to load popup.css into Shadow DOM:', e);
    }

    // 在主頁面注入宿主層樣式（高亮、長按進度環、Toast、Ruby 注音、翻譯高亮）
    // 這些樣式作用在宿主頁面 DOM 元素上，無法放入 Shadow DOM
    const hostStyle = document.createElement('style');
    hostStyle.id = 'jyutping-host-styles';
    hostStyle.textContent = `
      @font-face {
        font-family: "HanaMinB";
        src: url("${chrome.runtime.getURL('fonts/HanaMinB.ttf')}");
        font-display: swap;
      }

      /* ========== 文字高亮樣式 ========== */
      ::highlight(jyutping-highlight),
      .jyutping-highlight {
        background-color: rgba(255, 220, 80, 0.45) !important;
        font-size: inherit !important;
      }
      .jyutping-highlight.hl-yellow { background-color: rgba(255, 220, 80, 0.45) !important; }
      .jyutping-highlight.hl-blue { background-color: rgba(96, 165, 250, 0.35) !important; }
      .jyutping-highlight.hl-red { background-color: rgba(248, 113, 113, 0.35) !important; }
      .jyutping-highlight.hl-green { background-color: rgba(74, 222, 128, 0.35) !important; }
      .jyutping-highlight.hl-gray { background-color: rgba(156, 163, 175, 0.3) !important; }
      .jyutping-highlight.hl-underline-dashed {
        background-color: transparent !important;
        text-decoration: underline dashed !important;
        text-decoration-color: #888 !important;
        text-underline-offset: 3px !important;
        text-decoration-thickness: 1.5px !important;
      }
      .jyutping-highlight.hl-border-dashed {
        background-color: transparent !important;
        outline: 1.5px dashed #888 !important;
        outline-offset: 2px !important;
        border-radius: 3px !important;
      }

      /* ========== AI 長按進度環 ========== */
      #jyutping-longpress-ring {
        position: fixed !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        width: 28px !important; height: 28px !important;
        transform: translate(-50%, -50%) scale(1) !important;
        opacity: 0 !important;
        transition: opacity 0.1s ease, transform 0s !important;
        display: block !important;
      }
      #jyutping-longpress-ring.active {
        opacity: 1 !important;
        transform: translate(-50%, -50%) scale(1) !important;
        transition: opacity 0.1s ease, transform 0s !important;
      }
      #jyutping-longpress-ring.done {
        opacity: 0 !important;
        transform: translate(-50%, -50%) scale(1) !important;
        transition: opacity 0.2s ease-out !important;
      }
      #jyutping-longpress-ring svg {
        display: block !important; width: 28px !important; height: 28px !important; overflow: visible !important;
      }
      #jyutping-longpress-ring .ring-track {
        fill: none !important; stroke: rgba(0, 0, 0, 0.1) !important; stroke-width: 3 !important;
      }
      #jyutping-longpress-ring .ring-progress {
        fill: none !important; stroke: rgba(138, 28, 28, 0.85) !important; stroke-width: 3 !important;
        stroke-linecap: round !important; stroke-dasharray: 69.115 !important; stroke-dashoffset: 69.115 !important;
        transform: rotate(-90deg) !important; transform-origin: center !important; transition: stroke-dashoffset 0s !important;
      }
      #jyutping-longpress-ring.active .ring-progress {
        stroke-dashoffset: 0 !important; transition: stroke-dashoffset 500ms linear !important;
      }

      /* ========== Toast 提示框 ========== */
      #jyutping-toast-container {
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        z-index: 2147483647; display: flex; flex-direction: column;
        align-items: center; gap: 8px; pointer-events: none;
      }
      .jyutping-toast {
        display: inline-flex; align-items: center; gap: 8px;
        background: rgba(30, 30, 30, 0.88); color: #f0f0f0;
        border: none; border-radius: 20px; padding: 8px 18px 8px 14px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        font-size: 13px; font-weight: 500; line-height: 1.4;
        max-width: 320px; word-wrap: break-word; pointer-events: auto;
        opacity: 0; transform: translateY(-12px) scale(0.95);
        transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .jyutping-toast.show { opacity: 1; transform: translateY(0) scale(1); }
      .jyutping-toast-success { background: rgba(120, 30, 30, 0.72) !important; color: #fff !important; backdrop-filter: blur(16px) saturate(180%) !important; -webkit-backdrop-filter: blur(16px) saturate(180%) !important; border: 1px solid rgba(255, 255, 255, 0.15) !important; }
      .jyutping-toast-error { background: rgba(60, 60, 60, 0.92) !important; color: #f0f0f0 !important; }

      /* ========== Translation Highlight ========== */
      ::highlight(jyutping-translate-hl) {
        background-color: rgba(255, 213, 79, 0.5) !important;
        color: inherit !important;
      }

      /* ========== 懸停注音 (Ruby) 樣式 ========== */
      ruby.jyutping-hover-ruby {
        cursor: pointer; line-height: inherit; position: relative !important; display: inline !important;
      }
      /* 提升層級以保證高亮樣式正常顯示 */
      ruby.jyutping-hover-ruby:hover,
      ruby.jyutping-hover-ruby.jyutping-popup-active {
        z-index: 2147483640 !important;
      }
      ruby.jyutping-hover-ruby:hover,
      ruby.jyutping-hover-ruby.jyutping-popup-active {
        color: var(--ruby-hover-color, #8A1C1C) !important;
      }
      ruby.jyutping-hover-ruby.hl-ruby-red { --ruby-hover-color: #8A1C1C; }
      ruby.jyutping-hover-ruby.hl-ruby-blue { --ruby-hover-color: #1565C0; }
      ruby.jyutping-hover-ruby.hl-ruby-green { --ruby-hover-color: #2E7D32; }
      ruby.jyutping-hover-ruby.hl-ruby-orange { --ruby-hover-color: #E65100; }
      ruby.jyutping-hover-ruby.hl-ruby-purple { --ruby-hover-color: #6A1B9A; }
      /* 暗色背景自適應：覆寫為亮色 */
      ruby.jyutping-hover-ruby.dark-bg { --ruby-hover-color: #FFD54F; }
      ruby.jyutping-hover-ruby.hl-ruby-underline:hover,
      ruby.jyutping-hover-ruby.hl-ruby-underline.jyutping-popup-active {
        text-decoration: underline dashed var(--ruby-hover-color, #8A1C1C) !important;
        text-underline-offset: 3px !important; text-decoration-thickness: 1.5px !important;
      }
      ruby.jyutping-hover-ruby.hl-ruby-border:hover,
      ruby.jyutping-hover-ruby.hl-ruby-border.jyutping-popup-active {
        outline: 1.5px dashed var(--ruby-hover-color, #8A1C1C) !important;
        outline-offset: 1px !important; border-radius: 3px !important;
      }

      /* ========== 全文注音 (Ruby) 樣式 ========== */
      ruby.jyutping-ruby-injected {
        ruby-align: center; ruby-position: over;
        line-height: 2.0 !important; margin: 0 0.15em !important; cursor: pointer;
      }
      ruby.jyutping-ruby-injected:hover,
      ruby.jyutping-ruby-injected.jyutping-popup-active,
      ruby.jyutping-ruby-injected:hover rt,
      ruby.jyutping-ruby-injected.jyutping-popup-active rt {
        color: #991b1b !important;
      }
      ruby.jyutping-ruby-injected:hover.jyutping-clicked-hover rt {
        opacity: 1 !important;
      }
      /* 暗色背景自適應 */
      ruby.jyutping-ruby-injected.dark-bg:hover,
      ruby.jyutping-ruby-injected.dark-bg.jyutping-popup-active,
      ruby.jyutping-ruby-injected.dark-bg:hover rt,
      ruby.jyutping-ruby-injected.dark-bg.jyutping-popup-active rt {
        color: #FFD54F !important;
      }
      ruby.jyutping-ruby-injected.dark-bg:hover.jyutping-clicked-hover rt,
      ruby.jyutping-ruby-injected.dark-bg.speaking rt {
        opacity: 1 !important;
      }
      ruby.jyutping-ruby-injected:hover.jyutping-clicked-hover rt,
      ruby.jyutping-ruby-injected.speaking rt {
        opacity: 1 !important;
      }
      ruby.jyutping-ruby-injected rt {
        font-family: var(--jyutping-rt-font, system-ui, -apple-system, sans-serif) !important;
        font-size: 0.5em !important;
        font-weight: var(--jyutping-rt-font-weight, normal) !important;
        font-style: var(--jyutping-rt-font-style, normal) !important;
        letter-spacing: -0.05em !important; padding: 0 0.15em !important;
        color: var(--jyutping-rt-color, inherit) !important;
        opacity: var(--jyutping-rt-opacity, 0.6) !important;
        user-select: none; white-space: nowrap !important;
        transform: scale(0.9); transform-origin: center bottom;
      }

      /* ========== 段落粵語翻譯（內聯於原文下方，灰色半透明以示區別）========== */
      .jyutping-cantonese-trans {
        opacity: 0.65 !important;
        margin-top: 0.15em !important;
        /* 繼承自原塊的字體/排版（淺克隆保留了 class），此處僅淡化以示區別 */
      }
      .jyutping-cantonese-trans-replace {
        opacity: 1 !important;
        margin-top: 0 !important;
      }
      .jyutping-cantonese-trans .jyutping-cantonese-trans-loading {
        opacity: 0.85;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 8px !important;
        width: fit-content !important;
      }
      .jyutping-loading-spinner {
        display: inline-block !important;
        width: 14px !important;
        height: 14px !important;
        margin: 0 !important;
        padding: 0 !important;
        flex-shrink: 0 !important;
        border: 2px solid currentColor !important;
        border-right-color: transparent !important;
        border-radius: 50% !important;
        animation: jyutping-spin 0.75s linear infinite !important;
      }
      @keyframes jyutping-spin {
        100% { transform: rotate(360deg); }
      }
      
      /* Speaker Button in Paragraph Translation */
      .jyutping-speaker-btn {
        background: transparent; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 2px; margin-left: 6px; color: inherit; opacity: 0.6; transition: opacity 0.2s, color 0.2s; vertical-align: middle;
      }
      .jyutping-speaker-btn:hover {
        opacity: 1;
      }
      .jyutping-speaker-btn .tts-wave {
        opacity: 0.4;
        transition: opacity 0.2s;
      }
      .jyutping-speaker-btn:hover .tts-wave {
        opacity: 0.8;
      }
      .jyutping-speaker-btn.speaking {
        color: #8A1C1C !important;
        opacity: 1;
      }
      .jyutping-speaker-btn.speaking .tts-wave-1 {
        animation: tts-wave-anim 1.5s infinite;
      }
      .jyutping-speaker-btn.speaking .tts-wave-2 {
        animation: tts-wave-anim 1.5s infinite 0.3s;
      }
      @keyframes tts-wave-anim {
        0%, 100% { opacity: 0; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(hostStyle);

    document.body.appendChild(host);
  }

  // 初始化：創建彈窗元素
  async function init() {
    await createShadowHost();
    createPopup();
    createTranslatePopup();
    loadSettings();
    setupEventListeners();

    // 字典改為懶加載：首次滑鼠移動時才開始載入（見 mousemove 處理器），
    // 讓用戶從不交互的廣告/追蹤類 iframe 不再白白載入 ~80MB 字典。

    // 如果 sessionStorage 記錄了開啟全文注音，則自動恢復（此路徑需要字典，先確保載入）
    if (isFullPageRubyActive && isEnabled) {
      await loadDictionary();
      console.log('[Content] Auto-restoring Jyutping Full Page Ruby from sessionStorage');
      injectRubyAnnotations(document.body);
      startRubyObserver();
    }
  }

  let hasUserSelection = false;

  // 創建句子翻譯用的獨立浮窗（當沒有詞典彈窗時使用）
  function createTranslatePopup() {
    translatePopup = document.createElement('div');
    translatePopup.id = 'cantonese-translate-popup';
    translatePopup.style.display = 'none';
    translatePopup.style.position = 'absolute';
    translatePopup.style.left = '-9999px';
    translatePopup.style.top = '-9999px';
    shadowRoot.appendChild(translatePopup);
    translatePopup.addEventListener('mousedown', (e) => {
      // 允許 QA 容器內的元素正常響應點擊（輸入框焦點、按鈕點擊等）
      if (e.target.closest('.popup-qa-container')) {
        e.stopPropagation();
        return;
      }
      // 允許表單元素獲取焦點
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'input') {
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    });
    translatePopup.addEventListener('mouseenter', () => {
      isMouseOverPopup = true;
      cancelScheduledHide();
    });
    translatePopup.addEventListener('mouseleave', () => {
      isMouseOverPopup = false;
      if (Date.now() - lastPopupShowTime < 400) return; // 忽略剛顯示時因為 DOM 變動觸發的幽靈事件
      scheduleHidePopup();
    });

    // 雙擊翻譯浮窗打開 AI Q&A
    translatePopup.addEventListener('dblclick', (e) => {
      if (e.target.closest('textarea') || e.target.closest('input') || e.target.closest('button')) {
        return;
      }
      e.stopPropagation();
      showPopupQA(translatePopup);
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
    
    // 移除之前的 done 類
    longPressRing.classList.remove('done');
    
    // 強制重繪
    longPressRing.offsetHeight;
    
    // 添加 active 類觸發 CSS 動畫（因為 popup.css 用了 !important，inline style 無效）
    longPressRing.classList.add('active');
  }

  function cancelLongPressAnimation() {
    if (aiAnimationTimer) {
      clearTimeout(aiAnimationTimer);
      aiAnimationTimer = null;
    }
    if (!longPressRing) return;
    longPressRing.classList.remove('active');
    longPressRing.classList.remove('done');
    
    // 重置內聯樣式（防禦性代碼）
    longPressRing.style.opacity = '0';
    const progressCircle = longPressRing.querySelector('.ring-progress');
    if (progressCircle) {
      progressCircle.style.transition = 'none';
      progressCircle.style.strokeDashoffset = '69.1';
    }
  }

  // 對於跨行/多行選區，選取距離當前滑鼠最近的行/區塊 Rect，並合併同行的 rects
  function getBestRectForRange(range) {
    if (!range) {
      console.log('[Debug] getBestRectForRange: range is null');
      return null;
    }
    const rects = Array.from(range.getClientRects());
    console.log('[Debug] getBestRectForRange: rects count =', rects.length);
    if (rects.length > 1) {
      console.log('[Debug] getBestRectForRange: multiple rects detected', rects);
    }
    if (rects.length === 0) return null;
    if (rects.length === 1) return rects[0];

    // 如果滑鼠位置為 0，預設使用整體 bounding rect
    if (currentMouseX === 0 && currentMouseY === 0) {
      console.log('[Debug] getBestRectForRange: mouse position is 0, returning bounding box', range.getBoundingClientRect());
      return range.getBoundingClientRect();
    }

    // 尋找距離最後滑鼠位置最近的 rect
    let bestRect = rects[0];
    let minDistance = Infinity;
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      // 計算滑鼠到這個矩形的距離
      const dx = Math.max(rect.left - currentMouseX, 0, currentMouseX - rect.right);
      const dy = Math.max(rect.top - currentMouseY, 0, currentMouseY - rect.bottom);
      const dist = dx * dx + dy * dy;
      if (dist < minDistance) {
        minDistance = dist;
        bestRect = rect;
      }
    }

    // 將與 bestRect 處於同一行的所有 rect 合併（解決同行多個 span 的問題）
    let minX = bestRect.left;
    let maxX = bestRect.right;
    let minY = bestRect.top;
    let maxY = bestRect.bottom;
    
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      // 判斷是否在同一行 (垂直有重疊)
      if (rect.bottom > bestRect.top && rect.top < bestRect.bottom) {
        minX = Math.min(minX, rect.left);
        maxX = Math.max(maxX, rect.right);
        minY = Math.min(minY, rect.top);
        maxY = Math.max(maxY, rect.bottom);
      }
    }

    const finalRect = {
      left: minX,
      right: maxX,
      top: minY,
      bottom: maxY,
      width: maxX - minX,
      height: maxY - minY
    };
    console.log('[Debug] getBestRectForRange: returning merged finalRect', finalRect);
    return finalRect;
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

    let left;
    let top;
    let arrowDirection = 'up';

    // 水平位置：居中對齊高亮詞
    const highlightCenterX = rect.left + rect.width / 2;
    left = highlightCenterX - popupWidth / 2;
    if (left + popupWidth > viewportWidth - 5) left = viewportWidth - popupWidth - 5;
    if (left < 5) left = 5;

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
      // 使用上面已計算（並可能已被修改置中）的 highlightCenterX
      let arrowCenter = highlightCenterX - left;
      arrowCenter = Math.max(16, Math.min(arrowCenter, popupWidth - 16));
      translatePopupArrow.style.left = arrowCenter + 'px';
    }
  }

  function requestTranslation(text) {
    // 如果沒有選擇任何翻譯語言，直接禁用翻譯功能
    if (!transLangs || transLangs.length === 0) return;

    // 只翻譯包含中文的文本
    const chineseRatio = (text.match(/[\u4e00-\u9fff]/g) || []).length / text.length;
    if (chineseRatio < 0.3) return;

    if (transHoverEngine === 'ai' && aiEnabled) {
      let fakeTranslations = {};
      transLangs.forEach(lang => {
        fakeTranslations[lang] = 'AI 翻譯中...';
      });
      showTranslatePopup(text, fakeTranslations, false);

      let rows;
      if (translatePopup && translatePopup.style.display !== 'none') {
        rows = translatePopup.querySelectorAll('.translate-row');
      } else if (popup && popup.style.display !== 'none') {
        rows = popup.querySelectorAll('.translate-row');
      }
      if (rows) {
        rows.forEach(row => {
          const textEl = row.querySelector('.translate-text');
          const labelEl = row.querySelector('.translate-label');
          const key = row.dataset.key;
          if (textEl) textEl.style.opacity = '0.5';
          if (labelEl) {
            let labelName = 'AI';
            if (key === 'zh-Hans') labelName = pt('mandarin');
            else if (key === 'en') labelName = pt('english');
            else if (key === 'ja') labelName = pt('japanese');
            else if (key === 'ko') labelName = pt('korean');
            labelEl.textContent = labelName;
            labelEl.classList.add('translate-label-ai');
            labelEl.title = '點擊使用 Bing 重新翻譯';
          }
        });
      }

      transLangs.forEach(lang => {
        let langName = '';
        if (lang === 'zh-Hans') langName = '現代標準漢語（普通話）';
        else if (lang === 'en') langName = '英文';
        else if (lang === 'ja') langName = '日文';
        else if (lang === 'ko') langName = '韓文';
        
        chrome.runtime.sendMessage({
          action: 'aiTranslateSentenceLang',
          text: text,
          targetLang: langName,
          key: lang
        });
      });
    } else {
      showTranslatePopup(text, null, true);
      chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        transLangs: transLangs
      });
    }
  }

  // 顯示翻譯結果：優先在詞典彈窗內，否則用獨立浮窗
  function showTranslatePopup(originalText, translations, loading) {
    cancelScheduledHide();
    lastPopupShowTime = Date.now();
    
    if (originalText !== null) {
      activeQAContext.word = '';
      activeQAContext.sentence = originalText;
      activeQAContext.history = [];
    }
    if (!loading && translations) {
      activeQAContext.originalTranslation = Object.values(translations).join('; ');
    }

    // 如果詞典彈窗正在顯示（且非精簡/Ruby模式），將翻譯結果插入其中
    if (popup && popup.style.display !== 'none' && !popup.classList.contains('compact-mode') && !popup.classList.contains('popup-ruby-mode')) {
      const translateDiv = popup.querySelector('.popup-translate');
      if (translateDiv) {
        if (loading) {
          translateDiv.innerHTML = `<div class="translate-loading">${pt('translating')}</div>`;
        } else {
          let rows = '';
          if (translations) {
            const keys = Object.keys(translations);
            for (const key of keys) {
              let label = '';
              let langName = '';
              if (key === 'zh-Hans') { label = pt('mandarin'); langName = '現代標準漢語（普通話）'; }
              else if (key === 'en') { label = pt('english'); langName = '英文'; }
              else if (key === 'ja') { label = pt('japanese'); langName = '日文'; }
              else if (key === 'ko') { label = pt('korean'); langName = '韓文'; }
              rows += `<div class="translate-row" data-key="${key}" data-lang="${langName}"><span class="translate-label translate-label-${key}" title="點擊使用 AI 重新翻譯" style="cursor: pointer;">${label}</span><span class="translate-text">${translations[key] || ''}</span></div>`;
            }
          }
          translateDiv.innerHTML = rows;
          
          // 綁定標籤點擊事件
          translateDiv.querySelectorAll('.translate-label').forEach(labelEl => {
            labelEl.addEventListener('click', (e) => {
              e.stopPropagation();
              const row = labelEl.closest('.translate-row');
              const key = row.dataset.key;
              const langName = row.dataset.lang;
              const textEl = row.querySelector('.translate-text');
              
              if (popup) popup.classList.add('jyutping-popup-pinned');
              if (translatePopup) translatePopup.classList.add('jyutping-popup-pinned');

              if (labelEl.classList.contains('translate-label-ai')) {
                labelEl.classList.remove('translate-label-ai');
                if (key === 'zh-Hans') labelEl.textContent = pt('mandarin');
                else if (key === 'en') labelEl.textContent = pt('english');
                else if (key === 'ja') labelEl.textContent = pt('japanese');
                else if (key === 'ko') labelEl.textContent = pt('korean');
                labelEl.title = '點擊使用 AI 重新翻譯';
                
                if (textEl) {
                  textEl.textContent = 'Bing 翻譯中...';
                  textEl.style.opacity = '0.5';
                }
                chrome.runtime.sendMessage({
                  action: 'bingTranslateSentenceLang',
                  text: activeQAContext.sentence,
                  targetLang: key,
                  key: key
                });
              } else {
                if (textEl) {
                  textEl.textContent = 'AI 翻譯中...';
                  textEl.style.opacity = '0.5';
                }
                let labelName = 'AI';
                if (key === 'zh-Hans') labelName = pt('mandarin');
                else if (key === 'en') labelName = pt('english');
                else if (key === 'ja') labelName = pt('japanese');
                else if (key === 'ko') labelName = pt('korean');
                labelEl.textContent = labelName;
                labelEl.title = '點擊使用 Bing 重新翻譯';
                labelEl.classList.add('translate-label-ai');
                chrome.runtime.sendMessage({
                  action: 'aiTranslateSentenceLang',
                  text: activeQAContext.sentence,
                  targetLang: labelName,
                  key: key
                });
              }
            });
          });
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
      let rows = '';
      if (translations) {
        const keys = Object.keys(translations);
        for (const key of keys) {
          let label = '';
          let langName = '';
          if (key === 'zh-Hans') { label = pt('mandarin'); langName = '現代標準漢語（普通話）'; }
          else if (key === 'en') { label = pt('english'); langName = '英文'; }
          else if (key === 'ja') { label = pt('japanese'); langName = '日文'; }
          else if (key === 'ko') { label = pt('korean'); langName = '韓文'; }
          rows += `<div class="translate-row" data-key="${key}" data-lang="${langName}"><span class="translate-label translate-label-${key}" title="點擊使用 AI 重新翻譯" style="cursor: pointer;">${label}</span><span class="translate-text">${translations[key] || ''}</span></div>`;
        }
      }
      innerContent = rows;
    }

    translatePopup.innerHTML = `
      <div class="popup-inner">
        ${innerContent}
      </div>
      <div class="popup-arrow"></div>
    `;

    // 綁定標籤點擊事件
    translatePopup.querySelectorAll('.translate-label').forEach(labelEl => {
      labelEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = labelEl.closest('.translate-row');
        if (!row) return;
        const key = row.dataset.key;
        const langName = row.dataset.lang;
        const textEl = row.querySelector('.translate-text');
        
        if (popup) popup.classList.add('jyutping-popup-pinned');
        if (translatePopup) translatePopup.classList.add('jyutping-popup-pinned');

        if (labelEl.classList.contains('translate-label-ai')) {
          labelEl.classList.remove('translate-label-ai');
          if (key === 'zh-Hans') labelEl.textContent = pt('mandarin');
          else if (key === 'en') labelEl.textContent = pt('english');
          else if (key === 'ja') labelEl.textContent = pt('japanese');
          else if (key === 'ko') labelEl.textContent = pt('korean');
          labelEl.title = '點擊使用 AI 重新翻譯';
          
          if (textEl) {
            textEl.textContent = 'Bing 翻譯中...';
            textEl.style.opacity = '0.5';
          }
          chrome.runtime.sendMessage({
            action: 'bingTranslateSentenceLang',
            text: activeQAContext.sentence,
            targetLang: key,
            key: key
          });
        } else {
          if (textEl) {
            textEl.textContent = 'AI 翻譯中...';
            textEl.style.opacity = '0.5';
          }
          let labelName = 'AI';
          if (key === 'zh-Hans') labelName = pt('mandarin');
          else if (key === 'en') labelName = pt('english');
          else if (key === 'ja') labelName = pt('japanese');
          else if (key === 'ko') labelName = pt('korean');
          labelEl.textContent = labelName;
          labelEl.title = '點擊使用 Bing 重新翻譯';
          labelEl.classList.add('translate-label-ai');
          chrome.runtime.sendMessage({
            action: 'aiTranslateSentenceLang',
            text: activeQAContext.sentence,
            targetLang: labelName,
            key: key
          });
        }
      });
    });

    translatePopup.style.display = 'block';
    // 句子翻譯浮窗預設採用自適應寬度（最適合其長度的寬度，最大 320px）
    translatePopup.style.setProperty('width', 'max-content', 'important');
    translatePopup.style.setProperty('min-width', '0', 'important');
    translatePopup.style.setProperty('max-width', '320px', 'important');
    const inner = translatePopup.querySelector('.popup-inner');
    if (inner) {
      inner.style.setProperty('width', 'auto', 'important');
      inner.style.setProperty('max-width', '100%', 'important');
      inner.style.setProperty('min-width', '0', 'important');
      inner.style.setProperty('box-sizing', 'border-box', 'important');
    }
    // 調用 applyPopupTheme 確保樣式同步
    if (typeof popupTheme !== 'undefined') applyPopupTheme(popupTheme);

    // 定位在選區下方
    let posRect = null;
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      posRect = getBestRectForRange(range);
      
      // 添加自定義高亮，避免輸入框獲取焦點時原生選區消失
      if (typeof CSS !== 'undefined' && CSS.highlights) {
        try {
          const highlight = new Highlight(range);
          CSS.highlights.set('jyutping-translate-hl', highlight);
        } catch (e) {
          console.warn('CSS Custom Highlights API failed:', e);
        }
      }
    }
    if (!posRect && typeof currentRange !== 'undefined' && currentRange) {
      posRect = getBestRectForRange(currentRange);
    }
    if (posRect) {
      lastTranslateRect = posRect;
      positionTranslatePopup(posRect);
    }
  }

  // 隱藏翻譯結果浮窗
  function hideTranslatePopup() {
    if (translatePopup) {
      translatePopup.classList.remove('jyutping-popup-pinned');
      translatePopup.style.display = 'none';
      translatePopup.style.removeProperty('width');
      translatePopup.style.removeProperty('min-width');
      translatePopup.style.removeProperty('max-width');
      const inner = translatePopup.querySelector('.popup-inner');
      if (inner) {
        inner.style.removeProperty('width');
        inner.style.removeProperty('max-width');
        inner.style.removeProperty('min-width');
        inner.style.removeProperty('box-sizing');
      }
      const qaContainer = translatePopup.querySelector('.popup-qa-container');
      if (qaContainer) {
        qaContainer.remove();
      }
      const qaUpperDisplay = translatePopup.querySelector('.qa-upper-display');
      if (qaUpperDisplay) {
        qaUpperDisplay.remove();
      }
      if (inner) {
        Array.from(inner.children).forEach(child => {
          if (child.className !== 'popup-qa-container' && child.className !== 'qa-upper-display') {
            child.style.display = '';
          }
        });
      }
    }
    
    // 移除翻譯浮窗的高亮
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      CSS.highlights.delete('jyutping-translate-hl');
    }
    
    clearQAContext();
  }

  // 獲取選中文本/高亮範圍所在的段落/句子作為上下文
  function getSurroundingSentence(rangeToUse) {
    let targetNode = null;
    if (rangeToUse) {
      try {
        targetNode = rangeToUse.startContainer;
      } catch (e) {}
    }
    if (!targetNode) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        try {
          targetNode = selection.getRangeAt(0).startContainer;
        } catch (e) {}
      }
    }
    if (!targetNode) return '';
    
    // 向上找到塊級元素
    const blockTags = ['P', 'DIV', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'ARTICLE', 'SECTION'];
    let el = targetNode.nodeType === Node.TEXT_NODE ? targetNode.parentElement : targetNode;
    while (el && !blockTags.includes(el.tagName)) {
      el = el.parentElement;
    }
    
    if (!el) {
      // fallback: 用 targetNode 的父元素
      el = targetNode.nodeType === Node.TEXT_NODE ? targetNode.parentElement : targetNode;
    }
    
    const text = (el.textContent || '').trim();
    // 限制長度，避免發送過長的上下文
    return text.length > 500 ? text.substring(0, 500) + '...' : text;
  }

  // 請求 AI 翻譯
  function requestAiTranslation(word, rectOverride = null) {
    if (!word) return;
    
    const sentence = getSurroundingSentence(currentRange);
    console.log('[AI] requestAiTranslation, word:', word, 'sentence:', sentence.substring(0, 80));
    
    // 預先填充 Q&A 內容緩存，防止結果返回時遺失上下文
    activeQAContext.word = word;
    activeQAContext.sentence = sentence;
    activeQAContext.originalTranslation = 'AI 翻譯中...';
    activeQAContext.history = [];

    // 擷取並儲存當前目標位置，避免 fallback 到上一次的 popup 導致位置跳躍
    let targetRect = rectOverride;
    if (!targetRect) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        targetRect = getBestRectForRange(selection.getRangeAt(0));
      } else if (typeof currentRange !== 'undefined' && currentRange) {
        targetRect = getBestRectForRange(currentRange);
      }
    }
    activeQAContext.targetRect = targetRect;

    // 發起全新的翻譯請求前，清除可能殘留的舊獨立彈窗內容，避免錯誤追加到舊 QA 容器中或殘留舊狀態
    if (translatePopup && translatePopup.style.display !== 'none') {
      translatePopup.innerHTML = '';
      translatePopup.style.display = 'none';
    }

    // 顯示加載狀態
    showAiResult(word, '✨ AI 分析中...', targetRect);
    
    chrome.runtime.sendMessage({
      action: 'aiTranslate',
      word: word,
      sentence: sentence
    });
  }

  // 顯示 AI 翻譯結果
  function showAiResult(word, explanation, targetRect = null) {
    // 確保如果沒有前綴，預設補上 "✨ "
    let textToRender = explanation;
    if (!explanation.startsWith('✨') && !explanation.startsWith('❌')) {
      textToRender = '✨ ' + explanation;
    }
    const renderedText = renderMarkdown(textToRender);

    // 如果詞典彈窗正在顯示（且非精簡/Ruby模式），插入其中
    if (popup && popup.style.display !== 'none' && !popup.classList.contains('compact-mode') && !popup.classList.contains('popup-ruby-mode')) {
      const translateDiv = popup.querySelector('.popup-translate');
      if (translateDiv) {
        // 如果已經有了 .ai-text，只更新內容，避免破壞可能存在的 Q&A
        const existingAiText = translateDiv.querySelector('.ai-text');
        if (existingAiText) {
          existingAiText.innerHTML = renderedText;
        } else {
          translateDiv.innerHTML = `
            <div class="ai-result">
              <div class="ai-text" style="white-space: pre-wrap;">${renderedText}</div>
            </div>
          `;
        }
        translateDiv.style.display = 'block';
        return;
      }
    }
    
    // 否則用獨立浮窗
    if (!translatePopup) return;
    
    // 如果獨立浮窗已經在顯示，且包含 .ai-text，只需更新文字，以保護可能打開的 Q&A 界面
    if (translatePopup.style.display !== 'none') {
      const aiText = translatePopup.querySelector('.ai-text');
      const isQA = translatePopup.querySelector('.popup-qa-container');
      if (aiText && !isQA) {
        aiText.innerHTML = renderedText;
        const finalRect = targetRect || lastTranslateRect;
        if (finalRect) {
          lastTranslateRect = finalRect;
          positionTranslatePopup(finalRect);
        }
        return;
      }
    }

    translatePopup.innerHTML = `
      <div class="popup-inner">
        <div class="ai-result">
          <div class="ai-text" style="white-space: pre-wrap;">${renderedText}</div>
        </div>
      </div>
      <div class="popup-arrow"></div>
    `;

    translatePopup.style.display = 'block';
    // AI 翻譯浮窗預設也採用自適應寬度（最適合其長度的寬度，最大 320px）
    translatePopup.style.setProperty('width', 'max-content', 'important');
    translatePopup.style.setProperty('min-width', '0', 'important');
    translatePopup.style.setProperty('max-width', '320px', 'important');
    const inner = translatePopup.querySelector('.popup-inner');
    if (inner) {
      inner.style.setProperty('width', 'auto', 'important');
      inner.style.setProperty('max-width', '100%', 'important');
      inner.style.setProperty('min-width', '0', 'important');
      inner.style.setProperty('box-sizing', 'border-box', 'important');
    }
    // 調用 applyPopupTheme 確保樣式同步
    if (typeof popupTheme !== 'undefined') applyPopupTheme(popupTheme);

    // 定位在選區下方
    let posRect = targetRect;
    if (!posRect) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        posRect = getBestRectForRange(range);
      }
      if (!posRect && typeof currentRange !== 'undefined' && currentRange) {
        posRect = getBestRectForRange(currentRange);
      }
      if (!posRect && lastTranslateRect) {
        posRect = lastTranslateRect;
      }
    }
    
    if (posRect) {
      lastTranslateRect = posRect;
      positionTranslatePopup(posRect);
    }
  }


  // ==================== 生詞本功能 ====================

  /**
   * 將當前懸浮窗顯示的詞語存入生詞本
   * @param {Object} [overrideEntry] - 可選覆蓋的字典條目
   * @returns {Promise<void>}
   */
  async function saveCurrentWordToWordbook(overrideEntry) {
    const word = currentWord;
    if (!word) return;

    const entry = overrideEntry || (dictionary && dictionary[word]);

    try {
      const result = await addWord({
        character: word,
        simplified: entry ? entry.simplified : word,
        jyutping: entry ? entry.jyutping : '',
        yale: entry ? (entry.yale || '') : '',
        english: entry ? (entry.english || []) : [],
        sourceUrl: window.location.href,
        sourceTitle: document.title
      });

      // 更新懸浮窗中的書籤按鈕狀態
      updateBookmarkBtnState(true);

      if (result.isNew) {
        showToast(pt('wordbookSaved'), 1500, 'success');
      } else {
        showToast(pt('wordbookExists'), 1500, 'success');
      }
    } catch (e) {
      console.error('[Wordbook] Save failed:', e);
      showToast(pt('wordbookSaveFailed'), 1500, 'error');
    }
  }

  /**
   * 更新懸浮窗中的書籤按鈕圖標狀態
   * @param {boolean} isSaved
   */
  function updateBookmarkBtnState(isSaved) {
    if (!popup) return;
    const btn = popup.querySelector('.popup-bookmark-btn');
    if (!btn) return;
    const svg = btn.querySelector('svg');
    if (!svg) return;

    if (isSaved) {
      svg.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#D4AF37" stroke="#D4AF37" stroke-width="1.5"></polygon>';
      btn.title = pt('wordbookRemoved').replace('已從', '從').replace('移除', '生詞本移除');
    } else {
      svg.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" stroke-width="1.5"></polygon>';
      btn.title = pt('wordbookSaved');
    }
  }

  // 創建彈窗 DOM 元素
  function createPopup() {
    let existingPopup = document.getElementById('cantonese-popup-dict');
    if (existingPopup) {
      existingPopup.remove();
    }
    
    popup = document.createElement('div');
    popup.id = 'cantonese-popup-dict';
    popup.style.display = 'none';
    popup.style.position = 'absolute';
    popup.style.left = '-9999px';
    popup.style.top = '-9999px';
    
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
          <!-- 生詞本收藏按鈕 -->
          <div class="popup-bookmark-btn" title="加入生詞本" style="cursor: pointer; opacity: 0; width: 0; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; height: 24px; width: 0; border-radius: 4px; background-color: var(--popup-divider); margin-right: 0; color: var(--popup-text); padding: 0;">
            <svg width="14" height="14" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" stroke-width="1.5"></polygon>
            </svg>
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
    
    shadowRoot.appendChild(popup);

    // 操作按鈕區事件
    const actionsWrapper = popup.querySelector('.popup-actions-wrapper');
    const settingsBtn = popup.querySelector('.popup-settings-btn');
    const reportBtn = popup.querySelector('.popup-report-btn');
    const bookmarkBtn = popup.querySelector('.popup-bookmark-btn');
    const popupContainer = popup.querySelector('.popup-container');
    const popupTranslate = popup.querySelector('.popup-translate');
    const reportForm = popup.querySelector('.popup-report-form');

    // Hover 整個 wrapper 時：設定按鈕變亮，報告 + 書籤按鈕向左滑出
    actionsWrapper.addEventListener('mouseenter', () => {
      // 如果報告表單正在顯示，則不顯示按鈕
      if (reportForm.style.display === 'flex') return;
      
      settingsBtn.style.opacity = '1';
      settingsBtn.style.backgroundColor = 'var(--popup-divider)';
      
      reportBtn.style.opacity = '1';
      reportBtn.style.width = '60px'; // 展開寬度
      reportBtn.style.padding = '0 8px';
      reportBtn.style.marginRight = '4px';

      bookmarkBtn.style.opacity = '1';
      bookmarkBtn.style.width = '24px';
      bookmarkBtn.style.padding = '0 5px';
      bookmarkBtn.style.marginRight = '4px';
    });
    
    actionsWrapper.addEventListener('mouseleave', () => {
      settingsBtn.style.opacity = '0.4';
      settingsBtn.style.backgroundColor = 'transparent';
      
      reportBtn.style.opacity = '0';
      reportBtn.style.width = '0';
      reportBtn.style.padding = '0';
      reportBtn.style.marginRight = '0';
      reportBtn.style.backgroundColor = 'var(--popup-divider)'; // reset hover

      bookmarkBtn.style.opacity = '0';
      bookmarkBtn.style.width = '0';
      bookmarkBtn.style.padding = '0';
      bookmarkBtn.style.marginRight = '0';
      bookmarkBtn.style.backgroundColor = 'var(--popup-divider)';
    });

    // Report 按鈕獨立 hover 效果
    reportBtn.addEventListener('mouseenter', () => {
      reportBtn.style.backgroundColor = 'var(--popup-divider-strong)';
    });
    reportBtn.addEventListener('mouseleave', () => {
      reportBtn.style.backgroundColor = 'var(--popup-divider)';
    });

    // Bookmark 按鈕 hover + click
    bookmarkBtn.addEventListener('mouseenter', () => {
      bookmarkBtn.style.backgroundColor = 'var(--popup-divider-strong)';
    });
    bookmarkBtn.addEventListener('mouseleave', () => {
      bookmarkBtn.style.backgroundColor = 'var(--popup-divider)';
    });
    bookmarkBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 彈跳動畫
      bookmarkBtn.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
      bookmarkBtn.style.transform = 'scale(1.3)';
      setTimeout(() => {
        bookmarkBtn.style.transform = 'scale(1)';
      }, 200);

      // 檢查是否已收藏，如已收藏則移除
      const saved = await isWordSaved(currentWord);
      if (saved) {
        await removeWordByCharacter(currentWord);
        updateBookmarkBtnState(false);
        showToast(pt('wordbookRemoved'), 1500, 'success');
      } else {
        await saveCurrentWordToWordbook();
      }
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
      endExpandGrace(); // 鼠標移入後，解除展開寬限
      cancelScheduledHide();
    });

    // 滑鼠離開彈窗時隱藏
    popup.addEventListener('mouseleave', () => {
      isMouseOverPopup = false;
      if (Date.now() - lastPopupShowTime < 400) return; // 忽略剛顯示時因為 DOM 變動觸發的幽靈事件
      
      // 如果剛導航過（點擊鏈接），則不隱藏彈窗
      if (justNavigated) {
        return;
      }
      
      scheduleHidePopup();
    });

    // 點擊彈窗內部不關閉，且不影響背景選區
    popup.addEventListener('mousedown', (e) => {
      // 允許 QA 容器內的元素正常響應點擊
      if (e.target.closest('.popup-qa-container')) {
        e.stopPropagation();
        return;
      }
      // 允許表單元素獲取焦點
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'input') {
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    });

    // 雙擊彈窗打開 AI Q&A
    popup.addEventListener('dblclick', (e) => {
      if (e.target.closest('textarea') || e.target.closest('input') || e.target.closest('button') || e.target.closest('.see-also-link')) {
        return;
      }
      e.stopPropagation();
      showPopupQA(popup);
    });
  }

  // 載入詞典數據
  let dictionaryLoadPromise = null;
  function loadDictionary() {
    if (!dictionaryLoadPromise) {
      dictionaryLoadPromise = (async () => {
        try {
          const manifest = chrome.runtime.getManifest();
          const url = chrome.runtime.getURL('dictionary.json') + '?v=' + manifest.version;
          const response = await fetch(url, { cache: 'no-cache' });
          dictionary = await response.json();
          console.log('粵語詞典已載入，詞條數：', Object.keys(dictionary).length);
        } catch (error) {
          console.warn('載入詞典失敗：', error.message || error);
        }
      })();
    }
    return dictionaryLoadPromise;
  }

  // 載入用戶設定
  let toneDisplayStyle = 'normal';
  let rubyTextOpacity = '0.85';
  let rubyTextFont = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  let rubyTextStyle = 'default';
  let rubyDictionaryColor = '#999999';
  let enableAutoTranslateYueDefs = false;
  let autoTranslateYueDefsTargetLang = 'zh-Hans';
  let autoTranslateYueDefsEngine = 'google';
  let yueDefDisplayMode = 'expand'; // 'expand' or 'replace'
  const yueDefTranslationCache = new Map();

  function loadSettings() {
    chrome.storage.sync.get([
      'enabled', 'displayMode', 'toneStyle', 'rubyRtBackground', 'hoverModifier', 'popupDisplayStyle', 'popupTheme', 'customZhFont', 'customEnFont', 'highlightStyle', 'rubyHoverStyle', 'compactExpandBtn', 'ttsEnabled', 
      'ttsEngine', 'edgeTtsMode', 'edgeTtsUrl', 'azureTtsMode', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'ttsRate', 'toneDisplayStyle', 'rubyTextOpacity', 'rubyTextFont', 'rubyTextStyle', 'rubyDictionaryColor', 'transLang', 'transLangs', 'transTrigger', 'transHoverEngine', 'paragraphTransKey', 'paragraphTransMode', 'paragraphTransEngine', 'paragraphTransDirection', 'enableAutoTranslateYueDefs', 'autoTranslateYueDefsTargetLang', 'autoTranslateYueDefsEngine', 'yueDefDisplayMode'
    ], (result) => {
      // enabled 可能在 sync 中設定（Options 頁面），先讀取
      if (result.enabled !== undefined) isEnabled = result.enabled !== false;
      yueDefDisplayMode = result.yueDefDisplayMode || 'expand';

      displayMode = result.displayMode || 'jyutping';
      toneStyle = result.toneStyle || 'superscript';
      // 兼容舊版布爾值：true → 'solid', false → 'none'
      if (result.rubyRtBackground === true) rubyRtBackground = 'solid';
      else if (result.rubyRtBackground === false || !result.rubyRtBackground) rubyRtBackground = 'none';
      else rubyRtBackground = result.rubyRtBackground;
      hoverModifier = result.hoverModifier || 'none';
      paragraphTransKey = result.paragraphTransKey || 'shift';
      paragraphTransMode = result.paragraphTransMode || 'below';
      paragraphTransEngine = result.paragraphTransEngine || 'bing';
      paragraphTransDirection = result.paragraphTransDirection || 'yue_to_target';
      popupDisplayStyle = result.popupDisplayStyle || 'full';
      popupTheme = result.popupTheme || 'classic';
      customZhFont = result.customZhFont || '';
      customEnFont = result.customEnFont || '';
      highlightStyle = result.highlightStyle || 'yellow';
      rubyHoverStyle = result.rubyHoverStyle || 'ruby-red';
      compactExpandBtn = result.compactExpandBtn !== false;
      applyPopupTheme(popupTheme);
      ttsEnabled = result.ttsEnabled !== false;
      ttsEngine = result.ttsEngine || 'edgeTts';
      edgeTtsMode = result.edgeTtsMode || 'default';
      edgeTtsUrl = result.edgeTtsUrl || '';
      azureTtsMode = result.azureTtsMode || 'default';
      azureTtsKey = result.azureTtsKey || '';
      azureTtsRegion = result.azureTtsRegion || '';
      azureTtsVoice = result.azureTtsVoice || 'zh-HK-HiuMaanNeural';
      ttsRate = result.ttsRate || 0.9;
      toneDisplayStyle = result.toneDisplayStyle || 'normal';
      rubyTextOpacity = result.rubyTextOpacity || '0.85';
      rubyTextFont = result.rubyTextFont || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      rubyTextStyle = result.rubyTextStyle || 'default';
      rubyDictionaryColor = result.rubyDictionaryColor || '#999999';
      enableAutoTranslateYueDefs = result.enableAutoTranslateYueDefs === true;
      autoTranslateYueDefsTargetLang = result.autoTranslateYueDefsTargetLang || 'zh-Hans';
      autoTranslateYueDefsEngine = result.autoTranslateYueDefsEngine || 'google';
      let tls = result.transLangs;
      if (!tls && result.transLang) {
        if (result.transLang === 'both') tls = ['zh-Hans', 'en'];
        else if (result.transLang === 'mandarin') tls = ['zh-Hans'];
        else if (result.transLang === 'english') tls = ['en'];
      }
      if (!tls) tls = ['zh-Hans', 'en'];
      transLangs = tls;
      transTrigger = result.transTrigger || 'dblclick';
      transHoverEngine = result.transHoverEngine || 'bing';
      
      // 初始化 CSS 變數
      document.documentElement.style.setProperty('--jyutping-rt-opacity', rubyTextStyle === 'dictionary' ? '1' : rubyTextOpacity, 'important');
      if (rubyTextStyle === 'dictionary') {
        document.documentElement.style.setProperty('--jyutping-rt-font', '"Chiron Hei HK WS", "Microsoft YaHei", sans-serif', 'important');
        document.documentElement.style.setProperty('--jyutping-rt-font-style', 'italic', 'important');
        document.documentElement.style.setProperty('--jyutping-rt-color', rubyDictionaryColor, 'important');
        document.documentElement.style.setProperty('--jyutping-rt-font-weight', 'normal', 'important');
        document.documentElement.style.setProperty('-webkit-font-smoothing', 'antialiased', 'important');
      } else {
        if (rubyTextFont) {
          document.documentElement.style.setProperty('--jyutping-rt-font', rubyTextFont, 'important');
        } else {
          document.documentElement.style.removeProperty('--jyutping-rt-font');
        }
        document.documentElement.style.setProperty('--jyutping-rt-font-style', 'normal', 'important');
        document.documentElement.style.setProperty('--jyutping-rt-color', 'inherit', 'important');
        document.documentElement.style.setProperty('--jyutping-rt-font-weight', 'normal', 'important');
        document.documentElement.style.setProperty('-webkit-font-smoothing', 'auto', 'important');
      }
    });
    // aiEnabled 狀態從 local storage 讀取
    chrome.storage.local.get(['aiEnabled'], (result) => {
      aiEnabled = result.aiEnabled === true;
      console.log('[AI] loadSettings, aiEnabled:', aiEnabled);
    });
  }

  // 監聽設定變更
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      
      if (changes.uiTheme) {
        // uiTheme 在 content.js 已無消費者；保留此處是為了在 UI 主題變更時同步刷新懸浮窗主題（行為不變）
        applyPopupTheme(popupTheme);
      }

      if (changes.toneDisplayStyle) {
        toneDisplayStyle = changes.toneDisplayStyle.newValue;
      }
      if (changes.rubyTextOpacity) {
        rubyTextOpacity = changes.rubyTextOpacity.newValue;
        document.documentElement.style.setProperty('--jyutping-rt-opacity', rubyTextStyle === 'dictionary' ? '1' : rubyTextOpacity, 'important');
      }
      if (changes.rubyDictionaryColor) {
        rubyDictionaryColor = changes.rubyDictionaryColor.newValue;
        if (rubyTextStyle === 'dictionary') {
          document.documentElement.style.setProperty('--jyutping-rt-color', rubyDictionaryColor, 'important');
        }
      }
      if (changes.rubyTextFont) {
        rubyTextFont = changes.rubyTextFont.newValue;
        if (rubyTextFont) {
          document.documentElement.style.setProperty('--jyutping-rt-font', rubyTextFont, 'important');
        } else {
          document.documentElement.style.removeProperty('--jyutping-rt-font');
        }
      }
      if (changes.rubyTextStyle) {
        rubyTextStyle = changes.rubyTextStyle.newValue;
        document.documentElement.style.setProperty('--jyutping-rt-opacity', rubyTextStyle === 'dictionary' ? '1' : rubyTextOpacity, 'important');
        if (rubyTextStyle === 'dictionary') {
          document.documentElement.style.setProperty('--jyutping-rt-font', '"Chiron Hei HK WS", "Microsoft YaHei", sans-serif', 'important');
          document.documentElement.style.setProperty('--jyutping-rt-font-style', 'italic', 'important');
          document.documentElement.style.setProperty('--jyutping-rt-color', rubyDictionaryColor, 'important');
          document.documentElement.style.setProperty('--jyutping-rt-font-weight', 'normal', 'important');
          document.documentElement.style.setProperty('-webkit-font-smoothing', 'antialiased', 'important');
        } else {
          if (rubyTextFont) {
            document.documentElement.style.setProperty('--jyutping-rt-font', rubyTextFont, 'important');
          } else {
            document.documentElement.style.removeProperty('--jyutping-rt-font');
          }
          document.documentElement.style.setProperty('--jyutping-rt-font-style', 'normal', 'important');
          document.documentElement.style.setProperty('--jyutping-rt-color', 'inherit', 'important');
          document.documentElement.style.setProperty('--jyutping-rt-font-weight', 'normal', 'important');
          document.documentElement.style.setProperty('-webkit-font-smoothing', 'auto', 'important');
        }
      }
      if (changes.transLangs) {
        transLangs = changes.transLangs.newValue;
      } else if (changes.transLang && !changes.transLangs) {
        let tls = changes.transLang.newValue;
        if (tls === 'both') transLangs = ['zh-Hans', 'en'];
        else if (tls === 'mandarin') transLangs = ['zh-Hans'];
        else if (tls === 'english') transLangs = ['en'];
      } else if (changes.transTrigger) {
        transTrigger = changes.transTrigger.newValue;
      } else if (changes.transHoverEngine) {
        transHoverEngine = changes.transHoverEngine.newValue;
      } else if (changes.paragraphTransDirection) {
        paragraphTransDirection = changes.paragraphTransDirection.newValue || 'yue_to_target';
      } else if (changes.enableAutoTranslateYueDefs) {
        enableAutoTranslateYueDefs = changes.enableAutoTranslateYueDefs.newValue === true;
      } else if (changes.autoTranslateYueDefsTargetLang) {
        autoTranslateYueDefsTargetLang = changes.autoTranslateYueDefsTargetLang.newValue;
      } else if (changes.autoTranslateYueDefsEngine) {
        autoTranslateYueDefsEngine = changes.autoTranslateYueDefsEngine.newValue;
      } else if (changes.yueDefDisplayMode) {
        yueDefDisplayMode = changes.yueDefDisplayMode.newValue || 'expand';
      }
    } else if (area === 'local') {
      if (changes.aiEnabled) {
        aiEnabled = changes.aiEnabled.newValue === true;
        console.log('[AI] Dynamic update from storage.onChanged (local), aiEnabled:', aiEnabled);
      }
    }
  });

  // 粵語朗讀功能
  let lastSpeakTime = 0;
  let ttsPlaybackTimer = null; // 用於追蹤 TTS 播放狀態
  let activeSpeakerBtn = null; // 當前正在播放動畫的按鈕
  let activeSpeakingRuby = null; // 當前正在發音的 Ruby 元素
  
  function startSpeakerAnimation(btn = null) {
    if (activeSpeakerBtn) {
      activeSpeakerBtn.classList.remove('speaking');
    }
    if (activeSpeakingRuby) {
      activeSpeakingRuby.classList.remove('speaking');
      activeSpeakingRuby = null;
    }
    activeSpeakerBtn = btn || (popup ? popup.querySelector('.pronunciation-section .tts-speaker-btn') : null);
    if (activeSpeakerBtn) activeSpeakerBtn.classList.add('speaking');
    
    // 清除上一次的保底計時器
    if (ttsPlaybackTimer) clearTimeout(ttsPlaybackTimer);
  }
  
  // 啟動 Ruby 元素的發音狀態標記
  function startRubySpeakingState(rubyEl) {
    if (activeSpeakingRuby) {
      activeSpeakingRuby.classList.remove('speaking');
    }
    activeSpeakingRuby = rubyEl;
    if (activeSpeakingRuby) activeSpeakingRuby.classList.add('speaking');
    
    // 同步更新浮動層的拼音為不透明（模擬原版 rt 在 speaking 時 opacity: 1）
    if (popup && popup.classList.contains('popup-ruby-mode')) {
      const floatingText = popup.querySelector('.ruby-floating-text');
      if (floatingText) {
        floatingText.style.opacity = '1';
      }
    }
  }
  
  function stopSpeakerAnimation() {
    if (activeSpeakerBtn) {
      activeSpeakerBtn.classList.remove('speaking');
      activeSpeakerBtn = null;
    }
    if (activeSpeakingRuby) {
      activeSpeakingRuby.classList.remove('speaking');
      activeSpeakingRuby = null;
    }
    if (ttsPlaybackTimer) { clearTimeout(ttsPlaybackTimer); ttsPlaybackTimer = null; }
  }
  

  async function speakCantonese(text, targetBtn = null) {
    if (!ttsEnabled) return;
    
    // ★ 關鍵修復：在用戶手勢（點擊）的同步調用棧中，立即播放一個無聲的音頻，以解鎖瀏覽器的 Autoplay Policy
    try {
        const dummyAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        dummyAudio.volume = 0;
        dummyAudio.play().catch(e => console.log('Dummy audio unlock failed:', e));
    } catch (e) {
        console.error('Audio unlock error:', e);
    }
    
    // 將文本轉換為繁體（如果詞典有記錄），避免 macOS WebSpeech 等引擎將簡體字（如「区」）錯誤讀成國語
    let textToSpeak = text;
    if (dictionary && dictionary[text] && dictionary[text].traditional) {
      textToSpeak = dictionary[text].traditional;
    }
    
    // 全局防抖：300ms 內不重複發音
    const now = Date.now();
    console.trace(`speakCantonese called for "${textToSpeak}". Time diff: ${now - lastSpeakTime}ms`);
    if (now - lastSpeakTime < 300) {
      console.log('speakCantonese blocked by debounce');
      return;
    }
    lastSpeakTime = now;
    
    console.log('speakCantonese proceeding, engine:', ttsEngine);
    
    // ★ 統一啟動喇叭動畫
    startSpeakerAnimation(targetBtn);
    // 估算發音時長：每個漢字大約 500ms，加上 1000ms 的網絡延遲緩衝，受語速影響
    const estimatedDurationMs = (textToSpeak.length * 500 + 1000) / ttsRate;
    // 保底超時：最少 2000ms，最多 10000ms（此為兜底，正常由 audio.onended 觸發停止）
    const timeoutMs = Math.max(2000, Math.min(estimatedDurationMs, 10000));
    ttsPlaybackTimer = setTimeout(stopSpeakerAnimation, timeoutMs);
    
    // 檢查緩存（僅對需要 API 調用的引擎）
    const cacheKey = `${ttsEngine}:${ttsRate}:${textToSpeak}`;
    if (['edgeTts', 'azureTts', 'bertVits2'].includes(ttsEngine)) {
      const cachedAudio = ttsCache.get(cacheKey);
      if (cachedAudio) {
        console.log('TTS cache hit:', textToSpeak);
        const audio = new Audio(cachedAudio);
        audio.ontimeupdate = () => {
          if (audio.duration && audio.currentTime >= audio.duration - 0.05) stopSpeakerAnimation();
        };
        audio.onended = stopSpeakerAnimation;
        audio.onerror = stopSpeakerAnimation;
        audio.play().catch(err => {
          console.warn('[Content] Cached TTS Playback failed:', err);
          stopSpeakerAnimation();
        });
        return;
      }
    }
    
    // 記錄待處理的文本（用於緩存回傳的音頻）
    pendingTtsText = cacheKey;
    
    try {
      if (ttsEngine === 'webSpeech') {
        speakWithWebSpeech(textToSpeak);
      } else if (ttsEngine === 'chromeTts') {
        speakWithChromeTts(textToSpeak);
      } else if (ttsEngine === 'edgeTts') {
        const baseUrl = edgeTtsMode === 'custom' ? edgeTtsUrl : EDGE_TTS_DEFAULT_URL;
        await speakWithEdgeTts(textToSpeak, baseUrl);
      } else if (ttsEngine === 'bertVits2') {
        await speakWithBertVits2(textToSpeak);
      } else if (ttsEngine === 'azureTts') {
        if (azureTtsMode === 'custom') {
          chrome.runtime.sendMessage({
            action: 'azureTtsSpeak',
            text: textToSpeak,
            azureKey: azureTtsKey,
            azureRegion: azureTtsRegion,
            azureVoice: azureTtsVoice,
            rate: ttsRate
          });
        } else {
          chrome.runtime.sendMessage({
            action: 'azureTtsProxySpeak',
            text: textToSpeak,
            azureVoice: azureTtsVoice,
            rate: ttsRate
          });
        }
      }
    } catch (error) {
      if (error && error.message && error.message.includes('Extension context invalidated')) {
        console.warn('[Jyutping Extension] Extension context invalidated. Please refresh the page.');
        stopSpeakerAnimation();
        return;
      }
      console.error('TTS error:', error);
      stopSpeakerAnimation();
      if (!window.hasShownTtsFallbackToast) {
        showToast('🔊 語音服務連線異常，已自動降級為系統本機發音。<br>請檢查網絡或刷新網頁。', 4000);
        window.hasShownTtsFallbackToast = true;
      }
      // 降級到 Web Speech
      speakWithWebSpeech(textToSpeak);
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
      currentMouseX = e.clientX;
      currentMouseY = e.clientY;

      if (!isEnabled || isSelecting) return;

      // 懶加載字典：用戶一旦在本 frame 移動滑鼠（表現出交互意圖）即開始載入。
      // loadDictionary() 內部有 promise 去重，重複調用為廉價空操作。
      // 載入約 ~400ms，遠快於用戶從移動滑鼠到停在某個詞上的時間，故首次悬停基本無感。
      loadDictionary();

      // 如果打開了 Q&A，保持 Q&A 窗口開啟，且不進行任何隱藏或查詞掃描
      if (popup && popup.querySelector('.popup-qa-container')) return;
      if (translatePopup && translatePopup.querySelector('.popup-qa-container')) return;

      // 如果用戶有手動選中的文本，不要觸發懸停查詞（防止覆蓋選區）
      if (hasUserSelection) {
        if (isMouseOverPopup) return;
        
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rects = range.getClientRects();
          let isOverSelection = false;
          // 給予 20px 緩衝區
          for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            if (e.clientX >= rect.left - 20 && e.clientX <= rect.right + 20 &&
                e.clientY >= rect.top - 20 && e.clientY <= rect.bottom + 20) {
              isOverSelection = true;
              break;
            }
          }
          if (!isOverSelection) {
            // 滑鼠離開了選區且不在彈窗上，隱藏彈窗，但不清除選區
            if (canAutoHide()) {
              hidePopup(true);
            }
          }
        }
        return;
      }

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
      if (!canAutoHide()) return;
      if (hasEditableFocus()) {
        if (popup) popup.style.display = 'none';
        return;
      }
      hidePopup();
    });

    // 點擊時的邏輯

    document.addEventListener('mousedown', (e) => {
      if (!isEnabled) return;

      // 只處理左鍵點擊，右鍵不觸發 TTS / AI 長按
      if (e.button !== 0) return;

      // 如果點擊在 Shadow DOM 宿主內（也就是點擊了懸浮窗），不隱藏
      // 使用 composedPath() 確保在 Shadow DOM 內部的點擊也能被正確攔截
      const path = e.composedPath ? e.composedPath() : [];
      if (path.some(el => el.id === 'jyutping-shadow-host' || el.id === 'cantonese-popup-dict' || el.id === 'cantonese-translate-popup')) {
        return;
      }

      // 如果用戶有手動選中的文本，檢查點擊是否在選區內
      if (hasUserSelection) {
        const selection = window.getSelection();
        const textToSpeak = selection.toString().trim();
        
        // 防止全選或不小心選中極大段文本導致無法取消選區，以及造成崩潰或瘋狂發音
        if (textToSpeak.length > 1000) return;
        
        if (selection.rangeCount > 0 && textToSpeak) {
          const range = selection.getRangeAt(0);
          const rects = range.getClientRects();
          let clickInSelection = false;
          const pad = 10; // 放寬 10px 容差處理 line-height
          for (const rect of rects) {
            if (e.clientX >= rect.left - pad && e.clientX <= rect.right + pad &&
                e.clientY >= rect.top - pad && e.clientY <= rect.bottom + pad) {
              clickInSelection = true;
              break;
            }
          }
          if (clickInSelection) {
            e.preventDefault();
            // 立即觸發 TTS
            const textToSpeak = selection.toString().trim();
            const rangeRect = getBestRectForRange(range);
            const btn = showSelectionSpeakerPopup(rangeRect, textToSpeak);
            speakCantonese(textToSpeak, btn);
            
            let wasSelectionLongPressTriggered = false;
            let isDragging = false;
            const startX = e.clientX;
            const startY = e.clientY;

            console.log('[AI-SelectionLongPress] isAiOn:', aiEnabled);
            if (aiEnabled) {
              if (aiLongPressTimer) {
                clearTimeout(aiLongPressTimer);
                cancelLongPressAnimation();
              }
              const selectedWord = selection.toString().trim();
              console.log('[AI-SelectionLongPress] Setting timers synchronously for word:', selectedWord);
              
              aiAnimationTimer = setTimeout(() => {
                startLongPressAnimation(e.clientX, e.clientY);
              }, 150);
              
              aiLongPressTimer = setTimeout(() => {
                aiLongPressTimer = null;
                if (!isDragging) {
                  wasSelectionLongPressTriggered = true;
                  console.log('[AI-SelectionLongPress] Triggered AI translation for:', selectedWord);
                  if (longPressRing) {
                    longPressRing.classList.add('done');
                    setTimeout(() => {
                      longPressRing.classList.remove('done');
                      longPressRing.classList.remove('active');
                    }, 300);
                  }
                  requestAiTranslation(selectedWord, rangeRect);
                } else {
                  cancelLongPressAnimation();
                }
              }, 650);
            }
            
            // 監聽拖拽：如果移動超過 20px，取消長按
            const onDragMove = (moveEvt) => {
              const dx = moveEvt.clientX - startX;
              const dy = moveEvt.clientY - startY;
              if (dx * dx + dy * dy > 400) { // 20px 閾值
                isDragging = true;
                if (aiLongPressTimer) {
                  clearTimeout(aiLongPressTimer);
                  aiLongPressTimer = null;
                  cancelLongPressAnimation();
                }
                document.removeEventListener('mousemove', onDragMove);
              }
            };
            document.addEventListener('mousemove', onDragMove);
            
            const onSelectionClickEnd = () => {
              document.removeEventListener('mousemove', onDragMove);
              if (wasSelectionLongPressTriggered) {
                ignoreNextRubyClick = true;
                setTimeout(() => { ignoreNextRubyClick = false; }, 100);
              }
              if (transTrigger === 'click' && !wasSelectionLongPressTriggered && !isDragging) {
                requestTranslation(textToSpeak);
              }
            };
            document.addEventListener('mouseup', onSelectionClickEnd, { once: true });
            
            return;
          }
        }
        // 點擊在選區外 → 清除選區
        hasUserSelection = false;
        window.getSelection().removeAllRanges();
        hideTranslatePopup();
        cancelLongPressAnimation();
      }

      // 檢查是否點擊在高亮區域內，或者全文注音的 ruby 區塊內
      let clickedHighlightSpan = e.target.closest && e.target.closest('.jyutping-highlight');
      let clickedRuby = e.target.closest && (e.target.closest('.jyutping-ruby-injected') || e.target.closest('.jyutping-hover-ruby'));
      
      let clickInHighlight = false;
      let wordToSpeak = null;

      if (clickedHighlightSpan) {
        clickInHighlight = true;
        wordToSpeak = currentWord;
      } else if (clickedRuby) {
        clickInHighlight = true;
        wordToSpeak = clickedRuby.dataset.word;
        // 如果是 ruby 區塊，我們同時更新 currentWord / currentRange 以便 Q&A 獲取 context
        if (wordToSpeak) {
          currentWord = wordToSpeak;
          try {
            currentRange = document.createRange();
            currentRange.selectNodeContents(clickedRuby);
          } catch (err) {}
        }
      } else if (currentWord && currentRange) {
        const rect = currentRange.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 &&
            e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          clickInHighlight = true;
          wordToSpeak = currentWord;
        }
      }

      // 如果點擊不在高亮區且不是 ruby，嘗試即時掃描滑鼠下方的文字以獲取單詞並高亮
      if (!clickInHighlight) {
        console.log('[AI-LongPress] Mousedown outside highlight. e.target:', e.target.tagName, e.target.className, 'popup is:', popup, 'popup.contains:', popup ? popup.contains(e.target) : 'null');
        const previousWord = currentWord;
        handleMouseOver(e);
        
        // 重新檢測（使用 elementFromPoint 獲取最新的 DOM 元素，因為 handleMouseOver 可能剛剛修改了 DOM）
        // 不能用 e.target 因為 e.target 還是點擊發生時的舊元素
        const newTarget = document.elementFromPoint(e.clientX, e.clientY);
        clickedHighlightSpan = newTarget && newTarget.closest && newTarget.closest('.jyutping-highlight');
        
        if (clickedHighlightSpan) {
          clickInHighlight = true;
          wordToSpeak = currentWord;
        } else if (currentWord && currentRange && currentWord !== previousWord) {
          // 如果 elementFromPoint 失敗（例如被遮擋），但 handleMouseOver 確實剛解析出了新詞
          // 只要剛好查出了新詞，就認為用戶點擊了這個詞。
          clickInHighlight = true;
          wordToSpeak = currentWord;
        } else if (currentWord && currentRange) {
          // 最後退路：使用 getBoundingClientRect，加上容差 (padding) 處理 line-height 點擊
          const rect = currentRange.getBoundingClientRect();
          const pad = 10;
          if (rect.width > 0 && rect.height > 0 &&
              e.clientX >= rect.left - pad && e.clientX <= rect.right + pad &&
              e.clientY >= rect.top - pad && e.clientY <= rect.bottom + pad) {
            clickInHighlight = true;
            wordToSpeak = currentWord;
          }
        }
      }

      if (clickInHighlight && wordToSpeak) {
        console.log('[AI-LongPress] Mousedown inside target word:', wordToSpeak);
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
        pendingTranslateWord = wordToSpeak;

        // 立即觸發 TTS
        speakCantonese(wordToSpeak);
        // 如果點擊的是 Ruby 元素，啟動 Ruby 發音狀態標記（音標變不透明）
        if (clickedRuby) {
          startRubySpeakingState(clickedRuby);
        }

        let wasWordLongPressTriggered = false;

        console.log('[AI-LongPress] isAiOn:', aiEnabled);
        
        let initialTargetRect = null;
        if (typeof currentRange !== 'undefined' && currentRange) {
          initialTargetRect = getBestRectForRange(currentRange);
        }

        if (aiEnabled) {
          if (aiLongPressTimer) {
            clearTimeout(aiLongPressTimer);
            cancelLongPressAnimation();
          }
          console.log('[AI-LongPress] Setting timers synchronously.');
          aiAnimationTimer = setTimeout(() => {
            console.log('[AI-LongPress] Starting animation');
            startLongPressAnimation(startX, startY);
          }, 150);
          aiLongPressTimer = setTimeout(() => {
            console.log('[AI-LongPress] Trigger timer fired! isDragging:', isDragging);
            aiLongPressTimer = null;
            if (!isDragging) {
              wasWordLongPressTriggered = true;
              console.log('[AI-LongPress] Triggering AI translation for:', wordToSpeak);
              
              if (longPressRing) {
                longPressRing.classList.add('done');
                setTimeout(() => {
                  longPressRing.classList.remove('done');
                  longPressRing.classList.remove('active');
                }, 300);
              }
              
              requestAiTranslation(wordToSpeak, initialTargetRect);
            } else {
              cancelLongPressAnimation();
            }
          }, 650);
        }

        // 監聽拖拽：如果移動超過 20px，切換到選擇模式（防止手指或滑鼠微抖誤判）
        const onDragMove = (moveEvt) => {
          const dx = moveEvt.clientX - startX;
          const dy = moveEvt.clientY - startY;
          const distSq = dx * dx + dy * dy;
          if (distSq > 400) { // 20px 閾值
            console.log('[AI-LongPress] Drag detected (distance > 20px):', Math.sqrt(distSq), 'cancelling long press');
            isDragging = true;
            isSelecting = true;
            currentWord = null;
            hidePopup();
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
          console.log('[AI-LongPress] Mouseup on target word. isDragging:', isDragging, 'wasWordLongPressTriggered:', wasWordLongPressTriggered);
          document.removeEventListener('mousemove', onDragMove);
          
          if (wasWordLongPressTriggered) {
            ignoreNextRubyClick = true;
            setTimeout(() => { ignoreNextRubyClick = false; }, 100);
          }
          
          // 如果不是拖拽且之前有選區，恢復它
          if (!isDragging && savedRange) {
            const s = window.getSelection();
            s.removeAllRanges();
            s.addRange(savedRange);
          }
          if (!isDragging && !wasWordLongPressTriggered && transTrigger === 'click' && pendingTranslateWord) {
            requestTranslation(pendingTranslateWord);
            pendingTranslateWord = null;
          }
        };
        document.addEventListener('mouseup', onDragEnd, { once: true });

        return;
      }

      // 既然在非高亮區域點擊，說明不是雙擊高亮詞，清除 pending 狀態
      pendingTranslateWord = null;

      isSelecting = true;
      currentWord = null;
      endExpandGrace(); // 點擊頁面其他地方時，解除展開寬限
      if (hasEditableFocus()) {
        if (popup) popup.style.display = 'none';
        return;
      }
      hidePopup();
      cancelLongPressAnimation();
    }, true);

    // 點擊注音區塊發音
    document.addEventListener('click', (e) => {
      if (!isEnabled) return;
      if (ignoreNextRubyClick) return;
      
      const ruby = e.target.closest('.jyutping-ruby-injected');
      if (ruby) {
        let word = ruby.dataset.word;
        if (word) {
          speakCantonese(word);
          startRubySpeakingState(ruby);
          ruby.classList.add('jyutping-clicked-hover');
        }
      }
    });

    // 雙擊 → 觸發翻譯或顯示完整懸浮窗
    document.addEventListener('dblclick', (e) => {
      if (!isEnabled) return;

      // 忽略來自於詞典浮窗或翻譯浮窗內部的雙擊
      // 使用 composedPath() 確保在 Shadow DOM 內部的雙擊也能被正確攔截
      const path = e.composedPath ? e.composedPath() : [];
      if (path.some(el => el.id === 'jyutping-shadow-host' || el.id === 'cantonese-popup-dict' || el.id === 'cantonese-translate-popup')) {
        return;
      }

      // 情況 0：雙擊注音區塊顯示完整懸浮窗
      const ruby = e.target.closest('.jyutping-ruby-injected');
      if (ruby) {
        e.preventDefault();
        window.getSelection().removeAllRanges();
        
        let word = ruby.dataset.word;
        
        if (word && dictionary && dictionary[word]) {
          currentWord = word;
          try {
            currentRange = document.createRange();
            currentRange.selectNodeContents(ruby);
          } catch (err) {}
          const bestRect = currentRange ? getBestRectForRange(currentRange) : null;
          showPopup({ word: word, entry: dictionary[word] }, bestRect || ruby.getBoundingClientRect(), true);
        }
        return;
      }

      // 情況 1：雙擊高亮詞
      if (pendingTranslateWord) {
        e.preventDefault();
        // 清除雙擊產生的原生選區，避免覆蓋原本的高亮背景色
        window.getSelection().removeAllRanges();
        if (transTrigger === 'dblclick') {
          requestTranslation(pendingTranslateWord);
        }
        pendingTranslateWord = null;
        return;
      }

      // 情況 2：雙擊用戶選區
      if (hasUserSelection) {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text) {
          e.preventDefault();
          if (transTrigger === 'dblclick') {
            requestTranslation(text);
          }
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
    }, true);

    // 滾動時隱藏彈窗
    document.addEventListener('scroll', () => {
      // 如果打開了 Q&A，不自動隱藏
      if (popup && popup.querySelector('.popup-qa-container')) return;
      if (translatePopup && translatePopup.querySelector('.popup-qa-container')) return;

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

    // 段落整段粵語翻譯：長按滑鼠左鍵觸發（當觸發鍵設為 longpress 時）
    document.addEventListener('mousedown', (e) => {
      if (!isEnabled || paragraphTransKey !== 'longpress') return;
      if (e.button !== 0) return;
      if (hasUserSelection) return; // 有選區時讓位給選區 TTS/AI 長按
      const path = e.composedPath ? e.composedPath() : [];
      if (path.some(el => el.id === 'jyutping-shadow-host' || el.id === 'cantonese-popup-dict' || el.id === 'cantonese-translate-popup')) return;

      const startX = e.clientX, startY = e.clientY;
      // 必須長按在可翻譯段落上才啟動
      if (!findTranslatableBlock(startX, startY)) return;

      let triggered = false;
      let animTimer = setTimeout(() => { startLongPressAnimation(startX, startY); }, 150);
      let pressTimer = setTimeout(() => {
        pressTimer = null;
        triggered = true;
        if (longPressRing) {
          longPressRing.classList.add('done');
          setTimeout(() => { longPressRing.classList.remove('done'); longPressRing.classList.remove('active'); }, 300);
        }
        translateBlockAtPoint(startX, startY);
      }, 600);

      const cleanup = () => {
        if (animTimer) { clearTimeout(animTimer); animTimer = null; }
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; cancelLongPressAnimation(); }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp, true);
      };
      const onMove = (mv) => {
        const dx = mv.clientX - startX, dy = mv.clientY - startY;
        if (dx * dx + dy * dy > 64) cleanup(); // 移動超過 8px 視為拖拽，取消
      };
      const onUp = () => {
        // 長按已觸發時，攔截隨後的 click，避免長按落在連結上時誤導航/選字
        if (triggered) {
          const onClick = (ce) => { ce.preventDefault(); ce.stopPropagation(); document.removeEventListener('click', onClick, true); };
          document.addEventListener('click', onClick, true);
          setTimeout(() => document.removeEventListener('click', onClick, true), 400);
        }
        cleanup();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp, true);
    }, true);

    // 監聽按鍵
    document.addEventListener('keydown', (e) => {
      console.log('[Debug] keydown triggered:', e.key);
      if (e.key === 'Escape') {
        hidePopup();
        hideTranslatePopup();
        hasUserSelection = false;
      }

      // 段落整段粵語翻譯：按下設定的觸發鍵即翻譯鼠標下的段落（再按一次移除）
      if (isEnabled && paragraphTransKey !== 'off' && paragraphTransKey !== 'longpress' && !e.repeat) {
        const paraKeyMap = { 'shift': 'Shift', 'alt': 'Alt', 'ctrl': 'Control', 'meta': 'Meta' };
        if (e.key === paraKeyMap[paragraphTransKey]) {
          translateBlockAtPoint(currentMouseX, currentMouseY);
        }
      }

      // 如果按下了設定的修飾鍵，立刻觸發懸停查詞
      const keyMap = { 'alt': 'Alt', 'ctrl': 'Control', 'shift': 'Shift', 'meta': 'Meta' };
      if (e.key === keyMap[hoverModifier] && currentMouseX !== 0 && currentMouseY !== 0) {
        console.log('[Debug] Trigger key pressed! Key:', e.key, 'mouseX:', currentMouseX, 'mouseY:', currentMouseY);
        // 模擬滑鼠移動觸發查詞，強制更新最後已知坐標以通過防抖
        lastX = currentMouseX;
        lastY = currentMouseY;
        handleMouseOver({ 
          clientX: currentMouseX, 
          clientY: currentMouseY,
          altKey: e.altKey || e.key === 'Alt',
          ctrlKey: e.ctrlKey || e.key === 'Control',
          shiftKey: e.shiftKey || e.key === 'Shift',
          metaKey: e.metaKey || e.key === 'Meta',
          isTriggerKey: true
        });
        // 完整模式下按修飾鍵觸發時，自動發音
        if (popupDisplayStyle === 'full' && ttsEnabled && currentWord && dictionary[currentWord]) {
          speakCantonese(dictionary[currentWord].traditional || currentWord);
        }
      }
    });


  }


  // 處理滑鼠懸停事件
  function handleMouseOver(e) {
    if (!isEnabled) return;
    
    // 優先且絕對地忽略彈窗內部的任何滑鼠移動，防止因為 DOM 刷新或 isMouseOverPopup 狀態延遲而導致彈窗異常消失
    const targetNode = e.target;
    if (targetNode && targetNode.closest && (targetNode.closest('#cantonese-popup-dict') || targetNode.closest('#cantonese-translate-popup'))) {
      return;
    }
    
    // 如果打開了 Q&A，則不處理懸停事件，保持 Q&A 窗口開啟
    if (!e.isTriggerKey && popup && popup.querySelector('.popup-qa-container')) return;
    if (!e.isTriggerKey && translatePopup && translatePopup.querySelector('.popup-qa-container')) return;

    // 如果正在顯示翻譯彈窗（如 AI 翻譯），為避免滑鼠移動到彈窗過程中導致高亮消失，
    // 暫停新的懸停事件，直到翻譯彈窗關閉
    if (!e.isTriggerKey && translatePopup && translatePopup.style.display !== 'none') {
      if (!isMouseOverPopup) {
        scheduleHidePopup();
      }
      return;
    }
    if (!e.isTriggerKey && isMouseOverPopup) return; // 滑鼠在彈窗上時不處理，保留高亮
    if (!e.isTriggerKey && isInExpandGrace()) return; // 展開寬限期內不重新渲染
    
    // 檢查修飾鍵是否按下（精簡模式不需要修飾鍵）
    const modifierPressed = popupDisplayStyle === 'compact' || hoverModifier === 'none' ||
      (hoverModifier === 'alt' && e.altKey) ||
      (hoverModifier === 'ctrl' && e.ctrlKey) ||
      (hoverModifier === 'shift' && e.shiftKey) ||
      (hoverModifier === 'meta' && e.metaKey);

    // 如果是用戶正在瀏覽的導航彈窗，且滑鼠不在彈窗上
    // 此時不應該讓移動滑鼠打斷導航，除非用戶再次進入
    // (這部分邏輯已在 setupEventListeners 中處理)

    const clientX = e.clientX;
    const clientY = e.clientY;

    // 如果是按下觸發鍵，我們需要穿透彈窗，因為舊彈窗可能正蓋在新詞上方
    let originalPointerEvents = '';
    let originalTranslatePointerEvents = '';
    if (e.isTriggerKey) {
      if (popup) {
        originalPointerEvents = popup.style.pointerEvents;
        popup.style.pointerEvents = 'none';
      }
      if (translatePopup) {
        originalTranslatePointerEvents = translatePopup.style.pointerEvents;
        translatePopup.style.pointerEvents = 'none';
      }
    }

    // ★ 檢查是否懸停在已高亮的文字上
    const targetElement = document.elementFromPoint(clientX, clientY);

    if (e.isTriggerKey) {
      if (popup) popup.style.pointerEvents = originalPointerEvents;
      if (translatePopup) translatePopup.style.pointerEvents = originalTranslatePointerEvents;
    }

    if (!e.isTriggerKey && targetElement && (targetElement.closest('#cantonese-popup-dict') || targetElement.closest('#cantonese-translate-popup'))) {
      return;
    }
    
    // 如果是已經被全文注音的區域，則顯示懸浮窗並高亮該 ruby 元素
    const rubyElement = targetElement && targetElement.closest('.jyutping-ruby-injected');
    if (rubyElement) {
      cancelScheduledHide();
      
      const word = rubyElement.dataset.word;
      if (word && dictionary[word]) {
        justNavigated = false;
        
        if (currentWord !== word || highlightedRubyElement !== rubyElement) {
          removeHighlight(); // 移除舊的高亮
          
          // 對於已經全文注音的 ruby，我們不需要加黃色高亮背景，保留其原生樣式即可。
          // rubyElement.classList.add('jyutping-highlight');
          // rubyElement.classList.add('hl-' + (highlightStyle || 'yellow'));
          highlightedRubyElement = rubyElement;
          
          currentWord = word;
          currentContextSentence = word;
          
          currentRange = document.createRange();
          currentRange.selectNodeContents(rubyElement);
        }
        
        const result = { word: word, entry: dictionary[word] };
        
        // 對於已經有注音的 ruby 元素，只有在「真正按下了修飾鍵」時才在懸停時顯示彈窗。
        // 避免在 hoverModifier 為 'none' 時，滑鼠一移動就彈出視窗（影響閱讀體驗），這部分應留給雙擊觸發。
        const actualModifierPressed = (hoverModifier === 'alt' && e.altKey) ||
                                      (hoverModifier === 'ctrl' && e.ctrlKey) ||
                                      (hoverModifier === 'shift' && e.shiftKey) ||
                                      (hoverModifier === 'meta' && e.metaKey);
        
        if (actualModifierPressed) {
          const bestRect = currentRange ? getBestRectForRange(currentRange) : null;
          console.log('[Debug] hover-ruby early block actualModifierPressed. bestRect:', bestRect);
          showPopup(result, bestRect || rubyElement.getBoundingClientRect());
        } else {
          scheduleHideIfMouseOutside();
        }
      } else {
        maybeScheduleHide();
      }
      return;
    }
    
    if (targetElement && (targetElement.classList.contains('jyutping-highlight') || targetElement.closest('.jyutping-hover-ruby'))) {
      if (!popup || popup.getAttribute('data-current-word') === currentWord) {
        cancelScheduledHide();
      }
      
      // 如果按下了修飾鍵，且彈窗目前隱藏或正在顯示其他詞，則直接顯示新彈窗（不需要重新解析文字）
      if (modifierPressed && popup && currentWord && dictionary[currentWord]) {
        console.log('[Debug] highlight early block modifierPressed=true. word:', currentWord);
        if (popup.style.display === 'none' || popup.getAttribute('data-current-word') !== currentWord) {
          const result = { word: currentWord, entry: dictionary[currentWord] };
          const bestRect = currentRange ? getBestRectForRange(currentRange) : null;
          console.log('[Debug] highlight early block calling showPopup. bestRect:', bestRect);
          showPopup(result, bestRect || (currentRange ? currentRange.getBoundingClientRect() : {
            left: clientX, right: clientX, top: clientY, bottom: clientY, width: 0, height: 0
          }));
        }
      }
      return;
    }

    // ★ 測試滑鼠是否在文字上
    if (e.isTriggerKey) {
      if (popup) popup.style.pointerEvents = 'none';
      if (translatePopup) translatePopup.style.pointerEvents = 'none';
    }
    let range = getCaretRangeFromPointInShadow(clientX, clientY);
    if (e.isTriggerKey) {
      if (popup) popup.style.pointerEvents = originalPointerEvents;
      if (translatePopup) translatePopup.style.pointerEvents = originalTranslatePointerEvents;
    }
    if (!range) {
      // 滑鼠在空白處
      maybeScheduleHide();
      return; // ★ 核心修復：在空白處移動時，保留舊的高亮，讓它跟隨彈窗生命週期
    }

    // 到這裡說明滑鼠在真正的文字上。移除舊高亮並清理 DOM。
    const previousWord = currentWord;
    if (highlightSpans.length > 0) {
      removeHighlight();
      // 由於 removeHighlight 調用了 normalize() 合併了文字節點，
      // 原來的 range.startContainer 可能已經失效，所以必須重新獲取一次
      if (e.isTriggerKey) {
        if (popup) popup.style.pointerEvents = 'none';
        if (translatePopup) translatePopup.style.pointerEvents = 'none';
      }
      range = getCaretRangeFromPointInShadow(clientX, clientY);
      if (e.isTriggerKey) {
        if (popup) popup.style.pointerEvents = originalPointerEvents;
        if (translatePopup) translatePopup.style.pointerEvents = originalTranslatePointerEvents;
      }
      if (!range) {
        maybeScheduleHide();
        return;
      }
    }

    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
      maybeScheduleHide();
      return;
    }

    // 使用精確定位找出最近的字符
    const offset = getAccurateOffset(textNode, clientX, clientY);
    if (offset === -1) {
      maybeScheduleHide();
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
      highlightText(textNode, offset, result);

      // 如果是同一個詞，且彈窗已顯示，不需要重建彈窗內容
      if (previousWord === result.word && popup.style.display !== 'none') {
        currentWord = result.word;
        // 如果有待執行的隱藏任務，取消它（因為用戶又回來了）
        cancelScheduledHide();
        return;
      }
      
      // 新詞，更新顯示
      currentWord = result.word;
      
      // 使用文字本身的位置來定位彈窗（而非滑鼠位置）
      if (currentRange) {
        const bestRect = getBestRectForRange(currentRange);
        
        if (modifierPressed || popupDisplayStyle === 'ruby' || popupDisplayStyle === 'compact') {
          showPopup(result, bestRect || currentRange.getBoundingClientRect());
        } else {
          scheduleHideIfMouseOutside();
        }
      } else {
        // 如果沒有選區（這應該不可能發生，除非 selection 失敗），使用滑鼠位置
        if (modifierPressed || popupDisplayStyle === 'ruby' || popupDisplayStyle === 'compact') {
          showPopup(result, {
            left: clientX, right: clientX, 
            top: clientY, bottom: clientY,
            width: 0, height: 0
          });
        } else {
          scheduleHideIfMouseOutside();
        }
      }
    } else {
      // 未匹配到詞
      currentWord = null;
      maybeScheduleHide();
    }
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


  // ========== 選區發音彈窗：僅顯示喇叭 ==========
  function showSelectionSpeakerPopup(rect, textToSpeak) {
    if (!popup) return null;

    const popupMain = popup.querySelector('.popup-main');
    const popupExamples = popup.querySelector('.popup-examples');
    const popupTranslate = popup.querySelector('.popup-translate');
    const actionsWrapper = popup.querySelector('.popup-actions-wrapper');
    const reportForm = popup.querySelector('.popup-report-form');

    // 重置/隱藏非必要元素
    if (popupExamples) popupExamples.style.display = 'none';
    if (popupTranslate) popupTranslate.style.display = 'none';
    if (actionsWrapper) actionsWrapper.style.display = 'none';
    if (reportForm) reportForm.style.display = 'none';
    popup.classList.remove('expanded-mode');
    
    // 隱藏翻譯浮窗
    hideTranslatePopup();

    applyCompactStyles();
    popup.classList.add('compact-mode');

    // 構建喇叭內容
    popupMain.innerHTML = `
      <div class="compact-pronunciation" style="padding: 2px 8px;">
        <button class="tts-speaker-btn speaking" title="播放發音" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; margin: 0; color: var(--popup-accent);">
          <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        </button>
      </div>
    `;

    const speakerBtn = popupMain.querySelector('.tts-speaker-btn');
    if (speakerBtn) {
      speakerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speakCantonese(textToSpeak, speakerBtn);
      });
    }

    // 定位
    if (rect) {
      popup.style.visibility = 'hidden';
      popup.style.display = 'block';
      
      const popupWidth = popup.offsetWidth || 44;
      const popupHeight = popup.offsetHeight || 36;
      const viewportWidth = window.innerWidth;
      const ARROW_HEIGHT = 8;
      const GAP = 2;

      let left = rect.left + rect.width / 2 - popupWidth / 2;
      if (left + popupWidth > viewportWidth - 5) left = viewportWidth - popupWidth - 5;
      if (left < 5) left = 5;

      let top = rect.top - popupHeight - GAP - ARROW_HEIGHT;
      let arrowDirection = 'down';

      if (top < 5) {
        top = rect.bottom + GAP + ARROW_HEIGHT;
        arrowDirection = 'up';
      }

      popup.style.position = 'absolute';
      popup.style.left = (left + window.scrollX) + 'px';
      popup.style.top = (top + window.scrollY) + 'px';

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

    return speakerBtn;
  }

  // 套用精簡模式/選區喇叭的自適應寬度樣式，防止被完整模式的行內或 CSS 樣式干擾
  function applyCompactStyles() {
    if (!popup) return;
    popup.style.setProperty('width', 'max-content', 'important');
    popup.style.setProperty('min-width', 'unset', 'important');
    popup.style.setProperty('max-width', '320px', 'important');

    const inner = popup.querySelector('.popup-inner');
    if (inner) {
      inner.style.setProperty('width', 'auto', 'important');
      inner.style.setProperty('min-width', 'unset', 'important');
      inner.style.setProperty('height', 'auto', 'important');
    }

    const container = popup.querySelector('.popup-container');
    if (container) {
      container.style.setProperty('width', 'auto', 'important');
    }

    const popupMain = popup.querySelector('.popup-main');
    if (popupMain) {
      popupMain.style.setProperty('width', 'auto', 'important');
      popupMain.style.setProperty('min-width', 'unset', 'important');
      popupMain.style.setProperty('padding', '2px 8px', 'important');
    }
  }

  // 清除精簡模式和 Ruby 浮動標籤模式的行內樣式，恢復完整模式
  function removeCompactStyles() {
    if (!popup) return;
    popup.style.removeProperty('width');
    popup.style.removeProperty('min-width');
    popup.style.removeProperty('max-width');
    popup.style.removeProperty('background');
    popup.style.removeProperty('box-shadow');
    popup.style.removeProperty('border');
    popup.style.removeProperty('padding');
    popup.style.removeProperty('margin');
    popup.style.removeProperty('pointer-events');

    // 清除 popup-ruby-mode 相關類名
    popup.classList.remove('popup-ruby-mode');
    popup.classList.remove('with-bg');
    popup.classList.remove('fade-bg');
    popup.classList.remove('dark-bg');
    const classesToRemove = [];
    popup.classList.forEach(cls => {
      if (cls.startsWith('hl-ruby-')) {
        classesToRemove.push(cls);
      }
    });
    classesToRemove.forEach(cls => popup.classList.remove(cls));

    const inner = popup.querySelector('.popup-inner');
    if (inner) {
      inner.style.removeProperty('width');
      inner.style.removeProperty('min-width');
      inner.style.removeProperty('height');
      inner.style.removeProperty('background');
      inner.style.removeProperty('border');
      inner.style.removeProperty('box-shadow');
      inner.style.removeProperty('padding');
      inner.style.removeProperty('margin');
    }

    const container = popup.querySelector('.popup-container');
    if (container) {
      container.style.removeProperty('width');
      container.style.removeProperty('padding');
      container.style.removeProperty('margin');
      container.style.removeProperty('background');
    }

    const popupMain = popup.querySelector('.popup-main');
    if (popupMain) {
      popupMain.style.removeProperty('width');
      popupMain.style.removeProperty('min-width');
      popupMain.style.removeProperty('padding');
      popupMain.style.removeProperty('margin');
      popupMain.style.removeProperty('background');
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
    // 隱藏上一次的獨立翻譯浮窗（避免殘留）
    hideTranslatePopup();

    // 套用精簡模式自適應寬度樣式
    applyCompactStyles();
    popup.classList.add('compact-mode');

    // 構建精簡內容：僅拼音文字（點擊可發聲）
    popupMain.innerHTML = `
      <div class="compact-pronunciation">
        <span class="compact-text">${pronunciation}</span>
      </div>
    `;

    // 如果開啟了展開按鈕，添加到精簡彈窗中
    if (compactExpandBtn) {
      const expandBtn = document.createElement('span');
      expandBtn.className = 'compact-expand-btn';
      
      let iconUrl = '';
      try {
        iconUrl = chrome.runtime.getURL('icon_favicon.svg');
      } catch (e) {
        console.warn('[Content] Failed to get URL, extension might be reloaded.', e);
        // Fallback or empty URL
      }
      
      expandBtn.innerHTML = `<img src="${iconUrl}" style="width: 14px; height: 14px; filter: grayscale(100%); transition: filter 0.15s ease; vertical-align: middle; display: block; pointer-events: none;" />`;
      expandBtn.title = 'Show full dictionary';
      
      // 使用 mousedown 替代 click，防止鼠標微抖導致 click 事件無法觸發（小圖標常見問題）
      expandBtn.addEventListener('mousedown', (e) => {
        // 只處理左鍵點擊
        if (e.button !== 0) return;
        
        e.stopPropagation();
        e.preventDefault();
        
        // 展開後進入寬限期，防止滑鼠尚未落定到新彈窗上就被誤判隱藏
        beginExpandGrace();
        // 以完整模式重新渲染 (使用 forceFull = true 參數)
        showPopup(result, rect, true);
      });
      const compactPron = popupMain.querySelector('.compact-pronunciation');
      if (compactPron) compactPron.appendChild(expandBtn);
    }

    // 綁定 TTS（點擊拼音文字即可播放）
    const compactText = popupMain.querySelector('.compact-text');
    if (compactText) {
      compactText.style.cursor = 'pointer';
      // 必須使用 mousedown 才能保證手抖時 100% 觸發（因為小目標極易發生 1px 拖拽導致 click 丟失）
      // 注意：絕不能加 e.preventDefault()，否則會被瀏覽器 Autoplay Policy 攔截導致 NotAllowedError
      compactText.addEventListener('pointerup', (e) => {
        if (e.button !== 0) return;
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

      popup.style.position = 'absolute';
      popup.style.left = (left + window.scrollX) + 'px';
      popup.style.top = (top + window.scrollY) + 'px';

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

  // 套用 Hover Ruby 特有樣式，使其像原本 rt 般輕量，且不接受事件
  function applyRubyStyles() {
    if (!popup) return;
    popup.style.setProperty('width', 'max-content', 'important');
    popup.style.setProperty('min-width', 'unset', 'important');
    popup.style.setProperty('max-width', '320px', 'important');
    popup.style.setProperty('background', 'transparent', 'important');
    popup.style.setProperty('box-shadow', 'none', 'important');
    popup.style.setProperty('border', 'none', 'important');
    popup.style.setProperty('padding', '0', 'important');
    popup.style.setProperty('margin', '0', 'important');

    const inner = popup.querySelector('.popup-inner');
    if (inner) {
      inner.style.setProperty('width', 'auto', 'important');
      inner.style.setProperty('min-width', 'unset', 'important');
      inner.style.setProperty('height', 'auto', 'important');
      inner.style.setProperty('background', 'transparent', 'important');
      inner.style.setProperty('border', 'none', 'important');
      inner.style.setProperty('box-shadow', 'none', 'important');
      inner.style.setProperty('padding', '0', 'important');
      inner.style.setProperty('margin', '0', 'important');
    }

    const container = popup.querySelector('.popup-container');
    if (container) {
      container.style.setProperty('width', 'auto', 'important');
      container.style.setProperty('padding', '0', 'important');
      container.style.setProperty('margin', '0', 'important');
      container.style.setProperty('background', 'transparent', 'important');
    }

    const popupMain = popup.querySelector('.popup-main');
    if (popupMain) {
      popupMain.style.setProperty('width', 'auto', 'important');
      popupMain.style.setProperty('min-width', 'unset', 'important');
      popupMain.style.setProperty('padding', '0', 'important');
      popupMain.style.setProperty('margin', '0', 'important');
      popupMain.style.setProperty('background', 'transparent', 'important');
    }
  }

  // ========== 內嵌 Ruby 模式的浮動標籤（防止被 overflow 裁剪） ==========
  function showRubyFloatingPopup(result, entry, pronunciation, rect) {
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
    popup.classList.remove('compact-mode');
    hideTranslatePopup();

    // 套用 Hover Ruby 特有樣式
    applyRubyStyles();
    popup.classList.add('popup-ruby-mode');

    popup.classList.remove('with-bg', 'fade-bg');
    if (rubyRtBackground === 'solid') {
      popup.classList.add('with-bg');
    } else if (rubyRtBackground === 'fade') {
      popup.classList.add('fade-bg');
    }

    // 判斷是否在暗色背景，並獲取實際背景顏色
    let isDark = false;
    let bgColor = 'rgba(255, 255, 255, 0.9)'; // 預設淺色背景
    if (currentRange && currentRange.startContainer) {
      const parent = currentRange.startContainer.nodeType === Node.TEXT_NODE 
        ? currentRange.startContainer.parentElement 
        : currentRange.startContainer;
      
      const detectedColor = getElementBackgroundColor(parent);
      if (detectedColor) {
        bgColor = detectedColor;
      }
      isDark = isElementOnDarkBackground(parent);
    }
    
    if (isDark) {
      popup.classList.add('dark-bg');
    } else {
      popup.classList.remove('dark-bg');
    }

    // 設置主題懸停色 CSS 變量
    const hoverColorClass = 'hl-ruby-' + (rubyHoverStyle || 'ruby-red');
    
    // 清除舊的顏色類，添加新的
    const classesToRemove = [];
    popup.classList.forEach(cls => {
      if (cls.startsWith('hl-ruby-')) {
        classesToRemove.push(cls);
      }
    });
    classesToRemove.forEach(cls => popup.classList.remove(cls));
    popup.classList.add(hoverColorClass);

    // 為了安全，也可以在 popup 上直接寫 CSS 變量
    let hoverColorVal = '#8A1C1C';
    if (isDark) {
      hoverColorVal = '#FFD54F';
    } else {
      switch (rubyHoverStyle) {
        case 'ruby-red': hoverColorVal = '#8A1C1C'; break;
        case 'ruby-blue': hoverColorVal = '#1565C0'; break;
        case 'ruby-green': hoverColorVal = '#2E7D32'; break;
        case 'ruby-orange': hoverColorVal = '#E65100'; break;
        case 'ruby-purple': hoverColorVal = '#6A1B9A'; break;
      }
    }
    popup.style.setProperty('--ruby-hover-color', hoverColorVal, 'important');

    // 構建拼音內容
    popupMain.innerHTML = `
      <span class="ruby-floating-text" style="cursor: pointer;">${pronunciation}</span>
    `;

    // 綁定發音事件
    const rubyText = popupMain.querySelector('.ruby-floating-text');
    if (rubyText) {
      rubyText.addEventListener('pointerup', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        speakCantonese(entry.traditional);
        
        rubyText.style.opacity = '0.5';
        setTimeout(() => rubyText.style.opacity = '1', 200);
      });
    }

    // 設置 pointer-events = auto 以允許點擊
    popup.style.pointerEvents = 'auto';

    // 定位
    if (rect) {
      popup.style.visibility = 'hidden';
      popup.style.display = 'block';

      const popupWidth = popup.offsetWidth || 60;
      const popupHeight = popup.offsetHeight || 16;
      const viewportWidth = window.innerWidth;

      // 水平居中
      let left = rect.left + rect.width / 2 - popupWidth / 2;
      left = Math.max(5, Math.min(left, viewportWidth - popupWidth - 5));

      // 垂直定位：
      // 原版 <rt> 使用 CSS：bottom: 100%; transform: translate(-50%, -0.2em)
      // 等效於：注音底部位於字頂端上方 0.2em（約 3px）處
      // 有背景時稍微再高一點，留出背景框的 padding 空間
      const floatingText = popupMain.querySelector('.ruby-floating-text');
      const textHeight = floatingText ? floatingText.offsetHeight : popupHeight;
      let top;
      if (rubyRtBackground === 'solid') {
        // 有實色背景框：整體在字頂端上方，留空間給 padding/border
        top = rect.top - textHeight - 4;
      } else {
        // 無背景 / 消散背景：緊貼字頂端上方
        top = rect.top - textHeight - 5;
      }

      if (top < 2) {
        // 上方空間不足，放到下方
        top = rect.bottom + (rubyRtBackground === 'solid' ? 2 : 1);
      }

      popup.style.position = 'absolute';
      popup.style.left = (left + window.scrollX) + 'px';
      popup.style.top = (top + window.scrollY) + 'px';

      if (popupArrow) popupArrow.className = 'popup-arrow popup-arrow-hidden';
      popup.style.visibility = 'visible';

      // 消散模式：在主 DOM 中創建/更新隱形遮罩，用 backdrop-filter 擦除頁面文字
      if (rubyRtBackground === 'fade') {
        showRubyFadeMask(left + window.scrollX, top + window.scrollY, popupWidth, textHeight, bgColor);
      } else {
        hideRubyFadeMask();
      }
    } else {
      popup.style.display = 'block';
      if (popupArrow) popupArrow.className = 'popup-arrow popup-arrow-hidden';
    }
  }

  // 消散模式遮罩：在主 DOM 中創建 div，背景色與原網頁背景一致，邊緣羽化
  function showRubyFadeMask(x, y, w, h, bgColor) {
    if (!rubyFadeMask) {
      rubyFadeMask = document.createElement('div');
      rubyFadeMask.id = 'jyutping-ruby-fade-mask';
      document.body.appendChild(rubyFadeMask);
    }
    
    const padX = 8;
    const padTop = 0;
    const padBottom = 2;
    const maskW = w + padX * 2;
    const maskH = h + padTop + padBottom;
    
    // 提取純淨顏色，不加透明度，以確保中間區域能完全遮擋文字
    let solidBgColor = bgColor;
    if (bgColor.startsWith('rgba')) {
      // 嘗試把 rgba 轉成 rgb，簡單粗暴去透明度
      solidBgColor = bgColor.replace(/rgba\((.*?),\s*[\d.]+\)/, 'rgb($1)');
    }
    
    rubyFadeMask.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 2147483644;
      background-color: ${solidBgColor};
      border: none;
      left: ${x - padX}px;
      top: ${y - padTop + 4}px;
      width: ${maskW}px;
      height: ${maskH}px;
      -webkit-mask-image:
        linear-gradient(to right, transparent, black ${padX}px, black calc(100% - ${padX}px), transparent),
        linear-gradient(to bottom, transparent, black ${padTop}px, black calc(100% - ${padBottom}px), transparent);
      -webkit-mask-composite: destination-in;
      mask-image:
        linear-gradient(to right, transparent, black ${padX}px, black calc(100% - ${padX}px), transparent),
        linear-gradient(to bottom, transparent, black ${padTop}px, black calc(100% - ${padBottom}px), transparent);
      mask-composite: intersect;
      display: block;
    `;
  }

  function hideRubyFadeMask() {
    if (rubyFadeMask) {
      rubyFadeMask.style.display = 'none';
    }
  }

  async function requestYueDefTranslation(text, targetLang, engine) {
    // 1. 優先嘗試發送給後台 Service Worker（帶 4 秒超時保障）
    try {
      const bgPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Background timeout')), 4000);
        chrome.runtime.sendMessage({
          action: 'translateYueDef',
          text: text,
          targetLang: targetLang,
          engine: engine
        }, (resp) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(resp);
          }
        });
      });
      const bgResp = await bgPromise;
      if (bgResp && bgResp.success && bgResp.translation) {
        return bgResp.translation;
      }
    } catch (bgErr) {
      console.warn('[Popup] Background translation failed/timed out, trying direct client fetch:', bgErr);
    }

    // 2. 前端直連 Google GTX 免費翻譯通道
    try {
      let googleTo = 'zh-CN';
      if (targetLang === 'en') googleTo = 'en';
      else if (targetLang === 'ja') googleTo = 'ja';
      else if (targetLang === 'ko') googleTo = 'ko';
      else if (targetLang === 'zh-Hant' || targetLang === 'zh-TW' || targetLang === 'zh-HK') googleTo = 'zh-TW';

      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${googleTo}&dt=t&q=${encodeURIComponent(text)}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data[0] && Array.isArray(data[0])) {
          const directRes = data[0].map(item => item[0]).filter(Boolean).join('');
          if (directRes) return directRes;
        }
      }
    } catch (directErr) {
      console.warn('[Popup] Direct Google GTX failed:', directErr);
    }

    // 3. 前端直連 MyMemory 免費翻譯通道
    try {
      let target = targetLang || 'zh-CN';
      if (target === 'zh-Hans') target = 'zh-CN';
      else if (target === 'zh-Hant' || target === 'zh-HK') target = 'zh-TW';
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-HK|${target}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.responseData && data.responseData.translatedText) return data.responseData.translatedText;
      }
    } catch (myMemErr) {
      console.warn('[Popup] Direct MyMemory failed:', myMemErr);
    }

    throw new Error('All translation channels failed');
  }

  // 獲取翻譯目標語言對應的標籤文字（如：普、書、英、日、韓）
  function getTargetLangLabel(targetLang) {
    switch (targetLang) {
      case 'zh-Hans':
      case 'zh-CN':
        return '普';
      case 'zh-Hant':
      case 'zh-TW':
      case 'zh-HK':
        return '書';
      case 'en':
        return '英';
      case 'ja':
        return '日';
      case 'ko':
        return '韓';
      default:
        return '譯';
    }
  }

  // 粵語釋義點擊即翻 / 自動翻譯處理函數
  async function translateBadgeElement(badgeEl, defItemEl) {
    const text = badgeEl.dataset.text;
    if (!text) return;

    const targetLang = autoTranslateYueDefsTargetLang || 'zh-Hans';
    const engine = autoTranslateYueDefsEngine || 'google';
    const mode = yueDefDisplayMode || 'expand';
    const cacheKey = `${engine}_${targetLang}_${text}`;
    const cached = yueDefTranslationCache.get(cacheKey);
    const langLabel = getTargetLangLabel(targetLang);

    const yueIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
    const toggleIconSvg = `<svg class="trans-toggle-icon" viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>`;

    if (mode === 'replace') {
      // Mode B: 原位替換
      const textSpan = defItemEl.querySelector('.def-content-text');
      if (!textSpan) return;

      // 如果目前已經是替換後的譯文狀態，再次點擊則切換回粵語原文
      if (defItemEl.dataset.isReplaced === 'true') {
        defItemEl.dataset.isReplaced = 'false';
        badgeEl.className = 'badge-yue';
        badgeEl.innerHTML = `粵${yueIconSvg}`;
        badgeEl.title = chrome.i18n.getMessage('badgeClickToTranslate') || '點擊翻譯此釋義';
        textSpan.textContent = text;
        return;
      }

      // 切換為譯文狀態
      if (cached) {
        defItemEl.dataset.isReplaced = 'true';
        badgeEl.className = 'badge-trans-lang badge-clickable';
        badgeEl.innerHTML = `${langLabel}${toggleIconSvg}`;
        badgeEl.title = chrome.i18n.getMessage('badgeClickToRestore') || '點擊切換回粵語原文';
        textSpan.textContent = cached;
        return;
      }

      // 異步請求翻譯
      const originalBadgeHtml = badgeEl.innerHTML;
      const originalBadgeClass = badgeEl.className;
      badgeEl.classList.add('loading');
      textSpan.textContent = chrome.i18n.getMessage('badgeTranslating') || '翻譯中...';

      try {
        const translation = await requestYueDefTranslation(text, targetLang, engine);
        badgeEl.classList.remove('loading');
        if (translation) {
          yueDefTranslationCache.set(cacheKey, translation);
          defItemEl.dataset.isReplaced = 'true';
          badgeEl.className = 'badge-trans-lang badge-clickable';
          badgeEl.innerHTML = `${langLabel}${toggleIconSvg}`;
          badgeEl.title = chrome.i18n.getMessage('badgeClickToRestore') || '點擊切換回粵語原文';
          textSpan.textContent = translation;
        } else {
          badgeEl.className = originalBadgeClass;
          badgeEl.innerHTML = originalBadgeHtml;
          textSpan.textContent = text;
        }
      } catch (e) {
        badgeEl.classList.remove('loading');
        badgeEl.className = originalBadgeClass;
        badgeEl.innerHTML = originalBadgeHtml;
        textSpan.textContent = text;
      }
    } else {
      // Mode A: 下方展開
      let transEl = defItemEl.querySelector('.yue-def-translation');
      if (transEl) {
        // 切換顯示/隱藏
        transEl.style.display = (transEl.style.display === 'none') ? 'flex' : 'none';
        return;
      }

      const langBadgeHtml = `<span class="badge-trans-lang">${langLabel}</span>`;

      transEl = document.createElement('div');
      transEl.className = 'yue-def-translation';
      transEl.addEventListener('click', (e) => e.stopPropagation());
      defItemEl.appendChild(transEl);

      if (cached) {
        transEl.innerHTML = `${langBadgeHtml}<span>${cached}</span>`;
        return;
      }

      const translatingText = chrome.i18n.getMessage('badgeTranslating') || '翻譯中...';
      transEl.classList.add('loading');
      transEl.innerHTML = `${langBadgeHtml}<span>${translatingText}</span>`;

      try {
        const translation = await requestYueDefTranslation(text, targetLang, engine);
        transEl.classList.remove('loading');
        if (translation) {
          yueDefTranslationCache.set(cacheKey, translation);
          transEl.innerHTML = `${langBadgeHtml}<span>${translation}</span>`;
        } else {
          transEl.innerHTML = `${langBadgeHtml}<span style="color: var(--popup-text-muted); opacity: 0.7;">${chrome.i18n.getMessage('badgeTranslationError') || '翻譯失敗'}</span>`;
        }
      } catch (e) {
        transEl.classList.remove('loading');
        transEl.innerHTML = `${langBadgeHtml}<span style="color: var(--popup-text-muted); opacity: 0.7;">${chrome.i18n.getMessage('badgeTranslationError') || '翻譯失敗'}</span>`;
      }
    }
  }

  // 顯示彈窗
  // rect: { left, right, top, bottom, width, height }
  function showPopup(result, rect, forceFull = false) {
    console.log('[Debug] showPopup called. word:', result.word, 'rect:', rect, 'forceFull:', forceFull);
    cancelScheduledHide();
    lastPopupShowTime = Date.now();
    
    if (activePopupRubyElement) {
      activePopupRubyElement.classList.remove('jyutping-popup-active');
      activePopupRubyElement = null;
    }
    if (currentRange && currentRange.commonAncestorContainer) {
      const container = currentRange.commonAncestorContainer;
      const ruby = container.nodeType === Node.TEXT_NODE ? container.parentElement.closest('ruby') : (container.closest ? container.closest('ruby') : null);
      if (ruby) {
        activePopupRubyElement = ruby;
        activePopupRubyElement.classList.add('jyutping-popup-active');
      }
    }

    const entry = result.entry;
    if (popup) popup.setAttribute('data-current-word', result.word);

    // 隱藏翻譯浮窗，避免雙彈窗
    hideTranslatePopup();
    
    // 儲存最後一次的彈窗數據與位置（供展開/Q&A使用）
    lastPopupResult = result;
    if (rect) lastPopupRect = rect;
    
    // 更新 Q&A 內容緩存
    activeQAContext.word = result.word || (result.entry ? result.entry.traditional : '');
    activeQAContext.sentence = getSurroundingSentence(currentRange) || '';
    activeQAContext.originalTranslation = (result.entry && result.entry.english) ? result.entry.english.join('; ') : '';
    activeQAContext.history = []; // 重置對話歷史
    
    // 選擇顯示的拼音格式
    let pronunciation = displayMode === 'yale' 
      ? (entry.yale || entry.jyutping)
      : entry.jyutping;

    if (pronunciation && toneStyle === 'superscript' && popupDisplayStyle === 'compact' && !forceFull) {
      pronunciation = pronunciation.replace(/(\d+)/g, '<sup class="jyutping-tone">$1</sup>');
    }

    if (pronunciation && toneStyle === 'superscript' && popupDisplayStyle === 'ruby' && !forceFull) {
      pronunciation = convertToSuperscriptTone(pronunciation);
    }

    // ========== 內嵌 Ruby 模式的浮動標籤（防止被 overflow 裁剪） ==========
    if (popupDisplayStyle === 'ruby' && !forceFull) {
      showRubyFloatingPopup(result, entry, pronunciation, rect);
      return;
    }

    // ========== 精簡模式：僅顯示音標 ==========
    if (popupDisplayStyle === 'compact' && !forceFull) {
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
    removeCompactStyles();
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
      const badgeTitle = chrome.i18n.getMessage('badgeClickToTranslate') || '點擊翻譯此釋義';
      const defItems = entry.english.slice(0, 5).map((def, index) => {
        let className = 'def-item';
        let hasExamples = false;
        
        if (entry.examples && entry.examples[index] && entry.examples[index].length > 0) {
          className += ' has-examples';
          hasExamples = true;
        }

        let innerHtml = '';
        if (def.startsWith('[粵]')) {
          className += ' def-yue';
          const rawText = def.slice(3).trim();
          innerHtml = `<span class="badge-yue" data-text="${rawText.replace(/"/g, '&quot;')}" title="${badgeTitle}" role="button">粵<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></span><span class="def-content-text">${rawText}</span>`;
        } else {
          innerHtml = `<span class="def-content-text">${def}</span>`;
        }
        
        const arrowHtml = hasExamples ? '<span class="example-arrow-icon"> ▷</span>' : '';
        return `<div class="${className}" ${hasExamples ? `data-example-index="${index}"` : ''}><div class="def-main-row">${innerHtml}${arrowHtml}</div></div>`;
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

    // 異步檢查當前詞是否已收藏，更新書籤按鈕狀態
    isWordSaved(result.word).then(saved => {
      updateBookmarkBtnState(saved);
    });

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

    popupMain.querySelectorAll('.badge-yue').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止冒泡觸發父層例句展開
        const defItem = badge.closest('.def-item');
        if (defItem) {
          translateBadgeElement(badge, defItem);
        }
      });
    });

    // 若開啟了自動翻譯粵語口語釋義，自動並行翻譯
    if (enableAutoTranslateYueDefs) {
      popupMain.querySelectorAll('.badge-yue').forEach(badge => {
        const defItem = badge.closest('.def-item');
        if (defItem) {
          translateBadgeElement(badge, defItem);
        }
      });
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
      
      const ARROW_HEIGHT = 8; // 箭頭高度
      const GAP = 2; // 箭頭與文字的間距

      // 水平位置：居中對齊高亮詞
      const highlightCenterX = rect.left + rect.width / 2;
      left = highlightCenterX - popupWidth / 2;

      // 邊界檢查
      if (left + popupWidth > viewportWidth - 5) {
        left = viewportWidth - popupWidth - 5;
      }
      if (left < 5) {
        left = 5;
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
      
      popup.style.position = 'absolute';
      popup.style.left = (left + window.scrollX) + 'px';
      popup.style.top = (top + window.scrollY) + 'px';
      
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
    const loadingText = paragraphTransEngine === 'bing' ? '使用 Bing 翻譯中…' : '使用 AI 翻譯中…';
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


  // ── 彈窗隱藏生命週期助手（單一數據源，避免散落的標誌操作造成連帶 bug）──

  // 取消任何待執行的隱藏計時器
  function cancelScheduledHide() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  }

  // 展開彈窗後的寬限期：防止剛展開、滑鼠尚未落定到新彈窗上時被誤判隱藏或重繪。
  // 用單一時間戳取代過去的 expandLockTimer + waitingForMouseToEnterAfterExpand 兩個互相牽制的標誌。
  function beginExpandGrace() {
    expandGraceUntil = performance.now() + EXPAND_GRACE_MS;
  }
  function endExpandGrace() {
    expandGraceUntil = 0;
  }
  function isInExpandGrace() {
    return performance.now() < expandGraceUntil;
  }

  // 是否允許自動隱藏彈窗（展開寬限期內、或正在問答時不隱藏）
  function canAutoHide() {
    if (isInExpandGrace()) return false; // 展開寬限期內不隱藏
    if (popup && popup.querySelector('.popup-qa-container')) return false; // 主彈窗問答開啟
    if (translatePopup && translatePopup.querySelector('.popup-qa-container')) return false; // 翻譯浮窗問答開啟
    if (popup && popup.classList.contains('jyutping-popup-pinned')) return false; // AI 翻譯中
    if (translatePopup && translatePopup.classList.contains('jyutping-popup-pinned')) return false; // AI 翻譯中
    return true;
  }

  // 僅在非「剛導航」狀態下安排隱藏（導航後保持彈窗）
  function maybeScheduleHide() {
    if (!justNavigated) scheduleHidePopup();
  }

  // 彈窗可見且滑鼠不在其上時才安排隱藏
  function scheduleHideIfMouseOutside() {
    if (popup && popup.style.display !== 'none' && !isMouseOverPopup) {
      scheduleHidePopup();
    }
  }

  // 延遲隱藏（給用戶時間移動到彈窗上，數值越小消失越快）
  function scheduleHidePopup(delay = 150) {
    cancelScheduledHide();
    if (!canAutoHide()) return; // 展開寬限期內、或問答開啟時不自動隱藏

    let actualDelay = delay;
    if (translatePopup && translatePopup.style.display !== 'none') {
      actualDelay = Math.max(actualDelay, 300);
    }

    hideTimeout = setTimeout(() => {
      // 只有在滑鼠移出且不是粘滯的情況下隱藏
      // 現在主要依賴點擊隱藏，但離開彈窗也會隱藏
      if (!isMouseOverPopup) {
        hidePopup();
      }
      hideTimeout = null;
    }, actualDelay); 
  }

  // 隱藏彈窗
  function hidePopup(keepHighlight = false) {
    if (activePopupRubyElement) {
      activePopupRubyElement.classList.remove('jyutping-popup-active');
      activePopupRubyElement = null;
    }

    if (popup) {
      popup.classList.remove('jyutping-popup-pinned');
      popup.style.display = 'none';
      hideRubyFadeMask();
      removeCompactStyles();
      const qaContainer = popup.querySelector('.popup-qa-container');
      if (qaContainer) {
        qaContainer.remove();
      }
      const qaUpperDisplay = popup.querySelector('.qa-upper-display');
      if (qaUpperDisplay) {
        qaUpperDisplay.remove();
      }
      const inner = popup.querySelector('.popup-inner');
      if (inner) {
        Array.from(inner.children).forEach(child => {
          if (child.className !== 'popup-qa-container' && child.className !== 'qa-upper-display') {
            child.style.display = '';
          }
        });
      }
    }
    // 精簡模式下翻譯結果用獨立浮窗，一併隱藏
    hideTranslatePopup();
    
    // 如果是用戶手動選中的文本，或者要求保留高亮，則不清除選區
    if (!hasUserSelection && !keepHighlight) {
      currentWord = null;
      removeHighlight();
    }
    clearQAContext();
  }

  // 選中文字（使用 CSS 高亮 span 或內嵌 Ruby 代替原生 Selection）
  function highlightText(textNode, offset, result) {
    try {
      // 先移除舊的高亮
      removeHighlight();
      
      const length = result.length;
      const end = Math.min(offset + length, textNode.textContent.length);
      const originalText = textNode.textContent.substring(offset, end);
      
      // 創建 Range 用於定位彈窗
      const range = document.createRange();
      range.setStart(textNode, offset);
      range.setEnd(textNode, end);
      
      let wrapper;
      
      if (popupDisplayStyle === 'ruby') {
        // 內嵌 Ruby 模式
        wrapper = document.createElement('ruby');
        wrapper.className = 'jyutping-hover-ruby hl-' + (rubyHoverStyle || 'ruby-red');
        console.log('[Jyutping] Creating hover ruby. rubyRtBackground:', rubyRtBackground, 'rubyHoverStyle:', rubyHoverStyle);
        if (rubyRtBackground === 'solid') {
          wrapper.classList.add('with-bg');
        } else if (rubyRtBackground === 'fade') {
          wrapper.classList.add('fade-bg');
        }
        if (isElementOnDarkBackground(textNode.parentElement)) {
          wrapper.classList.add('dark-bg');
        }
        wrapper.dataset.originalText = originalText;
        wrapper.dataset.word = result.word;
        
        wrapper.appendChild(document.createTextNode(originalText));
        // 不再創建和添加 <rt> 標籤，防裁剪防佈局擴張，拼音將改用 Shadow DOM 浮動層顯示
        
        // 提取並替換內容
        range.deleteContents();
        range.insertNode(wrapper);
        
      } else {
        // 標準高亮模式
        wrapper = document.createElement('span');
        wrapper.className = 'jyutping-highlight hl-' + (highlightStyle || 'yellow');
        range.surroundContents(wrapper);
      }
      
      highlightSpans.push(wrapper);
      
      // 更新 currentRange 指向高亮節點的範圍（用於彈窗定位）
      currentRange = document.createRange();
      currentRange.selectNodeContents(wrapper);
    } catch (e) {
      console.log('Highlight failed:', e);
      // 回退方案
      try {
        const range = document.createRange();
        range.setStart(textNode, offset);
        range.setEnd(textNode, Math.min(offset + result.length, textNode.textContent.length));
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
        
        if (span.tagName === 'RUBY') {
          // 對於 Ruby 模式，我們不能把 <rt> 標籤也提取出來，否則會變成普通文字顯示
          // 我們只需要還原它原本的文字即可
          const originalText = span.dataset.originalText || span.textContent.replace(/[a-zA-Z0-9\u200A]+/g, '');
          const textNode = document.createTextNode(originalText);
          parent.insertBefore(textNode, span);
        } else {
          // 將 span 內容提取回父節點
          while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
          }
        }
        
        parent.removeChild(span);
        // 合併相鄰的文字節點
        parent.normalize();
      }
    });
    highlightSpans = [];
    
    // 移除全文注音模式下的 ruby 高亮
    if (highlightedRubyElement) {
      highlightedRubyElement.classList.remove('jyutping-highlight', 'jyutping-clicked-hover');
      highlightedRubyElement.classList.remove('hl-yellow', 'hl-blue', 'hl-red', 'hl-green', 'hl-gray', 'hl-underline-dashed', 'hl-border-dashed');
      highlightedRubyElement = null;
    }
    
    currentRange = null;
  }

  // ==================== 段落整段粵語翻譯 ====================

  // 從座標找出最近的「可翻譯塊級元素」（最貼近的段落容器）
  function findTranslatableBlock(x, y) {
    let el = document.elementFromPoint(x, y);
    if (!el) return null;
    // 排除插件自身 UI 與已生成的譯文
    if (el.closest('#cantonese-popup-dict, #cantonese-translate-popup, .jyutping-cantonese-trans')) return null;
    if (isEditableElement(el)) return null;

    const BLOCK_TAGS = new Set([
      'P', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'DD', 'DT', 'FIGCAPTION', 'TD', 'TH', 'ARTICLE', 'SECTION', 'DIV', 'PRE'
    ]);

    let node = el;
    while (node && node !== document.body && node.nodeType === 1) {
      const disp = window.getComputedStyle(node).display;
      const isBlock = BLOCK_TAGS.has(node.tagName) || /block|list-item|table-cell|flow-root/.test(disp);
      if (isBlock && node.textContent.trim().length > 0) return node;
      node = node.parentElement;
    }
    return null;
  }

  // 觸發：翻譯指定座標下的段落（已翻譯則移除，toggle）
  function translateBlockAtPoint(x, y) {
    if (x === 0 && y === 0) return;
    const block = findTranslatableBlock(x, y);
    if (!block) return;

    // 已有譯文 → 移除（toggle）
    const existingId = block.getAttribute('data-jyutping-trans-id');
    if (existingId) {
      removeBlockTranslation(block);
      return;
    }

    const id = ++paraTransSeq;
    
    // 提取精確的段落文本 HTML：白名單過濾
    // 只提取文字節點和內聯文字標籤，精確定位文本流，徹底過濾掉視頻、廣告、無關組件等非文字區塊
    const container = document.createElement('div');
    const ALLOWED_INLINE_TAGS = new Set(['span', 'a', 'b', 'strong', 'i', 'em', 'sup', 'sub', 'font', 'ruby', 'rt', 'br', 'label', 'time', 'mark', 'q', 'cite', 'code']);
    
    let hasTextContent = false;
    for (const child of block.childNodes) {
      if (child.nodeType === 3) {
        if (child.textContent.trim()) hasTextContent = true;
        container.appendChild(child.cloneNode(true));
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        if (ALLOWED_INLINE_TAGS.has(tag)) {
          if (child.textContent.trim()) hasTextContent = true;
          container.appendChild(child.cloneNode(true));
        }
      }
    }
    
    const html = container.innerHTML;
    // 將 <br> 轉換為換行符號以保留斷行
    const tempContainer = container.cloneNode(true);
    tempContainer.querySelectorAll('br').forEach(br => br.replaceWith('\\n'));
    // 不使用 replace(/\s+/g, ' ') 以免把換行符號消滅
    const textContent = tempContainer.textContent.trim();
    if (!html || !hasTextContent) return;

    const hasComplexMedia = !!block.querySelector('video, iframe, [data-module-type="video"], [class*="video"]');
    const isReplaceMode = paragraphTransMode === 'replace' && !hasComplexMedia;

    const translationEl = createTranslationPlaceholder(block);
    block.setAttribute('data-jyutping-trans-id', String(id));
    pendingParaTrans.set(id, { block, translationEl, isReplaceMode });

    chrome.runtime.sendMessage({ action: 'aiTranslateParagraph', id, html, textContent, direction: paragraphTransDirection });
  }

  // 創建翻譯佔位符：永遠先在段落末尾添加一個 span 顯示 loading，不立刻隱藏原文
  function createTranslationPlaceholder(block) {
    const loadingText = paragraphTransEngine === 'bing' ? '使用 Bing 翻译' : '使用 AI 翻译';
    
    const clone = document.createElement('span');
    clone.style.display = 'inline-block';
    clone.style.marginLeft = '8px';
    clone.style.fontSize = '0.95em';
    
    clone.classList.add('jyutping-cantonese-trans', 'notranslate', 'jyutping-loading-container');
    clone.setAttribute('translate', 'no');
    clone.innerHTML = `<span class="jyutping-cantonese-trans-loading"><span class="jyutping-loading-spinner"></span>${loadingText}</span>`;
    
    // 尋找最後一個文字/內聯元素，將翻譯插入在其之後，媒體之前
    let insertBeforeNode = null;
    const childNodes = Array.from(block.childNodes);
    for (let i = childNodes.length - 1; i >= 0; i--) {
      const node = childNodes[i];
      if (node.nodeType === 3 && node.textContent.trim().length > 0) break;
      if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();
        if (['span', 'a', 'sup', 'sub', 'strong', 'em', 'b', 'i', 'font'].includes(tag)) break;
      }
      insertBeforeNode = node;
    }
    
    if (insertBeforeNode) {
      block.insertBefore(clone, insertBeforeNode);
    } else {
      block.appendChild(clone);
    }
    
    return clone;
  }

  // 移除某塊的譯文
  function removeBlockTranslation(block) {
    const id = block.getAttribute('data-jyutping-trans-id');
    block.removeAttribute('data-jyutping-trans-id');
    
    const origDisplay = block.getAttribute('data-jyutping-original-display');
    if (origDisplay !== null) {
      block.style.display = origDisplay;
      block.removeAttribute('data-jyutping-original-display');
    }
    if (id && pendingParaTrans.has(Number(id))) {
      const entry = pendingParaTrans.get(Number(id));
      if (entry.translationEl && entry.translationEl.parentNode) entry.translationEl.remove();
      pendingParaTrans.delete(Number(id));
      return;
    }
    // 後備：直接找緊鄰的譯文兄弟元素
    const sib = block.nextElementSibling;
    if (sib && sib.classList.contains('jyutping-cantonese-trans')) sib.remove();
    // 後備：尋找塊內插入的沉浸式翻譯
    const child = block.querySelector(':scope > .jyutping-cantonese-trans');
    if (child) child.remove();
  }

  // 收到 background 的翻譯結果
  function applyParagraphTranslation(id, success, payloadHtml, error, isPlainText = false) {
    const entry = pendingParaTrans.get(id);
    if (!entry) return;
    pendingParaTrans.delete(id);
    const { block, translationEl, isReplaceMode } = entry;
    if (!translationEl || !translationEl.parentNode) {
      if (block) block.removeAttribute('data-jyutping-trans-id');
      return;
    }

    if (success && payloadHtml) {
      let finalTargetEl = translationEl;

      if (isReplaceMode) {
        // 替換模式：現在才創建替換塊並隱藏原文
        const tag = block.tagName;
        let replaceClone;
        if (tag === 'TD' || tag === 'TH' || tag === 'LI' || tag === 'DT' || tag === 'DD') {
          replaceClone = document.createElement('div');
        } else {
          replaceClone = block.cloneNode(false);
        }
        replaceClone.classList.add('jyutping-cantonese-trans', 'notranslate', 'jyutping-cantonese-trans-replace');
        replaceClone.setAttribute('translate', 'no');
        replaceClone.removeAttribute('id');
        replaceClone.removeAttribute('data-jyutping-trans-id');
        
        block.setAttribute('data-jyutping-original-display', block.style.display || '');
        block.style.display = 'none';
        
        if (block.nextSibling) {
          block.parentNode.insertBefore(replaceClone, block.nextSibling);
        } else {
          block.parentNode.appendChild(replaceClone);
        }
        
        translationEl.remove(); // 移除臨時的 span loading
        finalTargetEl = replaceClone; // 將內容寫入新的塊
      } else {
        finalTargetEl.classList.remove('jyutping-loading-container');
        finalTargetEl.innerHTML = '';
        finalTargetEl.style.display = 'block';
        finalTargetEl.style.marginTop = '6px';
        finalTargetEl.style.paddingTop = '6px';
        finalTargetEl.style.marginLeft = '0';
      }

      if (isPlainText) {
        finalTargetEl.textContent = payloadHtml;
        finalTargetEl.style.whiteSpace = 'pre-wrap';
      } else {
        finalTargetEl.innerHTML = sanitizeTranslatedHtml(payloadHtml);
      }
      
      const speakerIcon = document.createElement('button');
      speakerIcon.className = 'jyutping-speaker-btn';
      speakerIcon.innerHTML = `
        <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
      `;
      speakerIcon.title = paragraphTransDirection === 'target_to_yue' ? '朗讀粵語翻譯' : '朗讀翻譯';
      
      speakerIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const textToSpeak = finalTargetEl.textContent.trim();
        speakCantonese(textToSpeak, speakerIcon);
      });
      
      finalTargetEl.appendChild(speakerIcon);
    } else {
      // 失敗：撤掉占位塊與標記，提示
      translationEl.remove();
      if (block) block.removeAttribute('data-jyutping-trans-id');
      showToast('粵語翻譯失敗：' + (error || '未知錯誤'));
    }
  }

  // 監聽來自 popup 的消息（切換開關、設定等）
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleEnabled') {
      isEnabled = request.enabled;
      if (!isEnabled) {
        hidePopup();
        if (isFullPageRubyActive) removeRubyAnnotations(document.body);
      } else {
        if (isFullPageRubyActive) injectRubyAnnotations(document.body);
      }
    } else if (request.action === 'changeHoverModifier') {
      hoverModifier = request.modifier;
      if (hoverModifier !== 'none' && popup && !isMouseOverPopup) {
        hidePopup();
      }
    } else if (request.action === 'changeDisplayMode') {
      displayMode = request.mode;
    } else if (request.action === 'changeToneStyle') {
      toneStyle = request.style;
    } else if (request.action === 'changePopupDisplayStyle') {
      popupDisplayStyle = request.style;
    } else if (request.action === 'changeCompactExpandBtn') {
      compactExpandBtn = request.enabled;
    } else if (request.action === 'changeRubyRtBackground') {
      rubyRtBackground = request.value;
    } else if (request.action === 'changeHighlightStyle') {
      if (request.style && request.style.startsWith('ruby-')) {
        rubyHoverStyle = request.style;
      } else {
        highlightStyle = request.style;
      }
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
    } else if (request.action === 'changeTransLangs') {
      transLangs = request.transLangs;
    } else if (request.action === 'changeTransLang') {
      let tls = request.transLang;
      if (tls === 'both') transLangs = ['zh-Hans', 'en'];
      else if (tls === 'mandarin') transLangs = ['zh-Hans'];
      else if (tls === 'english') transLangs = ['en'];
    } else if (request.action === 'changeTransTrigger') {
      transTrigger = request.transTrigger;
    } else if (request.action === 'changeTransHoverEngine') {
      transHoverEngine = request.transHoverEngine;
    } else if (request.action === 'changeEnableAutoTranslateYueDefs') {
      enableAutoTranslateYueDefs = request.enableAutoTranslateYueDefs === true;
    } else if (request.action === 'changeAutoTranslateYueDefsTargetLang') {
      autoTranslateYueDefsTargetLang = request.autoTranslateYueDefsTargetLang;
    } else if (request.action === 'changeAutoTranslateYueDefsEngine') {
      autoTranslateYueDefsEngine = request.autoTranslateYueDefsEngine;
    } else if (request.action === 'changeYueDefDisplayMode') {
      yueDefDisplayMode = request.yueDefDisplayMode || 'expand';
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
      audio.ontimeupdate = () => {
        if (audio.duration && audio.currentTime >= audio.duration - 0.05) stopSpeakerAnimation();
      };
      audio.onended = stopSpeakerAnimation;
      audio.onerror = stopSpeakerAnimation;
      audio.play().catch(err => {
        console.warn('[Content] TTS Playback failed (NotAllowedError or missing interaction):', err);
        stopSpeakerAnimation();
      });
    } else if (request.action === 'translateResult') {
      if (request.success) {
                let trans = request.translations;
        if (!trans && (request.mandarin || request.english)) {
          trans = {};
          if (request.mandarin) trans['zh-Hans'] = request.mandarin;
          if (request.english) trans['en'] = request.english;
        }
        showTranslatePopup(null, trans, false);
      } else {
        showTranslatePopup(null, {'zh-Hans': '❌ ' + request.error}, false);
        showToast('翻譯失敗: ' + request.error);
      }
    } else if (request.action === 'aiTranslateResult') {
      if (request.success) {
        showAiResult(request.word, request.explanation, activeQAContext.targetRect);
        if (activeQAContext.word === request.word) {
          activeQAContext.originalTranslation = request.explanation;
        }
      } else {
        showAiResult(request.word, '❌ ' + request.error, activeQAContext.targetRect);
        if (activeQAContext.word === request.word) {
          activeQAContext.originalTranslation = '❌ ' + request.error;
        }
      }
    } else if (request.action === 'changeAiEnabled') {
      aiEnabled = request.aiEnabled;
    } else if (request.action === 'toggleRuby') {
      console.log('[Content] Received toggleRuby message from background');
      toggleRubyAnnotations();
    } else if (request.action === 'addToWordbook') {
      // 右鍵菜單「加入生詞本」：查字典後存入
      const text = (request.text || '').trim();
      if (text) {
        const entry = dictionary && dictionary[text];
        addWord({
          character: text,
          simplified: entry ? entry.simplified : text,
          jyutping: entry ? entry.jyutping : '',
          yale: entry ? (entry.yale || '') : '',
          english: entry ? (entry.english || []) : [],
          sourceUrl: window.location.href,
          sourceTitle: document.title
        }).then(result => {
          if (result.isNew) {
            showToast(pt('wordbookSaved'), 1500, 'success');
          } else {
            showToast(pt('wordbookExists'), 1500, 'success');
          }
        }).catch(() => {
          showToast(pt('wordbookSaveFailed'), 1500, 'error');
        });
      }
    } else if (request.action === 'ttsEnded') {
      stopSpeakerAnimation();
    } else if (request.action === 'aiTranslateParagraphResult') {
      applyParagraphTranslation(request.id, request.success, request.html, request.error, request.isPlainText);
    } else if (request.action === 'changeParagraphTransKey') {
      paragraphTransKey = request.paragraphTransKey || 'off';
    } else if (request.action === 'changeParagraphTransMode') {
      paragraphTransMode = request.paragraphTransMode || 'below';
    } else if (request.action === 'updateParagraphTransEngine') {
      paragraphTransEngine = request.paragraphTransEngine || 'bing';
    } else if (request.action === 'changeParagraphTransDirection') {
      paragraphTransDirection = request.value || 'yue_to_target';
    } else if (request.action === 'aiTranslateSentenceLangResult') {
      let row = null;
      if (translatePopup && translatePopup.style.display !== 'none') {
        row = translatePopup.querySelector(`.translate-row[data-key="${request.key}"]`);
      }
      if (!row && popup && popup.style.display !== 'none') {
        row = popup.querySelector(`.translate-row[data-key="${request.key}"]`);
      }
      if (row) {
        const textEl = row.querySelector('.translate-text');
        const labelEl = row.querySelector('.translate-label');
        if (textEl) {
          if (request.success) {
            textEl.textContent = request.translation;
            textEl.style.opacity = '1';
            if (labelEl) {
              let labelName = 'AI';
              if (request.key === 'zh-Hans') labelName = pt('mandarin');
              else if (request.key === 'en') labelName = pt('english');
              else if (request.key === 'ja') labelName = pt('japanese');
              else if (request.key === 'ko') labelName = pt('korean');
              labelEl.textContent = labelName;
              labelEl.title = '點擊使用 Bing 重新翻譯';
              labelEl.classList.add('translate-label-ai');
            }
          } else {
            textEl.textContent = '❌ ' + request.error;
            textEl.style.opacity = '1';
            if (labelEl) {
              labelEl.textContent = '錯誤';
              labelEl.title = 'AI 翻譯失敗，點擊使用 Bing 重新翻譯';
              labelEl.style.cursor = 'pointer';
            }
          }
        }
      }
    } else if (request.action === 'bingTranslateSentenceLangResult') {
      let row = null;
      if (translatePopup && translatePopup.style.display !== 'none') {
        row = translatePopup.querySelector(`.translate-row[data-key="${request.key}"]`);
      }
      if (!row && popup && popup.style.display !== 'none') {
        row = popup.querySelector(`.translate-row[data-key="${request.key}"]`);
      }
      if (row) {
        const textEl = row.querySelector('.translate-text');
        const labelEl = row.querySelector('.translate-label');
        if (textEl) {
          if (request.success) {
            textEl.textContent = request.result;
            textEl.style.opacity = '1';
            if (labelEl) {
              if (request.key === 'zh-Hans') labelEl.textContent = pt('mandarin');
              else if (request.key === 'en') labelEl.textContent = pt('english');
              else if (request.key === 'ja') labelEl.textContent = pt('japanese');
              else if (request.key === 'ko') labelEl.textContent = pt('korean');
              labelEl.title = '點擊使用 AI 重新翻譯';
              labelEl.classList.remove('translate-label-ai');
            }
          } else {
            textEl.textContent = '❌ ' + request.error;
            textEl.style.opacity = '1';
            if (labelEl) {
              labelEl.textContent = '錯誤';
              labelEl.title = 'Bing 翻譯失敗，點擊使用 AI 重新翻譯';
              labelEl.style.cursor = 'pointer';
            }
          }
        }
      }
    }
  });

  // ==================== 全文注音功能 ====================
  let isFullPageRubyActive = sessionStorage.getItem('jyutping_full_page_ruby') === 'true';

  // 監聽全局快捷鍵用於退出全文注音 / 收藏生詞
  document.addEventListener('keydown', (e) => {
    // Escape: 如果全文注音開啟，則退出
    if (e.key === 'Escape') {
      if (isFullPageRubyActive) {
        toggleRubyAnnotations();
      }
    }

    // S 鍵：快捷收藏當前高亮詞到生詞本（所有模式通用）
    // 僅在有高亮詞、不在輸入框、無修飾鍵時觸發
    if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      if (!currentWord) return;
      if (isEditableElement(document.activeElement) || hasEditableFocus()) return;
      // 確認 popup 可見（任何模式）
      if (!popup || popup.style.display === 'none') return;

      e.preventDefault();
      e.stopPropagation();
      saveCurrentWordToWordbook();
    }
  });

  async function toggleRubyAnnotations() {
    console.log('[Content] toggleRubyAnnotations called. isEnabled:', isEnabled, 'isFullPageRubyActive:', isFullPageRubyActive);
    if (!isEnabled) {
      console.log('[Content] Extension is disabled, aborting toggle.');
      return;
    }
    
    // 確保詞典已載入
    if (!dictionary || Object.keys(dictionary).length === 0) {
      showToast("正在加載粵語詞典，請稍候...", 1500);
      await loadDictionary();
    }
    
    isFullPageRubyActive = !isFullPageRubyActive;
    sessionStorage.setItem('jyutping_full_page_ruby', isFullPageRubyActive ? 'true' : 'false');
    
    if (isFullPageRubyActive) {
      console.log('[Content] Jyutping Full Page Ruby: ON');
      injectRubyAnnotations(document.body);
      startRubyObserver();
      showToast(tt('toastRubyEnabled'), 2000, 'success');
    } else {
      console.log('Jyutping Full Page Ruby: OFF');
      stopRubyObserver();
      removeRubyAnnotations(document.body);
      showToast(tt('toastRubyDisabled'), 2000, 'error');
    }
  }

  let rubyMutationTimer = null;
  let rubyMutationObserver = null;

  function startRubyObserver() {
    if (rubyMutationObserver) return;
    rubyMutationObserver = new MutationObserver((mutations) => {
      if (!isFullPageRubyActive) return;
      
      let shouldTrigger = false;
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'RUBY' && node.classList.contains('jyutping-ruby-injected')) continue;
              if (node.tagName === 'RT') continue;
              if (node.id === 'jyutping-toast-container' || node.id === 'jyutping-popup') continue;
              // 忽略 svg 等非文本容器
              if (['script', 'style', 'noscript'].includes(node.tagName.toLowerCase())) continue;
              shouldTrigger = true;
              break;
            } else if (node.nodeType === Node.TEXT_NODE) {
              if (/[\\u4e00-\\u9fff]/.test(node.textContent)) {
                if (node.parentElement && node.parentElement.closest('ruby.jyutping-ruby-injected')) continue;
                shouldTrigger = true;
                break;
              }
            }
          }
        } else if (m.type === 'characterData') {
          if (/[\\u4e00-\\u9fff]/.test(m.target.textContent)) {
            if (m.target.parentElement && m.target.parentElement.closest('ruby.jyutping-ruby-injected')) continue;
            shouldTrigger = true;
            break;
          }
        }
        if (shouldTrigger) break;
      }
      
      if (shouldTrigger) {
        clearTimeout(rubyMutationTimer);
        rubyMutationTimer = setTimeout(() => {
          if (isFullPageRubyActive) {
            injectRubyAnnotations(document.body);
          }
        }, 500); // 500ms 延遲，防止頻繁重繪
      }
    });
    
    rubyMutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function stopRubyObserver() {
    if (rubyMutationObserver) {
      rubyMutationObserver.disconnect();
      rubyMutationObserver = null;
    }
    clearTimeout(rubyMutationTimer);
  }

  function removeRubyAnnotations(rootElement) {
    const rubies = rootElement.querySelectorAll('ruby.jyutping-ruby-injected');
    rubies.forEach(ruby => {
      const wordText = ruby.dataset.word || '';
      if (wordText) {
        const textNode = document.createTextNode(wordText);
        if (ruby.parentNode) {
          ruby.parentNode.replaceChild(textNode, ruby);
        }
      }
    });

    // 恢復被修改過的父節點行高
    const parents = rootElement.querySelectorAll('.jyutping-ruby-parent');
    parents.forEach(p => {
      if (!p.querySelector('ruby.jyutping-ruby-injected')) {
        p.classList.remove('jyutping-ruby-parent');
        const originalLh = p.getAttribute('data-jp-original-lh');
        if (originalLh !== null) {
          if (originalLh === '') {
            p.style.removeProperty('line-height');
          } else {
            p.style.setProperty('line-height', originalLh);
          }
          p.removeAttribute('data-jp-original-lh');
        }
      }
    });
    
    // 恢復外層背景方塊的高度限制
    const expandedAncestors = rootElement.querySelectorAll('.jyutping-ruby-expanded');
    expandedAncestors.forEach(p => {
      if (!p.querySelector('ruby.jyutping-ruby-injected')) {
        p.classList.remove('jyutping-ruby-expanded');
        
        const origHeight = p.getAttribute('data-jp-original-height');
        if (origHeight !== null) {
          if (origHeight === '') p.style.removeProperty('height');
          else p.style.setProperty('height', origHeight);
          p.removeAttribute('data-jp-original-height');
        }
        
        const origMinHeight = p.getAttribute('data-jp-original-min-height');
        if (origMinHeight !== null) {
          if (origMinHeight === '') p.style.removeProperty('min-height');
          else p.style.setProperty('min-height', origMinHeight);
          p.removeAttribute('data-jp-original-min-height');
        }
      }
    });
    
    // 觸發全局 resize 事件
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 500);
  }

  // ========== Toast 系統 ==========
  let currentToastTimeout = null;
  let currentToastRemoveTimeout = null;

  function showToast(message, duration = 2000, type = '') {
    // 避免在 iframe 內部重複顯示 Toast
    if (window !== window.top) return;
    
    let container = document.getElementById('jyutping-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'jyutping-toast-container';
      document.body.appendChild(container);
    }
    
    // 清除舊的 Toast 和定時器，確保只顯示最新的一條
    container.innerHTML = '';
    if (currentToastTimeout) clearTimeout(currentToastTimeout);
    if (currentToastRemoveTimeout) clearTimeout(currentToastRemoveTimeout);
    
    const toast = document.createElement('div');
    toast.className = 'jyutping-toast' + (type ? ' jyutping-toast-' + type : '');

    // 添加圖標
    const iconSvg = type === 'success'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : type === 'error'
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
        : '';
    toast.innerHTML = iconSvg + '<span>' + message + '</span>';
    
    container.appendChild(toast);
    
    // 強制 reflow 觸發動畫
    toast.offsetHeight;
    toast.classList.add('show');
    
    currentToastTimeout = setTimeout(() => {
      toast.classList.remove('show');
      currentToastRemoveTimeout = setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
        if (container.childNodes.length === 0 && container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }, 300); // 等待動畫結束
    }, duration);
  }

  function injectRubyAnnotations(rootElement) {
    console.log('[Content] injectRubyAnnotations started on element:', rootElement);
    if (!dictionary || Object.keys(dictionary).length === 0) {
      console.warn('[Content] Dictionary not loaded or empty! Cannot inject rubies.');
      return;
    }
    console.log('[Content] Dictionary seems valid, total entries:', Object.keys(dictionary).length);

    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        const parent = node.parentNode;
        if (!parent || !parent.tagName) return NodeFilter.FILTER_REJECT;
        
        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'textarea', 'input', 'code', 'pre', 'ruby', 'rt', 'rp', 'option', 'optgroup', 'title'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // 忽略插件自己生成的 UI 元素（懸浮窗、提示框），防止在提示文字上再次注入拼音
        if (parent.closest('#jyutping-toast-container, #jyutping-popup')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        if (parent.isContentEditable) {
          return NodeFilter.FILTER_REJECT;
        }
        
        if (!/[\u4e00-\u9fff]/.test(node.textContent)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodesToProcess = [];
    let currentNode;
    while (currentNode = walker.nextNode()) {
      nodesToProcess.push(currentNode);
    }

    console.log(`[Content] Found ${nodesToProcess.length} text nodes containing Chinese characters.`);

    let replacedWordsCount = 0;
    const BATCH_SIZE = 50; // 每批處理 50 個文本節點，避免阻塞主線程

    function processNode(node) {
      const text = node.textContent;
      const fragment = document.createDocumentFragment();
      let currentIndex = 0;
      let nonChineseBuffer = ''; // 緩衝非中文字符，合併為一個文本節點

      while (currentIndex < text.length) {
        const char = text[currentIndex];
        
        if (/[\u4e00-\u9fff]/.test(char)) {
          // 先清空非中文緩衝
          if (nonChineseBuffer) {
            fragment.appendChild(document.createTextNode(nonChineseBuffer));
            nonChineseBuffer = '';
          }
          
          const remainingText = text.substring(currentIndex);
          try {
            const match = lookupWord(remainingText);
            if (match && match.length > 0) {
              const wordText = match.word;
              const entry = match.entry;
              
              let jpString = '';
              if (displayMode === 'jyutping') {
                jpString = entry.jyutping ? (Array.isArray(entry.jyutping) ? entry.jyutping[0] : entry.jyutping) : '';
              } else {
                jpString = entry.yale ? (Array.isArray(entry.yale) ? entry.yale[0] : entry.yale) : '';
              }
              
              if (jpString) {
                if (toneDisplayStyle === 'superscript') {
                  jpString = convertToSuperscriptTone(jpString);
                } else if (toneDisplayStyle === 'hidden') {
                  jpString = jpString.replace(/\d/g, '');
                }
                
                // 將標準空格替換為窄空格(Hair Space)以縮減拼音長度
                jpString = jpString.replace(/ /g, '\u200A');
                
                const ruby = document.createElement('ruby');
                ruby.className = 'jyutping-ruby-injected';
                if (isElementOnDarkBackground(node.parentElement || node)) ruby.classList.add('dark-bg');
                ruby.dataset.word = wordText;
                
                const chars = wordText.split('');
                const pinyins = jpString.split('\u200A');
                
                if (chars.length === pinyins.length) {
                  for (let i = 0; i < chars.length; i++) {
                    ruby.appendChild(document.createTextNode(chars[i]));
                    const rt = document.createElement('rt');
                    rt.textContent = pinyins[i];
                    ruby.appendChild(rt);
                  }
                } else {
                  ruby.appendChild(document.createTextNode(wordText));
                  const rt = document.createElement('rt');
                  rt.textContent = jpString;
                  ruby.appendChild(rt);
                }
                
                fragment.appendChild(ruby);
                replacedWordsCount++;
              } else {
                fragment.appendChild(document.createTextNode(wordText));
              }
              currentIndex += match.length;
            } else {
              nonChineseBuffer += char;
              currentIndex++;
            }
          } catch (err) {
            console.error('lookupWord error:', err);
            nonChineseBuffer += char;
            currentIndex++;
          }
        } else {
          nonChineseBuffer += char;
          currentIndex++;
        }
      }
      
      // 清空剩餘的非中文緩衝
      if (nonChineseBuffer) {
        fragment.appendChild(document.createTextNode(nonChineseBuffer));
      }
      
      if (node.parentNode) {
        const parent = node.parentNode;
        parent.replaceChild(fragment, node);
        
        if (parent.tagName && parent.tagName.toLowerCase() !== 'body') {
          parent.classList.add('jyutping-ruby-parent');
          if (!parent.hasAttribute('data-jp-original-lh')) {
            parent.setAttribute('data-jp-original-lh', parent.style.lineHeight || '');
            parent.style.setProperty('line-height', '2.2', 'important');
          }
        }
      }
    }

    // 分批異步處理，每批 BATCH_SIZE 個節點後讓出主線程
    function processBatch(startIndex) {
      const endIndex = Math.min(startIndex + BATCH_SIZE, nodesToProcess.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        processNode(nodesToProcess[i]);
      }
      
      if (endIndex < nodesToProcess.length) {
        // 讓出主線程，避免 "Page Unresponsive"
        setTimeout(() => processBatch(endIndex), 0);
      } else {
        // 全部處理完畢
        console.log(`[Content] Finished injecting ruby annotations. Replacements made:`, replacedWordsCount);
        setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
        setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 500);
      }
    }

    if (nodesToProcess.length > 0) {
      processBatch(0);
    }
  }

  // 顯示 AI 隨身問答界面
  function showPopupQA(activePopup) {
    // 注入 Q&A 專屬動畫樣式 (精緻跳動圓點 - 緊湊版) 到 Shadow DOM 中
    const styleId = 'cantonese-qa-style';
    if (!shadowRoot.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .qa-loading-dots {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
          padding: 2px 0;
          height: 10px;
          box-sizing: border-box;
        }
        .qa-loading-dots span {
          width: 6px;
          height: 6px;
          background-color: var(--popup-accent, var(--popup-text-label));
          border-radius: 50%;
          display: inline-block;
          animation: qa-dot-bounce 1.2s infinite ease-in-out both;
        }
        .qa-loading-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }
        .qa-loading-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }
        @keyframes qa-dot-bounce {
          0%, 80%, 100% { 
            transform: translateY(0);
            opacity: 0.35;
          } 
          40% { 
            transform: translateY(-3px);
            opacity: 1;
          }
        }
      `;
      shadowRoot.appendChild(style);
    }

    // 清除選區，避免雙擊產生的選取干擾
    try {
      window.getSelection().removeAllRanges();
    } catch (e) {}

    // 1. 如果已存在 Q&A 界面，則直接 focus 輸入框，不重複添加
    const existingQA = activePopup.querySelector('.popup-qa-container');
    if (existingQA) {
      const textarea = existingQA.querySelector('.qa-input-textarea');
      if (textarea) textarea.focus();
      return;
    }

    // 2. 如果是精簡模式，先切換為完整模式以顯示詞義與問答
    if (activePopup.id === 'cantonese-popup-dict' && activePopup.classList.contains('compact-mode')) {
      beginExpandGrace();

      const savedStyle = popupDisplayStyle;
      popupDisplayStyle = 'full';
      showPopup(lastPopupResult, lastPopupRect);
      popupDisplayStyle = savedStyle;
    }

    // 強制將彈窗寬度改為固定值，以配合問答界面的顯示，防止在 loading 時收縮
    activePopup.style.setProperty('width', '320px', 'important');
    activePopup.style.setProperty('min-width', '320px', 'important');
    activePopup.style.setProperty('max-width', '320px', 'important');

    const inner = activePopup.querySelector('.popup-inner');
    if (!inner) return;
    inner.style.setProperty('width', '100%', 'important');
    inner.style.setProperty('max-width', '100%', 'important');
    inner.style.setProperty('min-width', '100%', 'important');
    inner.style.setProperty('box-sizing', 'border-box', 'important');

    // 根據不同彈窗類型，計算邊距以實現完美對齊
    const isTranslate = activePopup.id === 'cantonese-translate-popup';
    const marginStyle = isTranslate ? 'margin: 0 -12px -8px -12px;' : 'margin: 0;';
    const upperMarginStyle = isTranslate ? 'margin: -8px -12px 0 -12px;' : 'margin: 0;';
    const paddingLeft = isTranslate ? '12px' : '16px';

    // 4. 創建 Q&A 上部顯示容器 (用於顯示 AI 回答)
    const qaUpperDisplay = document.createElement('div');
    qaUpperDisplay.className = 'qa-upper-display';
    qaUpperDisplay.style.cssText = `max-height: 180px; overflow-y: auto; font-size: 13px; color: var(--popup-text); line-height: 1.4; white-space: pre-wrap; display: none; width: auto; box-sizing: border-box; ${upperMarginStyle}`;

    // 5. 創建 Q&A 容器 (超精簡貼合版：邊框融合，直接填滿懸浮窗底部)
    const qaContainer = document.createElement('div');
    qaContainer.className = 'popup-qa-container';
    qaContainer.style.cssText = `border-top: 1px solid var(--popup-divider); padding: 0; display: flex; flex-direction: column; box-sizing: border-box; background: var(--popup-bg); ${marginStyle} width: auto;`;
    
    qaContainer.innerHTML = `
      <div class="qa-input-wrapper" style="display: flex; width: 100%; margin: 0;">
        <textarea class="qa-input-textarea" placeholder="輸入追問... (Enter 發送)" rows="1" style="width: 100%; min-height: 38px; max-height: 100px; padding: 10px ${paddingLeft}; border: none; background: transparent; color: var(--popup-text); font-size: 13px; resize: none; outline: none; box-sizing: border-box; font-family: inherit; line-height: 1.4; margin: 0; display: block;"></textarea>
      </div>
      <div class="qa-loading-wrapper" style="display: none; width: 100%; margin: 0; padding: 14px ${paddingLeft}; box-sizing: border-box; min-height: 38px; align-items: center; justify-content: flex-start;">
        <div class="qa-loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;

    inner.appendChild(qaUpperDisplay);
    inner.appendChild(qaContainer);

    // 強制重繪後重新定位，避免彈窗寬度改變導致箭頭不居中
    if (activePopup.id === 'cantonese-translate-popup' && lastTranslateRect) {
      positionTranslatePopup(lastTranslateRect);
    }

    const textarea = qaContainer.querySelector('.qa-input-textarea');
    const inputWrapper = qaContainer.querySelector('.qa-input-wrapper');
    const loadingWrapper = qaContainer.querySelector('.qa-loading-wrapper');
    
    // 確保初始無任何空格
    textarea.value = '';

    // 6. 輸入框自適應高度且防止首位輸入空格/換行
    textarea.addEventListener('input', () => {
      if (textarea.value.startsWith(' ') || textarea.value.startsWith('\n')) {
        textarea.value = textarea.value.trimStart();
      }
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(100, textarea.scrollHeight) + 'px';
      adjustPopupVerticalPosition(activePopup);
    });

    // 7. Enter 鍵提交 (使用終極雙保險機制)
    let lastShiftState = false;
    
    textarea.addEventListener('keydown', (e) => {
      lastShiftState = e.shiftKey;
      
      // 第一道防線：能攔截的直接攔截（避免視覺閃爍）
      // 必須確保不是在 IME 組合中，且不是 229
      if (!e.isComposing && e.keyCode !== 229 && (e.code === 'Enter' || e.code === 'NumpadEnter') && !e.shiftKey) {
        e.preventDefault();
        setTimeout(() => sendMsg(), 10);
      }
    });

    // 第二道防線：如果 Mac 輸入法偷偷把 keydown 吞了或者偽裝成 229/isComposing，
    // 瀏覽器最終還是會執行默認行為（插入換行）。
    // 所以只要監聽到插入換行，就說明輸入法根本沒處理它，這絕對是個發送指令！
    textarea.addEventListener('input', (e) => {
      if (e.inputType === 'insertLineBreak' && !lastShiftState) {
        // 把剛才瀏覽器插進去的換行符刪掉
        textarea.value = textarea.value.replace(/\n$/, '');
        sendMsg();
      }
    });

    // 8. 自動 focus
    setTimeout(() => {
      textarea.focus();
    }, 50);

    // 9. 首度調整垂直位置，避免下溢
    adjustPopupVerticalPosition(activePopup);

    function sendMsg() {
      const text = textarea.value.trim();
      if (!text) return;
      textarea.value = '';
      textarea.style.height = 'auto';

      // 隱藏輸入框，顯示加載動畫
      inputWrapper.style.display = 'none';
      loadingWrapper.style.display = 'flex';

      // 保持上部原有內容（釋義或之前的 AI 回答）不變，僅微調位置
      adjustPopupVerticalPosition(activePopup);

      // 發送 API 請求
      chrome.runtime.sendMessage({
        action: 'aiChatQuery',
        word: activeQAContext.word,
        sentence: activeQAContext.sentence,
        originalTranslation: activeQAContext.originalTranslation,
        question: text,
        history: activeQAContext.history
      }, (response) => {
        // 恢復顯示輸入框，隱藏加載動畫
        loadingWrapper.style.display = 'none';
        inputWrapper.style.display = 'flex';
        
        // 隱藏所有其他非 Q&A 元素
        Array.from(inner.children).forEach(child => {
          if (child !== qaContainer && child !== qaUpperDisplay) {
            child.style.display = 'none';
          }
        });

        // 顯示上部回答區域並設置正常內邊距
        qaUpperDisplay.style.display = 'block';
        qaUpperDisplay.style.padding = `10px ${paddingLeft}`;

        if (chrome.runtime.lastError) {
          qaUpperDisplay.innerHTML = `<div style="color: var(--popup-text-muted); font-size: 13px; line-height: 1.4;">❌ 錯誤: ${chrome.runtime.lastError.message}</div>`;
          adjustPopupVerticalPosition(activePopup);
          setTimeout(() => { textarea.focus(); }, 50);
          return;
        }

        if (response && response.success) {
          // 記錄對話歷史
          activeQAContext.history.push({ role: 'user', content: text });
          activeQAContext.history.push({ role: 'assistant', content: response.reply });

          // 顯示回覆 (使用 Markdown 渲染)
          qaUpperDisplay.innerHTML = `<div style="font-size: 13px; color: var(--popup-text); line-height: 1.4; white-space: pre-wrap;">${renderMarkdown(response.reply)}</div>`;
        } else {
          qaUpperDisplay.innerHTML = `<div style="color: var(--popup-text-muted); font-size: 13px; line-height: 1.4;">❌ 錯誤: ${response ? response.error : '未知錯誤'}</div>`;
        }
        
        // 回覆內容只有單條最新內容，所以應該滾動到頂部以便用戶從頭閱讀
        qaUpperDisplay.scrollTop = 0;
        adjustPopupVerticalPosition(activePopup);

        // 聚焦輸入框以便繼續提問
        setTimeout(() => {
          textarea.focus();
        }, 50);
      });
    }
  }

  // 垂直位置微調，防止彈窗下邊界溢出視口
  function adjustPopupVerticalPosition(activePopup) {
    const rect = activePopup.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    if (rect.bottom > viewportHeight - 10) {
      const overflow = rect.bottom - (viewportHeight - 10);
      const currentTop = parseFloat(activePopup.style.top) || rect.top;
      activePopup.style.top = Math.max(5, currentTop - overflow) + 'px';
    }
  }

  // 啟動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
