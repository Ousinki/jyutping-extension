/**
 * 粵語懸浮詞典 - Options Script
 * 處理設定頁面的邏輯
 */

import GoogleAnalytics from './scripts/google-analytics.js';

document.addEventListener('DOMContentLoaded', () => {
  GoogleAnalytics.trackPageView('Options Page', '/options.html');

const i18nDict = {
  "zh-HK": {
    optTitle: "粵語懸浮詞典", optSubtitle: "Cantonese Popup Dictionary Settings", optGenSettings: "一般設定",
    optEnable: "啟用詞典", optEnableDesc: "在網頁上顯示粵語發音提示", optFormat: "發音顯示格式",
    optFormatDesc: "選擇粵語拼音系統", optTheme: "懸浮窗主題", optThemeDesc: "選擇詞典彈窗的配色風格",
    optFontSettings: "字體設定", optZhFont: "中文字體", optZhFontDesc: "設定詞典顯示的中文字體（留空為預設）",
    optEnFont: "拼音字體", optEnFontDesc: "設定拼音顯示的專屬字體（推薦等寬字體，留空為預設）",
    optTransSettings: "翻譯設定", optTransDesc1: "選中粵語文本後雙擊選區，同時顯示普通話和英文翻譯",
    optTransDesc2: "使用 Bing 翻譯引擎（原生支持粵語，免費無需配置）", optAISettings: "✨ AI 語境翻譯",
    optAIEnable: "啟用 AI 翻譯", optAIEnableDesc: "選中文本後長按選區，AI 根據上下文語境解釋詞義",
    optAIBaseUrlDesc: "OpenAI 兼容接口地址（支持所有廠商）", optAIModelLabel: "模型名稱",
    optAIPromptLabel: "AI 翻譯 Prompt", optFeedback: "關於與意見反饋", optDev: "開發者:",
    optFeedbackForm: "意見反饋", optEmail: "電郵地址（選填）", optMsg: "輸入你的建議或遇到的問題...",
    optSend: "發送反饋", optSending: "發送中...", optSent: "已發送！",
    optModelName: "模型名稱", optTestAI: " 測試 AI 連接", optTTSSettings: "語音設定 (TTS)",
    optClickToSpeak: "點擊發聲", optClickToSpeakDesc: "點擊高亮文字朗讀粵語發音", optTTSEngine: "語音引擎",
    optTTSEngineDesc: "選擇 TTS 服務提供商", optEdgeSettings: "Edge TTS 設定",
    optEdgeSettingsDesc: "選擇使用預設伺服器或自定義地址", optAzureSettings: "Azure Speech 設定",
    optAzureSettingsDesc: "選擇使用預設 API 或自定義密鑰", optVoice: "語音音色", optSpeed: "語速",
    optTestTTS: " 測試語音", optFeedbackTitle: "💡 意見與反饋", optFeedbackDesc: "如果您有任何功能建議或遇到 Bug，歡迎在這裡直接告訴我，或者發送電郵至 ousinki@outlook.com！",
    optNameLabel: "您的稱呼", optOptional: "(選填)", optNamePlaceholder: "如何稱呼您？",
    optEmailLabel: "聯絡電郵", optEmailPlaceholder: "your@email.com (方便回覆您)",
    optFeedbackLabel: "反饋內容", optFeedbackPlaceholder: "請填寫您的建議或遇到的問題...",
        optFooterData: "數據來源：", optFooterLicense: "授權：",
    optThemeClassic: "經典", optThemeHK: "香港紅", optThemeDark: "深邃夜色", optThemeInk: "墨韻",
    optThemeOcean: "海洋藍", optThemeWarm: "暖陽", optThemeMint: "薄荷綠", optThemeGlass: "毛玻璃",
    optDefaultServer: "預設伺服器（免配置）", optCustomUrl: "自定義地址",
    optDefaultAPI: "預設 API（免配置）", optCustomKey: "自定義密鑰（直連 Azure）",
    optEngineAzure: "Azure Speech (官方雲端語音)", optEngineBert: "Bert-VITS2 (粵語神經語音)",
    optVoice1: "曉曼 HiuMaan（女聲）⭐⭐⭐⭐⭐ · 響應 ~1s",
    optVoice2: "曉佳 HiuGaai（女聲）⭐⭐⭐⭐⭐ · 響應 ~1s",
    optVoice3: "雲龍 WanLung（男聲）⭐⭐⭐⭐⭐ · 響應 ~1s",
    optAITip1: "常用：OpenAI",
    optAITip2: "DeepSeek",
    optAITip3: "Ollama",
    optPlaying: "正在播放...",
    optTestingAI: "正在測試...",
    optSuccess: "✅ 連接成功！\n模型回覆：",
    optFail: "❌ 連接失敗：",
    optNoReply: "（無回覆）",
    optGreeting: "你好，歡迎使用粵語詞典",
    clTitle: "🚀 最新更新",
    clDesc: "本次更新帶來了以下優化：",
    clItem1: "🚩 新增快速報錯：懸浮查詞時，滑鼠移至齒輪圖標即可展開「報告」按鈕，直接在懸浮窗內提交讀音或釋義錯誤。",
    clItem2: "🔄 修復詞典緩存：解決了詞典更新後瀏覽器仍載入舊版數據的問題，現在始終獲取最新詞典。"
  },
  "en": {
    optTitle: "Jyutping Dictionary", optSubtitle: "Extension Settings", optGenSettings: "General Settings",
    optEnable: "Enable Dictionary", optEnableDesc: "Show Cantonese pronunciation on hover", optFormat: "Pronunciation System",
    optFormatDesc: "Select romanization format", optTheme: "Popup Theme", optThemeDesc: "Select popup color scheme",
    optFontSettings: "Font Settings", optZhFont: "Chinese Font", optZhFontDesc: "Set font for Chinese text (leave empty for default)",
    optEnFont: "Pinyin Font", optEnFontDesc: "Set the exclusive font for Pinyin text (monospace recommended, leave empty for default)",
    optTransSettings: "Translation Settings", optTransDesc1: "Double-click selected text to show Mandarin and English translation",
    optTransDesc2: "Powered by Bing Translator (Native Cantonese support, no config)", optAISettings: "✨ AI Contextual Translation",
    optAIEnable: "Enable AI Translation", optAIEnableDesc: "Long press selected text for AI contextual explanation",
    optAIBaseUrlDesc: "OpenAI-compatible API endpoint", optAIModelLabel: "AI Model",
    optAIPromptLabel: "System Prompt", optFeedback: "About & Feedback", optDev: "Developer:",
    optFeedbackForm: "Feedback", optEmail: "Email (Optional)", optMsg: "Tell us your suggestions or issues...",
    optSend: "Send Feedback", optSending: "Sending...", optSent: "Sent!",
    optModelName: "Model Name", optTestAI: " Test AI Connection", optTTSSettings: "Speech Settings (TTS)",
    optClickToSpeak: "Click to Speak", optClickToSpeakDesc: "Click highlighted text to read Cantonese pronunciation", optTTSEngine: "Speech Engine",
    optTTSEngineDesc: "Select TTS provider", optEdgeSettings: "Edge TTS Settings",
    optEdgeSettingsDesc: "Select default server or custom URL", optAzureSettings: "Azure Speech Settings",
    optAzureSettingsDesc: "Select default API or custom key", optVoice: "Voice Tone", optSpeed: "Speech Rate",
    optTestTTS: " Test Voice", optFeedbackTitle: "💡 Feedback & Suggestions", optFeedbackDesc: "If you have any suggestions or encounter bugs, please tell me here, or email me at ousinki@outlook.com!",
    optNameLabel: "Your Name", optOptional: "(Optional)", optNamePlaceholder: "How should we call you?",
    optEmailLabel: "Email Address", optEmailPlaceholder: "your@email.com (For replying)",
    optFeedbackLabel: "Feedback Content", optFeedbackPlaceholder: "Please describe your suggestions or issues...",
        optFooterData: "Data Source:", optFooterLicense: "License:",
    optThemeClassic: "Classic", optThemeHK: "Hong Kong Red", optThemeDark: "Deep Night", optThemeInk: "Ink",
    optThemeOcean: "Ocean Blue", optThemeWarm: "Warm Sun", optThemeMint: "Mint Green", optThemeGlass: "Frosted Glass",
    optDefaultServer: "Default Server (No config)", optCustomUrl: "Custom URL",
    optDefaultAPI: "Default API (No config)", optCustomKey: "Custom Key (Direct to Azure)",
    optEngineAzure: "Azure Speech (Official Cloud TTS)", optEngineBert: "Bert-VITS2 (Neural Cantonese TTS)",
    optVoice1: "HiuMaan (Female) ⭐⭐⭐⭐⭐ · Latency ~1s",
    optVoice2: "HiuGaai (Female) ⭐⭐⭐⭐⭐ · Latency ~1s",
    optVoice3: "WanLung (Male) ⭐⭐⭐⭐⭐ · Latency ~1s",
    optAITip1: "Common: OpenAI",
    optAITip2: "DeepSeek",
    optAITip3: "Ollama",
    optPlaying: "Playing...",
    optTestingAI: "Testing...",
    optSuccess: "✅ Connection Successful!\nModel replied: ",
    optFail: "❌ Connection Failed: ",
    optNoReply: "(No reply)",
    optGreeting: "Hello, welcome to Jyutping Dictionary",
    clTitle: "🚀 What's New",
    clDesc: "This update brings the following improvements:",
    clItem1: "🚩 Quick Error Report: Hover over a word, move to the gear icon to reveal the \"Report\" button, and submit pronunciation or definition errors directly from the popup.",
    clItem2: "🔄 Dictionary Cache Fix: Fixed an issue where the browser loaded outdated dictionary data after updates."
  }
};

function t(key) {
  const lang = document.getElementById('langToggle') ? document.getElementById('langToggle').value : 'zh-HK';
  const dict = i18nDict[lang] || i18nDict["zh-HK"];
  return dict[key] || key;
}

function applyI18n(lang) {
  const dict = i18nDict[lang] || i18nDict["zh-HK"];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = dict[key];
      } else {
        // preserve child nodes like svgs if any by just setting text node?
        // Actually mostly it's simple text. For buttons with svg we need care.
        if (el.children.length > 0) {
            // Find the text node and replace it
            for (let child of el.childNodes) {
                if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim().length > 0) {
                    child.nodeValue = dict[key];
                    break;
                }
            }
        } else {
            el.innerHTML = dict[key];
        }
      }
    }
  });
}

  // Get saved language or default
  chrome.storage.local.get(['uiLang'], (res) => {
    const lang = res.uiLang || 'zh-HK';
    document.getElementById('langToggle').value = lang;
    applyI18n(lang);
  });

  document.getElementById('langToggle').addEventListener('change', (e) => {
    const lang = e.target.value;
    chrome.storage.local.set({ uiLang: lang, extensionLang: lang });
    applyI18n(lang);
    // Also refresh dynamically generated buttons
    if (typeof resetTestButton === 'function') resetTestButton();
    if (typeof resetAiTestButton === 'function') resetAiTestButton();
  });


  const enabledToggle = document.getElementById('enabledToggle');
  const displayModeSelect = document.getElementById('displayMode');
  const popupThemeSelect = document.getElementById('popupTheme');
  
  // 字體設定
  const zhFontSelect = document.getElementById('zhFontSelect');
  const customZhFontInput = document.getElementById('customZhFont');
  const enFontSelect = document.getElementById('enFontSelect');
  const customEnFontInput = document.getElementById('customEnFont');

  const ttsEnabledToggle = document.getElementById('ttsEnabledToggle');
  const ttsEngineSelect = document.getElementById('ttsEngine');
  const edgeTtsSettings = document.getElementById('edgeTtsSettings');
  const edgeTtsModeSelect = document.getElementById('edgeTtsMode');
  const edgeCustomSettings = document.getElementById('edgeCustomSettings');
  const edgeTtsUrlInput = document.getElementById('edgeTtsUrl');
  const azureTtsSettings = document.getElementById('azureTtsSettings');
  const azureTtsModeSelect = document.getElementById('azureTtsMode');
  const azureCustomSettings = document.getElementById('azureCustomSettings');
  const azureTtsKeyInput = document.getElementById('azureTtsKey');
  const azureTtsRegionInput = document.getElementById('azureTtsRegion');
  const azureTtsVoiceSelect = document.getElementById('azureTtsVoice');
  const ttsRateSlider = document.getElementById('ttsRate');
  const ttsRateValue = document.getElementById('ttsRateValue');
  const testTtsBtn = document.getElementById('testTtsBtn');

  // AI 翻譯設定
  const aiEnabledToggle = document.getElementById('aiEnabledToggle');
  const aiSettings = document.getElementById('aiSettings');
  const aiBaseUrlInput = document.getElementById('aiBaseUrl');
  const aiApiKeyInput = document.getElementById('aiApiKey');
  const aiModelInput = document.getElementById('aiModel');
  const testAiBtn = document.getElementById('testAiBtn');


  // 主題預覽配色數據
  const THEME_PREVIEW = {
    classic: { bg: '#ffffff', border: '#d0d0d0', text: '#333', word: '#1a1a1a', accent: '#2196f3', def: '#555', yue: '#b8860b', divider: '#eee', shadow: '0 2px 8px rgba(0,0,0,0.1)' },
    academic: { bg: '#ffeaeb', border: '#fba5a8', text: '#8A1C1C', word: '#610c0c', accent: '#D83131', def: '#8A1C1C', yue: '#D83131', divider: '#fccacc', shadow: '0 4px 12px rgba(138,28,28,0.2)' },
    night:   { bg: '#1a1a2e', border: '#16213e', text: '#e0e0e0', word: '#f0f0ff', accent: '#7c8cf8', def: '#c0c0d0', yue: '#e8b84e', divider: '#2a2a40', shadow: '0 2px 12px rgba(0,0,0,0.4)' },
    ink:     { bg: '#2d2d2d', border: '#444', text: '#e0e0e0', word: '#f0f0f0', accent: '#64b5f6', def: '#ccc', yue: '#daa520', divider: '#3d3d3d', shadow: '0 2px 12px rgba(0,0,0,0.4)' },
    ocean:   { bg: '#e3f2fd', border: '#90caf9', text: '#1565c0', word: '#0d47a1', accent: '#0d47a1', def: '#1976d2', yue: '#e65100', divider: '#bbdefb', shadow: '0 2px 8px rgba(21,101,192,0.2)' },
    warm:    { bg: '#fff8e1', border: '#ffe082', text: '#5d4037', word: '#3e2723', accent: '#e65100', def: '#6d4c41', yue: '#c62828', divider: '#ffe0b2', shadow: '0 2px 8px rgba(230,81,0,0.15)' },
    mint:    { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32', word: '#1b5e20', accent: '#1b5e20', def: '#388e3c', yue: '#bf360c', divider: '#c8e6c9', shadow: '0 2px 8px rgba(46,125,50,0.2)' },
    glass:   { bg: 'rgba(255,255,255,0.78)', border: 'rgba(255,255,255,0.3)', text: '#333', word: '#1a1a1a', accent: '#2196f3', def: '#444', yue: '#b8860b', divider: 'rgba(0,0,0,0.08)', shadow: '0 4px 16px rgba(0,0,0,0.12)', glass: true },
  };

  // 更新主題預覽
  function updateThemePreview(themeName) {
    const t = THEME_PREVIEW[themeName] || THEME_PREVIEW.classic;
    const preview = document.getElementById('themePreview');
    if (!preview) return;
    preview.style.background = t.bg;
    preview.style.borderColor = t.border;
    preview.style.color = t.text;
    preview.style.boxShadow = t.shadow;
    if (t.glass) {
      preview.style.backdropFilter = 'blur(16px) saturate(180%)';
    } else {
      preview.style.backdropFilter = 'none';
    }
    const header = document.getElementById('previewHeader');
    if (header) header.style.borderBottomColor = t.divider;
    const word = document.getElementById('previewWord');
    if (word) word.style.color = t.word;
    const pinyin = document.getElementById('previewPinyin');
    if (pinyin) pinyin.style.color = t.accent;
    const def = document.getElementById('previewDef');
    if (def) def.style.color = t.def;
    const yue = document.getElementById('previewYue');
    if (yue) yue.style.color = t.yue;
  }

  // 更新預覽字體
  function updatePreviewFont(type, font) {
    const preview = document.getElementById('themePreview');
    if (!preview) return;
    if (type === 'zh') {
      preview.style.setProperty('--popup-font-zh', font || 'system-ui, -apple-system, sans-serif');
    } else if (type === 'en') {
      preview.style.setProperty('--popup-font-en', font || '"Courier New", monospace');
    }
  }

  // 載入已保存的設定
  chrome.storage.sync.get([
    'enabled', 'displayMode', 'popupTheme', 'customZhFont', 'customEnFont', 'ttsEnabled', 
    'ttsEngine', 'edgeTtsMode', 'edgeTtsUrl', 'azureTtsMode', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'ttsRate'
  ], (result) => {
    enabledToggle.checked = result.enabled !== false;
    displayModeSelect.value = result.displayMode || 'jyutping';
    
    const theme = result.popupTheme || 'classic';
    popupThemeSelect.value = theme;
    updateThemePreview(theme);
    
    const setupFontUI = (selectElem, inputElem, savedValue) => {
      let matchFound = false;
      const valueToCheck = savedValue || '';
      for (let i = 0; i < selectElem.options.length; i++) {
        if (selectElem.options[i].value === valueToCheck) {
          matchFound = true;
          break;
        }
      }

      if (matchFound) {
        selectElem.value = valueToCheck;
        inputElem.style.display = 'none';
        inputElem.value = valueToCheck;
      } else {
        selectElem.value = 'custom';
        inputElem.style.display = 'block';
        inputElem.value = valueToCheck;
      }
    };

    const finishSetup = () => {
      setupFontUI(zhFontSelect, customZhFontInput, result.customZhFont);
      setupFontUI(enFontSelect, customEnFontInput, result.customEnFont);
      updatePreviewFont('zh', result.customZhFont);
      updatePreviewFont('en', result.customEnFont);
    };

    if (chrome.fontSettings && chrome.fontSettings.getFontList) {
      chrome.fontSettings.getFontList((fonts) => {
        const createGroup = (isEn) => {
          const group = document.createElement('optgroup');
          group.label = "--- 本地已安裝字體 ---";
          fonts.forEach(font => {
            const option = document.createElement('option');
            option.value = `'${font.fontId}', ${isEn ? 'monospace' : 'sans-serif'}`;
            option.textContent = font.displayName || font.fontId;
            group.appendChild(option);
          });
          return group;
        };

        const customZhOpt = Array.from(zhFontSelect.options).find(opt => opt.value === 'custom');
        zhFontSelect.insertBefore(createGroup(false), customZhOpt);

        const customEnOpt = Array.from(enFontSelect.options).find(opt => opt.value === 'custom');
        enFontSelect.insertBefore(createGroup(true), customEnOpt);

        finishSetup();
      });
    } else {
      finishSetup();
    }

    ttsEnabledToggle.checked = result.ttsEnabled !== false;
    
    const engine = result.ttsEngine || 'webSpeech';
    ttsEngineSelect.value = engine;
    updateEngineUI(engine);
    
    const edgeMode = result.edgeTtsMode || 'default';
    edgeTtsModeSelect.value = edgeMode;
    updateEdgeModeUI(edgeMode);
    edgeTtsUrlInput.value = result.edgeTtsUrl || '';
    
    const azureMode = result.azureTtsMode || 'default';
    azureTtsModeSelect.value = azureMode;
    updateAzureModeUI(azureMode);
    azureTtsKeyInput.value = result.azureTtsKey || '';
    azureTtsRegionInput.value = result.azureTtsRegion || '';
    azureTtsVoiceSelect.value = result.azureTtsVoice || 'zh-HK-HiuMaanNeural';
    
    const rate = result.ttsRate || 0.9;
    ttsRateSlider.value = rate;
    ttsRateValue.textContent = rate + 'x';
  });

  // AI 設定用 local storage（避免 sync 配額不足）
  chrome.storage.local.get(['aiEnabled', 'aiBaseUrl', 'aiApiKey', 'aiModel'], (result) => {
    aiEnabledToggle.checked = result.aiEnabled === true;
    aiSettings.style.display = result.aiEnabled ? 'block' : 'none';
    aiBaseUrlInput.value = result.aiBaseUrl || '';
    aiApiKeyInput.value = result.aiApiKey || '';
    aiModelInput.value = result.aiModel || '';
  });

  // 更新引擎相關 UI
  function updateEngineUI(engine) {
    edgeTtsSettings.style.display = engine === 'edgeTts' ? 'flex' : 'none';
    azureTtsSettings.style.display = engine === 'azureTts' ? 'flex' : 'none';
  }

  // 更新 Azure 模式 UI
  function updateAzureModeUI(mode) {
    azureCustomSettings.style.display = mode === 'custom' ? 'block' : 'none';
  }

  // 更新 Edge TTS 模式 UI
  function updateEdgeModeUI(mode) {
    edgeCustomSettings.style.display = mode === 'custom' ? 'block' : 'none';
  }

  // 監聽詞典開關
  enabledToggle.addEventListener('change', () => {
    const enabled = enabledToggle.checked;
    chrome.storage.sync.set({ enabled });
    GoogleAnalytics.fireEvent('change_setting', { setting: 'enabled', value: enabled });
    notifyContentScripts({ action: 'toggleEnabled', enabled });
  });

  // 監聽顯示模式切換
  displayModeSelect.addEventListener('change', () => {
    const mode = displayModeSelect.value;
    chrome.storage.sync.set({ displayMode: mode });
    GoogleAnalytics.fireEvent('change_setting', { setting: 'displayMode', value: mode });
    notifyContentScripts({ action: 'changeDisplayMode', mode });
  });

  // 監聽主題切換
  popupThemeSelect.addEventListener('change', () => {
    const theme = popupThemeSelect.value;
    chrome.storage.sync.set({ popupTheme: theme });
    GoogleAnalytics.fireEvent('change_setting', { setting: 'popupTheme', value: theme });
    updateThemePreview(theme);
    notifyContentScripts({ action: 'changePopupTheme', theme });
  });

  // 監聽中文字體下拉選單
  zhFontSelect.addEventListener('change', () => {
    if (zhFontSelect.value === 'custom') {
      customZhFontInput.style.display = 'block';
      customZhFontInput.focus();
    } else {
      customZhFontInput.style.display = 'none';
      customZhFontInput.value = zhFontSelect.value;
      const font = zhFontSelect.value;
      chrome.storage.sync.set({ customZhFont: font });
      updatePreviewFont('zh', font);
      notifyContentScripts({ action: 'changeCustomFont', customZhFont: font });
    }
  });

  // 監聽中文字體自定義輸入
  customZhFontInput.addEventListener('input', () => {
    if (zhFontSelect.value === 'custom') {
      const font = customZhFontInput.value.trim();
      chrome.storage.sync.set({ customZhFont: font });
      updatePreviewFont('zh', font);
      notifyContentScripts({ action: 'changeCustomFont', customZhFont: font });
    }
  });

  // 監聽英文字體下拉選單
  enFontSelect.addEventListener('change', () => {
    if (enFontSelect.value === 'custom') {
      customEnFontInput.style.display = 'block';
      customEnFontInput.focus();
    } else {
      customEnFontInput.style.display = 'none';
      customEnFontInput.value = enFontSelect.value;
      const font = enFontSelect.value;
      chrome.storage.sync.set({ customEnFont: font });
      updatePreviewFont('en', font);
      notifyContentScripts({ action: 'changeCustomFont', customEnFont: font });
    }
  });

  // 監聽英文字體自定義輸入
  customEnFontInput.addEventListener('input', () => {
    if (enFontSelect.value === 'custom') {
      const font = customEnFontInput.value.trim();
      chrome.storage.sync.set({ customEnFont: font });
      updatePreviewFont('en', font);
      notifyContentScripts({ action: 'changeCustomFont', customEnFont: font });
    }
  });

  // 監聽 TTS 開關
  ttsEnabledToggle.addEventListener('change', () => {
    const ttsEnabled = ttsEnabledToggle.checked;
    chrome.storage.sync.set({ ttsEnabled });
    notifyContentScripts({ action: 'changeTtsEnabled', ttsEnabled });
  });

  // 監聽 TTS 引擎切換
  ttsEngineSelect.addEventListener('change', () => {
    const engine = ttsEngineSelect.value;
    chrome.storage.sync.set({ ttsEngine: engine });
    GoogleAnalytics.fireEvent('change_setting', { setting: 'ttsEngine', value: engine });
    updateEngineUI(engine);
    notifyContentScripts({ action: 'changeTtsEngine', ttsEngine: engine });
  });

  // 監聽 Edge TTS URL 變更
  edgeTtsUrlInput.addEventListener('change', () => {
    const url = edgeTtsUrlInput.value.trim();
    chrome.storage.sync.set({ edgeTtsUrl: url });
    notifyContentScripts({ action: 'changeEdgeTtsUrl', edgeTtsUrl: url });
  });

  // 監聽 Edge TTS 模式切換
  edgeTtsModeSelect.addEventListener('change', () => {
    const mode = edgeTtsModeSelect.value;
    chrome.storage.sync.set({ edgeTtsMode: mode });
    updateEdgeModeUI(mode);
    notifyContentScripts({ action: 'changeEdgeTtsMode', edgeTtsMode: mode });
  });

  // 監聽 Azure TTS 設定變更
  azureTtsKeyInput.addEventListener('change', () => {
    const key = azureTtsKeyInput.value.trim();
    chrome.storage.sync.set({ azureTtsKey: key });
    notifyContentScripts({ action: 'changeAzureTtsKey', azureTtsKey: key });
  });

  azureTtsRegionInput.addEventListener('change', () => {
    const region = azureTtsRegionInput.value.trim();
    chrome.storage.sync.set({ azureTtsRegion: region });
    notifyContentScripts({ action: 'changeAzureTtsRegion', azureTtsRegion: region });
  });

  // 監聽 Azure TTS 模式切換
  azureTtsModeSelect.addEventListener('change', () => {
    const mode = azureTtsModeSelect.value;
    chrome.storage.sync.set({ azureTtsMode: mode });
    updateAzureModeUI(mode);
    notifyContentScripts({ action: 'changeAzureTtsMode', azureTtsMode: mode });
  });

  // 監聽 Azure TTS 音色切換
  azureTtsVoiceSelect.addEventListener('change', () => {
    const voice = azureTtsVoiceSelect.value;
    chrome.storage.sync.set({ azureTtsVoice: voice });
    notifyContentScripts({ action: 'changeAzureTtsVoice', azureTtsVoice: voice });
  });

  // 監聽語速調整
  ttsRateSlider.addEventListener('input', () => {
    const rate = parseFloat(ttsRateSlider.value);
    ttsRateValue.textContent = rate + 'x';
    chrome.storage.sync.set({ ttsRate: rate });
    notifyContentScripts({ action: 'changeTtsRate', ttsRate: rate });
  });

  // === AI 翻譯設定 ===

  // AI 開關
  aiEnabledToggle.addEventListener('change', () => {
    const aiEnabled = aiEnabledToggle.checked;
    chrome.storage.local.set({ aiEnabled });
    aiSettings.style.display = aiEnabled ? 'block' : 'none';
    notifyContentScripts({ action: 'changeAiEnabled', aiEnabled });
  });

  // AI Base URL 變更
  aiBaseUrlInput.addEventListener('change', () => {
    const url = aiBaseUrlInput.value.trim();
    chrome.storage.local.set({ aiBaseUrl: url });
    notifyContentScripts({ action: 'changeAiBaseUrl', aiBaseUrl: url });
  });

  // AI API Key 變更
  aiApiKeyInput.addEventListener('change', () => {
    const key = aiApiKeyInput.value.trim();
    chrome.storage.local.set({ aiApiKey: key });
    notifyContentScripts({ action: 'changeAiApiKey', aiApiKey: key });
  });

  // Toggle API Key Visibility
  const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
  const eyeIconShow = document.getElementById('eyeIconShow');
  const eyeIconHide = document.getElementById('eyeIconHide');
  if (toggleApiKeyBtn && eyeIconShow && eyeIconHide) {
    toggleApiKeyBtn.addEventListener('click', () => {
      if (aiApiKeyInput.type === 'password') {
        aiApiKeyInput.type = 'text';
        eyeIconShow.style.display = 'none';
        eyeIconHide.style.display = 'block';
      } else {
        aiApiKeyInput.type = 'password';
        eyeIconShow.style.display = 'block';
        eyeIconHide.style.display = 'none';
      }
    });
  }

  // AI 模型變更
  aiModelInput.addEventListener('change', () => {
    const model = aiModelInput.value.trim();
    chrome.storage.local.set({ aiModel: model });
    notifyContentScripts({ action: 'changeAiModel', aiModel: model });
  });

  // 測試 AI 連接
  testAiBtn.addEventListener('click', async () => {
    const baseUrl = aiBaseUrlInput.value.trim();
    const apiKey = aiApiKeyInput.value.trim();
    const model = aiModelInput.value.trim();

    if (!baseUrl || !apiKey || !model) {
      alert('請先填寫 API Base URL、API Key 和模型名稱');
      return;
    }

    testAiBtn.disabled = true;
    testAiBtn.textContent = t('optTestingAI');

    try {
      const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 20
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API 錯誤 (${response.status}): ${errText.substring(0, 100)}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || t('optNoReply');
      alert(`${t('optSuccess')}${reply}`);
    } catch (error) {
      alert(`${t('optFail')}${error.message}`);
    }

    testAiBtn.disabled = false;
    testAiBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
      </svg>
      ${t('optTestAI')}
    `;
  });

  // 測試 TTS 按鈕
  testTtsBtn.addEventListener('click', async () => {
    const engine = ttsEngineSelect.value;
    const rate = parseFloat(ttsRateSlider.value);
    const testText = '你好，歡迎使用粵語詞典';
    
    testTtsBtn.disabled = true;
    testTtsBtn.textContent = t('optPlaying');
    
    try {
      if (engine === 'webSpeech') {
        await speakWithWebSpeech(testText, rate);
      } else if (engine === 'chromeTts') {
        await speakWithChromeTts(testText, rate);
      } else if (engine === 'edgeTts') {
        await speakWithEdgeTts(testText, rate);
      } else if (engine === 'azureTts') {
        const azureMode = azureTtsModeSelect.value;
        const voice = azureTtsVoiceSelect.value;
        if (azureMode === 'custom') {
          await speakWithAzureTts(testText, rate, voice);
        } else {
          await speakWithAzureTtsProxy(testText, rate, voice);
        }
      } else if (engine === 'bertVits2') {
        await speakWithBertVits2(testText, rate);
      }
    } catch (error) {
      console.error('TTS error:', error);
      alert('語音播放失敗: ' + error.message);
    }
    
    resetTestButton();
  });

  // Web Speech API
  function speakWithWebSpeech(text, rate) {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-HK';
      utterance.rate = rate;
      
      const voices = speechSynthesis.getVoices();
      const cantoneseVoice = voices.find(v => 
        v.lang === 'zh-HK' || v.lang.startsWith('zh-HK')
      );
      if (cantoneseVoice) {
        utterance.voice = cantoneseVoice;
      }
      
      utterance.onend = resolve;
      utterance.onerror = (e) => reject(new Error(e.error));
      
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  }

  // Chrome TTS API
  function speakWithChromeTts(text, rate) {
    return new Promise((resolve, reject) => {
      chrome.tts.speak(text, {
        lang: 'zh-HK',
        rate: rate,
        onEvent: (event) => {
          if (event.type === 'end') resolve();
          if (event.type === 'error') reject(new Error(event.errorMessage));
        }
      });
    });
  }

  const EDGE_TTS_DEFAULT_URL = 'http://114.55.243.162:8090';

  // Edge TTS (via server - OpenAI compatible)
  async function speakWithEdgeTts(text, rate) {
    const edgeMode = edgeTtsModeSelect.value;
    const baseUrl = edgeMode === 'custom' ? edgeTtsUrlInput.value.trim() : EDGE_TTS_DEFAULT_URL;
    console.log('Edge TTS baseUrl:', baseUrl);
    if (!baseUrl) {
      throw new Error('請先設定 Edge TTS 伺服器地址');
    }
    
    // Use OpenAI-compatible endpoint
    const url = baseUrl.replace(/\/$/, '') + '/v1/audio/speech';
    console.log('Edge TTS full URL:', url); // Debug
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        voice: 'zh-HK-HiuMaanNeural', // 香港粵語女聲
        model: 'tts-1',
        speed: rate
      })
    });
    
    if (!response.ok) {
      throw new Error(`伺服器錯誤: ${response.status}`);
    }
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => reject(new Error('音頻播放失敗'));
      audio.play();
    });
  }

  // Azure Speech TTS (official Microsoft API)
  async function speakWithAzureTts(text, rate, voice) {
    const apiKey = azureTtsKeyInput.value.trim();
    const region = azureTtsRegionInput.value.trim();
    if (!apiKey || !region) {
      throw new Error('請先設定 Azure Speech API 金鑰和區域');
    }
    
    voice = voice || 'zh-HK-HiuMaanNeural';
    const ratePercent = Math.round((rate - 1) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
    
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-HK'>
      <voice name='${voice}'>
        <prosody rate='${rateStr}'>${text}</prosody>
      </voice>
    </speak>`;
    
    const response = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
        },
        body: ssml
      }
    );
    
    if (!response.ok) {
      throw new Error(`Azure TTS 錯誤: ${response.status}`);
    }
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => reject(new Error('音頻播放失敗'));
      audio.play();
    });
  }

  // Azure Speech TTS 代理模式（通過伺服器代理，密鑰在伺服器端）
  async function speakWithAzureTtsProxy(text, rate, voice) {
    const PROXY_URL = 'http://114.55.243.162:8090';
    
    const response = await fetch(`${PROXY_URL}/v1/azure/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        voice: voice || 'zh-HK-HiuMaanNeural',
        speed: rate
      })
    });
    
    if (!response.ok) {
      throw new Error(`Azure TTS 代理錯誤: ${response.status}`);
    }
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => reject(new Error('音頻播放失敗'));
      audio.play();
    });
  }

  // Bert-VITS2 (Hugging Face Gradio 4 API)
  async function speakWithBertVits2(text, rate = 1.0) {
    const BERT_VITS2_SPACE = 'https://naozumi0512-bert-vits2-cantonese-yue.hf.space';
    
    // Step 1: POST to /call/tts_fn to get event_id
    const callResponse = await fetch(`${BERT_VITS2_SPACE}/call/tts_fn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          text,                    // 1. 输入文本内容
          "MK妹 (mkmui)",          // 2. Speaker
          0.2,                     // 3. SDP Ratio
          0.5,                     // 4. Noise
          0.9,                     // 5. Noise_W
          1.0 / rate,              // 6. Length (speed) - Inverse of rate
          "ZH",                    // 7. Language
          null,                    // 8. Audio prompt
          text,                    // 9. Text prompt
          "Text prompt",           // 10. Prompt Mode
          "",                      // 11. 辅助文本
          0                        // 12. Weight
        ]
      })
    });
    
    if (!callResponse.ok) {
      throw new Error(`Bert-VITS2 API 錯誤: ${callResponse.status}`);
    }
    
    const callResult = await callResponse.json();
    const eventId = callResult.event_id;
    
    if (!eventId) {
      throw new Error('沒有收到 event_id');
    }
    
    // Step 2: Poll the event endpoint for result
    const resultResponse = await fetch(`${BERT_VITS2_SPACE}/call/tts_fn/${eventId}`);
    const resultText = await resultResponse.text();
    
    console.log('Bert-VITS2 raw response:', resultText); // Debug
    
    // Parse SSE response - look for audio path
    const lines = resultText.split('\n');
    let audioPath = null;
    
    for (const line of lines) {
      console.log('Parsing line:', line); // Debug
      if (line.startsWith('data:')) {
        const dataStr = line.substring(5).trim();
        console.log('Data string:', dataStr); // Debug
        try {
          const data = JSON.parse(dataStr);
          console.log('Parsed data:', data); // Debug
          
          // Try different positions in the array
          if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
              const item = data[i];
              console.log(`Item ${i}:`, item); // Debug
              if (item && typeof item === 'object') {
                if (item.path) {
                  audioPath = item.path;
                  break;
                } else if (item.url) {
                  audioPath = item.url;
                  break;
                } else if (item.name) {
                  // Sometimes it's stored as "name" instead of "path"
                  audioPath = item.name;
                  break;
                }
              }
            }
            if (audioPath) break;
          }
        } catch (e) {
          console.log('JSON parse error:', e.message); // Debug
        }
      }
    }
    
    if (!audioPath) {
      throw new Error('沒有收到音頻路徑');
    }
    
    // Step 3: Play the audio
    let audioUrl;
    if (audioPath.startsWith('http')) {
      audioUrl = audioPath;
    } else {
      audioUrl = `${BERT_VITS2_SPACE}/file=${audioPath}`;
    }
    
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      audio.onended = resolve;
      audio.onerror = () => reject(new Error('音頻播放失敗'));
      audio.play();
    });
  }

  // 重置測試按鈕
  function resetTestButton() {
    testTtsBtn.disabled = false;
    testTtsBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 9V15H7L12 20V4L7 9H3ZM16.5 12C16.5 10.23 15.48 8.71 14 7.97V16.02C15.48 15.29 16.5 13.77 16.5 12ZM14 3.23V5.29C16.89 6.15 19 8.83 19 12C19 15.17 16.89 17.85 14 18.71V20.77C18.01 19.86 21 16.28 21 12C21 7.72 18.01 4.14 14 3.23Z" fill="currentColor"/>
      </svg>
      ${t('optTestTTS')}
    `;
  }

  // 重置 AI 測試按鈕
  function resetAiTestButton() {
    testAiBtn.disabled = false;
    testAiBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
      </svg>
      ${t('optTestAI')}
    `;
  }

  // 通知所有 content scripts
  function notifyContentScripts(message) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      });
    });
  }

  // === 意見與反饋表單處理 ===
  const feedbackForm = document.getElementById('feedbackForm');
  const submitFeedbackBtn = document.getElementById('submitFeedbackBtn');
  const feedbackResult = document.getElementById('feedbackResult');

  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(feedbackForm);
      const originalHTML = submitFeedbackBtn.innerHTML;
      
      submitFeedbackBtn.innerHTML = `發送中...`;
      submitFeedbackBtn.disabled = true;
      submitFeedbackBtn.style.opacity = '0.7';
      feedbackResult.style.display = 'none';

      try {
        const response = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          body: formData
        });

        const data = await response.json();

        if (response.ok) {
          feedbackResult.textContent = "✅ 發送成功！非常感謝您的反饋！";
          feedbackResult.style.color = "var(--accent)";
          feedbackForm.reset();
        } else {
          feedbackResult.textContent = "❌ 發送失敗：" + data.message;
          feedbackResult.style.color = "var(--primary)";
        }
      } catch (error) {
        feedbackResult.textContent = "❌ 發生錯誤，請稍後再試。";
        feedbackResult.style.color = "var(--primary)";
      } finally {
        feedbackResult.style.display = 'block';
        submitFeedbackBtn.innerHTML = originalHTML;
        submitFeedbackBtn.disabled = false;
        submitFeedbackBtn.style.opacity = '1';
        
        // 5秒後隱藏提示
        setTimeout(() => {
          feedbackResult.style.display = 'none';
        }, 5000);
      }
    });
  }

  // === Changelog Notice Board Logic ===
  const currentVersion = chrome.runtime.getManifest().version;
  const changelogBoard = document.getElementById('changelogBoard');
  const closeChangelogBtn = document.getElementById('closeChangelogBtn');
  const changelogVersionBadge = document.getElementById('changelogVersionBadge');

  if (changelogBoard && closeChangelogBtn && changelogVersionBadge) {
    changelogVersionBadge.textContent = 'v' + currentVersion;

    chrome.storage.local.get(['lastSeenVersion'], (result) => {
      const lastSeenVersion = result.lastSeenVersion;

      if (lastSeenVersion !== currentVersion) {
        // Show board after a slight delay for smooth entry
        setTimeout(() => {
          changelogBoard.classList.add('show');
        }, 300);
      }
    });

    closeChangelogBtn.addEventListener('click', () => {
      changelogBoard.classList.remove('show');
      // Save the current version to storage so it doesn't show again
      chrome.storage.local.set({ lastSeenVersion: currentVersion });
    });
  }
});
