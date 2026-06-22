/**
 * 粵語懸浮詞典 - Options Script
 * 處理設定頁面的邏輯
 */

import GoogleAnalytics from './scripts/google-analytics.js';


// 立即應用主題，防止閃爍
function applyUITheme(theme) {
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

chrome.storage.sync.get(['uiTheme'], (res) => {
  applyUITheme(res.uiTheme || 'auto');
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  chrome.storage.sync.get(['uiTheme'], (res) => {
    if ((res.uiTheme || 'auto') === 'auto') {
      applyUITheme('auto');
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  GoogleAnalytics.trackPageView('Options Page', '/options.html');

const localeFolders = {
  'zh-HK': 'zh_TW',
  'zh-CN': 'zh_CN',
  'en': 'en',
  'ja': 'ja',
  'ko': 'ko'
};

let activeDict = {};

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
    console.error(`Failed to load ${lang} translations dynamically:`, err);
  }
}

function t(key) {
  return activeDict[key] || key;
}

async function applyI18n(lang) {
  await loadLanguage(lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (activeDict[key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = activeDict[key];
      } else {
        if (el.children.length > 0 && !key.startsWith('clItem') && key !== 'optCompactExpandBtn') {
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
  updateShortcutDesc(lang);
}

  // Get saved language or default
  chrome.storage.local.get(['uiLang'], async (res) => {
    const lang = res.uiLang || 'zh-HK';
    document.getElementById('langToggle').value = lang;
    await applyI18n(lang);
  });

  document.getElementById('langToggle').addEventListener('change', async (e) => {
    const lang = e.target.value;
    chrome.storage.local.set({ uiLang: lang, extensionLang: lang });
    await applyI18n(lang);
    // Also refresh dynamically generated buttons
    if (typeof resetTestButton === 'function') resetTestButton();
    if (typeof resetAiTestButton === 'function') resetAiTestButton();
  });



  const displayModeSelect = document.getElementById('displayMode');
  const hoverModifierSelect = document.getElementById('hoverModifier');
  const toneStyleToggle = document.getElementById('toneStyleToggle');
  const popupDisplayStyleSelect = document.getElementById('popupDisplayStyle');
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
  const aiLanguageSelect = document.getElementById('aiLanguage');
  const aiPromptInput = document.getElementById('aiPrompt');
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
    'enabled', 'displayMode', 'toneStyle', 'rubyRtBackground', 'hoverModifier', 'popupDisplayStyle', 'popupTheme', 'customZhFont', 'customEnFont', 'highlightStyle', 'compactExpandBtn', 'ttsEnabled', 
    'ttsEngine', 'edgeTtsMode', 'edgeTtsUrl', 'azureTtsMode', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'ttsRate'
  , 'toneDisplayStyle', 'rubyTextFont', 'rubyTextStyle', 'rubyTextOpacity', 'rubyDictionaryColor', 'transLangs', 'transTrigger', 'transHoverEngine', 'uiTheme', 'paragraphTransKey', 'paragraphTransMode', 'paragraphTransEngine' ], (result) => {

    // 總開關
    const isEnabled = result.enabled !== false;
    const enableToggle = document.getElementById('enableToggle');
    if (enableToggle) enableToggle.checked = isEnabled;
    document.body.classList.toggle('disabled', !isEnabled);

    // 其他設置
    document.getElementById('displayMode').value = result.displayMode || 'jyutping';
    document.getElementById('hoverModifier').value = result.hoverModifier || 'none';
    // 載入段落翻譯快捷鍵
    document.getElementById('paragraphTransKey').value = result.paragraphTransKey || 'shift';
    updateDemoParaKeyText(result.paragraphTransKey || 'shift');
    
    // 載入段落翻譯顯示方式
    const paraModeEl = document.getElementById('paragraphTransMode');
    if (paraModeEl) {
      paraModeEl.value = result.paragraphTransMode || 'below';
      updateDemoParaMode(result.paragraphTransMode || 'below');
    }
    
    const paraEngineRadios = document.querySelectorAll('input[name="paragraphTransEngineRadio"]');
    if (paraEngineRadios.length > 0) {
      const selectedValue = result.paragraphTransEngine || 'bing';
      paraEngineRadios.forEach(r => {
        r.checked = (r.value === selectedValue);
      });
    }
    
    document.getElementById('popupDisplayStyle').value = result.popupDisplayStyle || 'full';
    
    const rubyRtBackgroundSelect = document.getElementById('rubyRtBackgroundSelect');
    if (rubyRtBackgroundSelect) {
      // 兼容舊版布爾值
      let bgVal = result.rubyRtBackground;
      if (bgVal === true) bgVal = 'solid';
      else if (bgVal === false || !bgVal) bgVal = 'none';
      rubyRtBackgroundSelect.value = bgVal;
    }


    const updateThemeToggleUI = (theme) => {
      document.getElementById('themeLight')?.classList.toggle('active', theme === 'light');
      document.getElementById('themeDark')?.classList.toggle('active', theme === 'dark');
      document.getElementById('themeAuto')?.classList.toggle('active', theme === 'auto');
    };

    const currentTheme = result.uiTheme || 'auto';
    updateThemeToggleUI(currentTheme);

    ['light', 'dark', 'auto'].forEach(theme => {
      const btn = document.getElementById(`theme${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
      if (btn) {
        btn.addEventListener('click', () => {
          updateThemeToggleUI(theme);
          chrome.storage.sync.set({ uiTheme: theme });
          applyUITheme(theme);
          notifyContentScripts({ action: 'changeUITheme', theme });
        });
      }
    });



    const toneDisplayStyleSelect = document.getElementById('toneDisplayStyle');
    const rubyTextFontSelect = document.getElementById('rubyTextFontSelect');
    const rubyTextFontInput = document.getElementById('rubyTextFont');
    const rubyTextStyleSelect = document.getElementById('rubyTextStyle');
    const rubyTextOpacitySelect = document.getElementById('rubyTextOpacity');
    const rubyDictionaryColorSelect = document.getElementById('rubyDictionaryColor');
    const rubyTextOpacityContainer = document.getElementById('rubyTextOpacityContainer');
    const rubyDictionaryColorContainer = document.getElementById('rubyDictionaryColorContainer');
    const transLangsCheckboxes = document.querySelectorAll('input[name="transLangs"]');
    const transTriggerSelect = document.getElementById('transTriggerSelect');
    const transHoverEngineRadios = document.querySelectorAll('input[name="transHoverEngineRadio"]');

    if (toneDisplayStyleSelect) toneDisplayStyleSelect.value = result.toneDisplayStyle || 'normal';
    
    if (rubyTextFontSelect) {
      const savedFont = result.rubyTextFont || '';
      if (['', 'sans-serif', 'serif', 'Chiron Hei HK, sans-serif'].includes(savedFont)) {
        rubyTextFontSelect.value = savedFont;
        if (rubyTextFontInput) rubyTextFontInput.style.display = 'none';
      } else {
        rubyTextFontSelect.value = 'custom';
        if (rubyTextFontInput) {
          rubyTextFontInput.style.display = 'block';
          rubyTextFontInput.value = savedFont;
        }
      }
    }

    if (rubyTextStyleSelect) {
      const savedStyle = result.rubyTextStyle || 'default';
      rubyTextStyleSelect.value = savedStyle;
      updateRubyTextStyleUI(savedStyle);
    }

    if (rubyTextOpacitySelect) rubyTextOpacitySelect.value = result.rubyTextOpacity || '0.85';
    if (rubyDictionaryColorSelect) rubyDictionaryColorSelect.value = result.rubyDictionaryColor || '#999999';

    const savedTransLangs = result.transLangs || ['zh-Hans', 'en'];
    if (transLangsCheckboxes) {
      transLangsCheckboxes.forEach(cb => {
        cb.checked = savedTransLangs.includes(cb.value);
      });
      updateTransLangsDemo(savedTransLangs);
    }

    if (transTriggerSelect) {
      transTriggerSelect.value = result.transTrigger || 'dblclick';
      updateDemoTransTrigger(result.transTrigger || 'dblclick');
    }

    if (transHoverEngineRadios.length > 0) {
      const val = result.transHoverEngine || 'bing';
      transHoverEngineRadios.forEach(radio => {
        radio.checked = (radio.value === val);
      });
      if (typeof updateDemoTransHoverEngine === 'function') {
        updateDemoTransHoverEngine(val);
      }
    }

    displayModeSelect.value = result.displayMode || 'jyutping';
    if (toneStyleToggle) toneStyleToggle.checked = result.toneStyle !== 'inline'; // 預設為 'superscript'
    if (hoverModifierSelect) hoverModifierSelect.value = result.hoverModifier || 'none';
    popupDisplayStyleSelect.value = result.popupDisplayStyle || 'full';
    updateCompactDemoVisibility();
    updateDemoText();
    
    // 載入展開按鈕設定
    const compactExpandBtnToggle = document.getElementById('compactExpandBtnToggle');
    const demoCompactExpandBtn = document.getElementById('demoCompactExpandBtn');
    if (compactExpandBtnToggle) {
      compactExpandBtnToggle.checked = result.compactExpandBtn !== false;
      if (demoCompactExpandBtn) {
        demoCompactExpandBtn.style.display = compactExpandBtnToggle.checked ? 'inline-flex' : 'none';
      }
    }
    
    // 載入高亮樣式
    const savedHL = result.highlightStyle || 'yellow';
    const hlRadio = document.querySelector(`input[name="highlightStyle"][value="${savedHL}"]`);
    if (hlRadio) hlRadio.checked = true;
    
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
    
    let engine = result.ttsEngine || 'edgeTts';
    const engineExists = Array.from(ttsEngineSelect.options).some(opt => opt.value === engine);
    if (!engineExists) {
      engine = 'edgeTts';
      chrome.storage.sync.set({ ttsEngine: engine });
    }
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
  chrome.storage.local.get(['aiEnabled', 'aiBaseUrl', 'aiApiKey', 'aiModel', 'aiLanguage', 'aiPrompt'], (result) => {
    aiEnabledToggle.checked = result.aiEnabled === true;
    aiSettings.style.display = result.aiEnabled ? 'block' : 'none';
    aiBaseUrlInput.value = result.aiBaseUrl || '';
    aiApiKeyInput.value = result.aiApiKey || '';
    aiModelInput.value = result.aiModel || '';
    if (aiLanguageSelect) {
      aiLanguageSelect.value = result.aiLanguage || '繁體中文';
    }
    if (aiPromptInput) {
      aiPromptInput.value = result.aiPrompt || '';
    }
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

  // 監聽顯示模式切換
  displayModeSelect.addEventListener('change', () => {
    const mode = displayModeSelect.value;
    chrome.storage.sync.set({ displayMode: mode });
    GoogleAnalytics.fireEvent('change_setting', { setting: 'displayMode', value: mode });
    updateDemoText();
    notifyContentScripts({ action: 'changeDisplayMode', mode });
  });

  
  const toneDisplayStyleSelect = document.getElementById('toneDisplayStyle');
  const rubyTextFontSelect = document.getElementById('rubyTextFontSelect');
  const rubyTextFontInput = document.getElementById('rubyTextFont');
  const rubyTextStyleSelect = document.getElementById('rubyTextStyle');
  const rubyTextOpacitySelect = document.getElementById('rubyTextOpacity');
  const rubyDictionaryColorSelect = document.getElementById('rubyDictionaryColor');
  const transLangsCheckboxes = document.querySelectorAll('input[name="transLangs"]');
  const transTriggerSelect = document.getElementById('transTriggerSelect');
  const transHoverEngineRadios = document.querySelectorAll('input[name="transHoverEngineRadio"]');
  const modifyShortcutBtn = document.getElementById('modifyShortcutBtn');
  
  if (modifyShortcutBtn) {
    modifyShortcutBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }

  function updateTransLangsDemo(langs) {
    const rows = [
      document.getElementById('demoTransZhHans'),
      document.getElementById('demoTransEn'),
      document.getElementById('demoTransJa'),
      document.getElementById('demoTransKo')
    ];
    let foundFirst = false;
    rows.forEach(row => {
      if (!row) return;
      const langMap = {
        'demoTransZhHans': 'zh-Hans',
        'demoTransEn': 'en',
        'demoTransJa': 'ja',
        'demoTransKo': 'ko'
      };
      const lang = langMap[row.id];
      const isVisible = langs.includes(lang);
      row.style.display = isVisible ? 'flex' : 'none';
      
      row.classList.remove('demo-animating-row');
      if (isVisible && !foundFirst) {
        row.classList.add('demo-animating-row');
        foundFirst = true;
      }
    });
    
    // Manage demo state and restart animations to keep the 9-second loop perfectly synchronized
    const demoContainer = document.getElementById('translateDemoContainer');
    if (demoContainer) {
      if (langs.length === 0) {
        demoContainer.classList.add('demo-disabled');
      } else {
        demoContainer.classList.remove('demo-disabled');
        const animElements = demoContainer.querySelectorAll('.demo-selection, .demo-popup, .demo-cursor, .demo-ripple, .demo-ai-badge, .demo-ai-loading');
        animElements.forEach(el => {
          el.style.animation = 'none';
        });
        void demoContainer.offsetWidth; // trigger reflow
        animElements.forEach(el => {
          el.style.animation = '';
        });
      }
    }
  }

  function updateDemoTransHoverEngine(engine) {
    const popup = document.querySelector('.demo-popup');
    if (popup) {
      if (engine === 'ai') {
        popup.classList.remove('demo-engine-bing');
        popup.classList.add('demo-engine-ai');
      } else {
        popup.classList.remove('demo-engine-ai');
        popup.classList.add('demo-engine-bing');
      }
    }
    
    // Restart animations
    const demoContainer = document.getElementById('translateDemoContainer');
    if (demoContainer) {
      const animElements = demoContainer.querySelectorAll('.demo-selection, .demo-popup, .demo-cursor, .demo-ripple, .demo-ai-badge, .demo-ai-loading');
      animElements.forEach(el => {
        el.style.animation = 'none';
      });
      void demoContainer.offsetWidth; // trigger reflow
      animElements.forEach(el => {
        el.style.animation = '';
      });
    }
  }

  function updateDemoTransTrigger(trigger) {
    const demoContainer = document.getElementById('translateDemoContainer');
    if (demoContainer) {
      const animElements = demoContainer.querySelectorAll('.demo-selection, .demo-popup, .demo-cursor, .demo-ripple');
      animElements.forEach(el => el.style.animation = 'none');
      void demoContainer.offsetWidth;
      if (trigger === 'click') {
        demoContainer.classList.add('single-click-demo');
      } else {
        demoContainer.classList.remove('single-click-demo');
      }
      animElements.forEach(el => el.style.animation = '');
    }
  }

  if (transLangsCheckboxes) {
    transLangsCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const selected = Array.from(transLangsCheckboxes).filter(c => c.checked).map(c => c.value);
        chrome.storage.sync.set({ transLangs: selected });
        updateTransLangsDemo(selected);
        notifyContentScripts({ action: 'changeTransLangs', transLangs: selected });
      });
    });
  }

  if (transTriggerSelect) {
    transTriggerSelect.addEventListener('change', () => {
      const val = transTriggerSelect.value;
      chrome.storage.sync.set({ transTrigger: val });
      updateDemoTransTrigger(val);
      notifyContentScripts({ action: 'changeTransTrigger', transTrigger: val });
    });
  }

  if (transHoverEngineRadios.length > 0) {
    transHoverEngineRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          const val = e.target.value;
          chrome.storage.sync.set({ transHoverEngine: val });
          GoogleAnalytics.fireEvent('change_setting', { setting: 'transHoverEngine', value: val });
          notifyContentScripts({ action: 'changeTransHoverEngine', transHoverEngine: val });
          updateDemoTransHoverEngine(val);
        }
      });
    });
  }

  if (toneDisplayStyleSelect) {
    toneDisplayStyleSelect.addEventListener('change', () => {
      chrome.storage.sync.set({ toneDisplayStyle: toneDisplayStyleSelect.value });
      if (typeof updateInspectDemoTones === 'function') updateInspectDemoTones();
    });
  }

  if (rubyTextFontSelect) {
    rubyTextFontSelect.addEventListener('change', () => {
      if (rubyTextFontSelect.value === 'custom') {
        if (rubyTextFontInput) {
          rubyTextFontInput.style.display = 'block';
          rubyTextFontInput.focus();
        }
      } else {
        if (rubyTextFontInput) {
          rubyTextFontInput.style.display = 'none';
          rubyTextFontInput.value = rubyTextFontSelect.value;
        }
        chrome.storage.sync.set({ rubyTextFont: rubyTextFontSelect.value });
        if (typeof updateInspectDemoTones === 'function') updateInspectDemoTones();
      }
    });
  }

  if (rubyTextFontInput) {
    rubyTextFontInput.addEventListener('input', () => {
      chrome.storage.sync.set({ rubyTextFont: rubyTextFontInput.value });
      if (typeof updateInspectDemoTones === 'function') updateInspectDemoTones();
    });
  }

  if (rubyTextStyleSelect) {
    rubyTextStyleSelect.addEventListener('change', () => {
      const val = rubyTextStyleSelect.value;
      chrome.storage.sync.set({ rubyTextStyle: val });
      updateRubyTextStyleUI(val);
      if (typeof updateInspectDemoTones === 'function') updateInspectDemoTones();
    });
  }

  if (rubyTextOpacitySelect) {
    rubyTextOpacitySelect.addEventListener('change', () => {
      chrome.storage.sync.set({ rubyTextOpacity: rubyTextOpacitySelect.value });
      if (typeof updateInspectDemoTones === 'function') updateInspectDemoTones();
    });
  }

  if (rubyDictionaryColorSelect) {
    rubyDictionaryColorSelect.addEventListener('change', () => {
      chrome.storage.sync.set({ rubyDictionaryColor: rubyDictionaryColorSelect.value });
      if (typeof updateInspectDemoTones === 'function') updateInspectDemoTones();
    });
  }

  function updateRubyTextStyleUI(style) {
    const rubyTextOpacityContainer = document.getElementById('rubyTextOpacityContainer');
    const rubyDictionaryColorContainer = document.getElementById('rubyDictionaryColorContainer');
    if (style === 'dictionary') {
      if (rubyTextOpacityContainer) rubyTextOpacityContainer.style.display = 'none';
      if (rubyDictionaryColorContainer) rubyDictionaryColorContainer.style.display = '';
    } else {
      if (rubyTextOpacityContainer) rubyTextOpacityContainer.style.display = '';
      if (rubyDictionaryColorContainer) rubyDictionaryColorContainer.style.display = 'none';
    }
  }

  if (toneStyleToggle) {
    toneStyleToggle.addEventListener('change', () => {
      const style = toneStyleToggle.checked ? 'superscript' : 'inline';
      chrome.storage.sync.set({ toneStyle: style });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'toneStyle', value: style });
      updateDemoText();
      notifyContentScripts({ action: 'changeToneStyle', style });
    });
  }

  const rubyRtBackgroundSelect = document.getElementById('rubyRtBackgroundSelect');
  if (rubyRtBackgroundSelect) {
    rubyRtBackgroundSelect.addEventListener('change', () => {
      const val = rubyRtBackgroundSelect.value;
      chrome.storage.sync.set({ rubyRtBackground: val });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'rubyRtBackground', value: val });
      updateDemoText();
      notifyContentScripts({ action: 'changeRubyRtBackground', value: val });
    });
  }

  function updateDemoText() {
    const demoCompactText = document.getElementById('demoCompactText');
    if (demoCompactText) {
      let text = displayModeSelect.value === 'yale' ? 'tin1 hei3' : 'tin1 hei3'; // Default string with numbers
      if (toneStyleToggle && toneStyleToggle.checked) {
        text = text.replace(/(\d+)/g, '<sup class="jyutping-tone">$1</sup>');
      }
      demoCompactText.innerHTML = text;
    }
    
    // 同步更新 Ruby 演示動畫中的注音
    const rubyRts = document.querySelectorAll('.demo-ruby-rt');
    rubyRts.forEach(rt => {
      let text = rt.getAttribute('data-text');
      if (text) {
        if (toneStyleToggle && toneStyleToggle.checked) {
          text = text.replace(/(\d+)/g, '<sup class="jyutping-tone">$1</sup>');
        }
        rt.innerHTML = text;
      }
    });
    
    const rubyDemo = document.getElementById('rubyDemo');
    if (rubyDemo) {
      rubyDemo.classList.remove('with-bg', 'fade-bg');
      if (rubyRtBackgroundSelect) {
        const bgVal = rubyRtBackgroundSelect.value;
        if (bgVal === 'solid') rubyDemo.classList.add('with-bg');
        else if (bgVal === 'fade') rubyDemo.classList.add('fade-bg');
      }
    }
  }
  updateDemoText(); // Initialize on load

  if (hoverModifierSelect) {
    hoverModifierSelect.addEventListener('change', () => {
      const modifier = hoverModifierSelect.value;
      chrome.storage.sync.set({ hoverModifier: modifier });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'hoverModifier', value: modifier });
      notifyContentScripts({ action: 'changeHoverModifier', modifier });
    });
  }

  const paragraphTransKeySelect = document.getElementById('paragraphTransKey');
  if (paragraphTransKeySelect) {
    paragraphTransKeySelect.addEventListener('change', () => {
      const paragraphTransKey = paragraphTransKeySelect.value;
      chrome.storage.sync.set({ paragraphTransKey });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'paragraphTransKey', value: paragraphTransKey });
      updateDemoParaKeyText(paragraphTransKey);
      notifyContentScripts({ action: 'changeParagraphTransKey', paragraphTransKey });
    });
  }

  const paragraphTransModeSelect = document.getElementById('paragraphTransMode');
  if (paragraphTransModeSelect) {
    paragraphTransModeSelect.addEventListener('change', () => {
      const paragraphTransMode = paragraphTransModeSelect.value;
      chrome.storage.sync.set({ paragraphTransMode });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'paragraphTransMode', value: paragraphTransMode });
      updateDemoParaMode(paragraphTransMode);
      notifyContentScripts({ action: 'changeParagraphTransMode', paragraphTransMode });
    });
  }

  const paragraphTransEngineRadios = document.querySelectorAll('input[name="paragraphTransEngineRadio"]');
  paragraphTransEngineRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        const paragraphTransEngine = radio.value;
        chrome.storage.sync.set({ paragraphTransEngine });
        notifyContentScripts({ action: 'updateParagraphTransEngine', paragraphTransEngine });
        GoogleAnalytics.fireEvent('change_setting', { setting: 'paragraphTransEngine', value: paragraphTransEngine });
      }
    });
  });

  function updateDemoParaKeyText(val) {
    const keyEl = document.getElementById('demoParaKey');
    const demoParaDemo = document.getElementById('paraTransDemo');
    if (!keyEl) return;
    
    if (val === 'off') {
      if (demoParaDemo) demoParaDemo.style.opacity = '0.3';
      keyEl.textContent = 'Off';
      return;
    } else {
      if (demoParaDemo) demoParaDemo.style.opacity = '1';
    }

    const keyMap = {
      'alt': 'Alt ⌥',
      'ctrl': 'Ctrl ⌃',
      'shift': 'Shift ⇧',
      'meta': 'Cmd ⌘'
    };
    
    if (val === 'longpress') {
      keyEl.classList.remove('demo-para-key');
      keyEl.classList.add('demo-para-mouse');
      keyEl.style.background = 'transparent';
      keyEl.style.border = 'none';
      keyEl.style.boxShadow = 'none';
      keyEl.style.padding = '0';
      keyEl.innerHTML = `
        <svg width="26" height="38" viewBox="0 0 26 38" style="vertical-align: middle; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.08));">
          <rect x="3" y="4" width="20" height="30" rx="10" fill="#ffffff" stroke="none"/>
          <path class="demo-para-mouse-click" d="M 3 16 L 3 14 A 10 10 0 0 1 13 4 L 13 16 Z"/>
          <rect x="3" y="4" width="20" height="30" rx="10" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
          <line x1="3" y1="16" x2="23" y2="16" stroke="#94a3b8" stroke-width="1.5"/>
          <line x1="13" y1="4" x2="13" y2="16" stroke="#94a3b8" stroke-width="1.5"/>
          <rect x="12" y="7" width="2" height="6" rx="1" fill="#94a3b8"/>
        </svg>
      `;
    } else {
      keyEl.classList.remove('demo-para-mouse');
      keyEl.classList.add('demo-para-key');
      keyEl.style.background = '#fff';
      keyEl.style.border = '1px solid #d0d0d0';
      keyEl.style.borderBottom = '3px solid #b0b0b0';
      keyEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
      keyEl.style.padding = '4px 10px';
      keyEl.textContent = keyMap[val] || val;
    }

    if (demoParaDemo) {
      const animElements = demoParaDemo.querySelectorAll('.demo-para-cursor, .demo-para-translated, .demo-para-key, .demo-para-mouse, .demo-para-mouse-click, .demo-para-text-replace');
      animElements.forEach(el => el.style.animation = 'none');
      void demoParaDemo.offsetWidth; // trigger reflow
      animElements.forEach(el => el.style.animation = '');
    }
  }

  function updateDemoParaMode(mode) {
    const demoText = document.querySelector('.demo-para-text');
    const demoTrans = document.querySelector('.demo-para-translated');
    const demoParaDemo = document.getElementById('paraTransDemo');
    if (!demoText || !demoTrans) return;

    if (mode === 'replace') {
      demoText.classList.add('demo-para-text-replace');
      demoTrans.style.marginTop = '0';
      demoTrans.style.color = 'var(--text-primary)';
      demoTrans.style.fontSize = '15px';
      demoTrans.style.fontWeight = '500';
      demoTrans.style.position = 'absolute';
      demoTrans.style.top = '0';
      demoTrans.style.left = '0';
      demoTrans.style.width = '100%';
    } else {
      demoText.classList.remove('demo-para-text-replace');
      demoTrans.style.marginTop = '6px';
      demoTrans.style.color = '#888';
      demoTrans.style.fontSize = '14.5px';
      demoTrans.style.fontWeight = 'normal';
      demoTrans.style.position = 'static';
      demoTrans.style.top = 'auto';
      demoTrans.style.left = 'auto';
      demoTrans.style.width = 'auto';
    }

    if (demoParaDemo && document.getElementById('paragraphTransKey').value !== 'off') {
      const animElements = demoParaDemo.querySelectorAll('.demo-para-cursor, .demo-para-translated, .demo-para-key, .demo-para-mouse, .demo-para-mouse-click, .demo-para-text-replace');
      animElements.forEach(el => el.style.animation = 'none');
      void demoParaDemo.offsetWidth; // trigger reflow
      animElements.forEach(el => el.style.animation = '');
    }
  }

  // 監聽懸浮窗樣式切換
  const compactDemo = document.getElementById('compactDemo');
  const rubyDemo = document.getElementById('rubyDemo');
  const themeSection = document.getElementById('themeSection');
  const highlightStyleSection = document.getElementById('highlightStyleSection');
  const rubyHoverStyleSection = document.getElementById('rubyHoverStyleSection');
  function updateCompactDemoVisibility() {
    const isCompact = popupDisplayStyleSelect.value === 'compact';
    const isRuby = popupDisplayStyleSelect.value === 'ruby';
    const isFull = popupDisplayStyleSelect.value === 'full';
    
    if (compactDemo) compactDemo.style.display = isCompact ? 'flex' : 'none';
    if (rubyDemo) rubyDemo.style.display = isRuby ? 'flex' : 'none';
    if (themeSection) themeSection.style.display = isFull ? 'block' : 'none';
    if (highlightStyleSection) highlightStyleSection.style.display = isRuby ? 'none' : 'flex';
    if (rubyHoverStyleSection) rubyHoverStyleSection.style.display = isRuby ? 'flex' : 'none';
    
    const hoverModifierContainer = document.getElementById('hoverModifierContainer');
    if (hoverModifierContainer) {
      hoverModifierContainer.style.display = isFull ? 'flex' : 'none';
    }
    
    const compactSettingsContainer = document.getElementById('compactSettingsContainer');
    if (compactSettingsContainer) {
      compactSettingsContainer.style.display = (isCompact || isRuby) ? 'flex' : 'none';
      const expandBtnLabel = document.getElementById('compactExpandBtnToggle')?.parentElement;
      if (expandBtnLabel) {
        expandBtnLabel.style.display = isCompact ? 'inline-flex' : 'none';
      }
      const rubyRtBgLabel = document.getElementById('rubyRtBgLabel');
      if (rubyRtBgLabel) {
        rubyRtBgLabel.style.display = isRuby ? 'inline-flex' : 'none';
      }
    }
  }
  updateCompactDemoVisibility(); // 初始化

  popupDisplayStyleSelect.addEventListener('change', () => {
    const style = popupDisplayStyleSelect.value;
    chrome.storage.sync.set({ popupDisplayStyle: style });
    GoogleAnalytics.fireEvent('change_setting', { setting: 'popupDisplayStyle', value: style });
    updateCompactDemoVisibility();
    notifyContentScripts({ action: 'changePopupDisplayStyle', style });
  });

  // Ruby 懸停樣式選擇器
  const rubyHoverStylePicker = document.getElementById('rubyHoverStylePicker');
  const rubyHoverRadios = rubyHoverStylePicker ? rubyHoverStylePicker.querySelectorAll('input[name="rubyHoverStyle"]') : [];

  // Ruby Demo 動畫顏色映射
  const rubyHoverColors = {
    'ruby-red': '#8A1C1C',
    'ruby-blue': '#1565C0',
    'ruby-green': '#2E7D32',
    'ruby-orange': '#E65100',
    'ruby-purple': '#6A1B9A',
    'ruby-underline': '#8A1C1C',
    'ruby-border': '#8A1C1C',
  };

  function updateRubyDemoStyle(style) {
    const color = rubyHoverColors[style] || '#8A1C1C';
    const rubyDemoEl = document.getElementById('rubyDemo');
    if (!rubyDemoEl) return;
    
    rubyDemoEl.style.setProperty('--demo-ruby-color', color);
    rubyDemoEl.dataset.style = style;
  }

  // 初始化 rubyHoverStyle
  chrome.storage.sync.get(['rubyHoverStyle'], (result) => {
    const savedRubyStyle = result.rubyHoverStyle || 'ruby-red';
    rubyHoverRadios.forEach(radio => {
      if (radio.value === savedRubyStyle) radio.checked = true;
    });
    updateRubyDemoStyle(savedRubyStyle);
  });

  rubyHoverRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const style = radio.value;
      chrome.storage.sync.set({ rubyHoverStyle: style });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'rubyHoverStyle', value: style });
      updateRubyDemoStyle(style);
      notifyContentScripts({ action: 'changeHighlightStyle', style });
    });
  });

  // 展開按鈕開關
  const compactExpandBtnToggle = document.getElementById('compactExpandBtnToggle');
  const demoCompactExpandBtn = document.getElementById('demoCompactExpandBtn');
  if (compactExpandBtnToggle) {
    compactExpandBtnToggle.addEventListener('change', () => {
      const enabled = compactExpandBtnToggle.checked;
      chrome.storage.sync.set({ compactExpandBtn: enabled });
      if (demoCompactExpandBtn) {
        demoCompactExpandBtn.style.display = enabled ? 'inline-flex' : 'none';
      }
      GoogleAnalytics.fireEvent('change_setting', { setting: 'compactExpandBtn', value: enabled });
      notifyContentScripts({ action: 'changeCompactExpandBtn', enabled });
    });
  }

  if (compactDemo) {
    compactDemo.style.cursor = 'pointer';
    compactDemo.addEventListener('click', (e) => {
      e.stopPropagation();
      popupDisplayStyleSelect.value = 'full';
      popupDisplayStyleSelect.dispatchEvent(new Event('change'));
    });
  }

  // 高亮樣式選擇器
  const highlightStylePicker = document.getElementById('highlightStylePicker');
  const highlightRadios = highlightStylePicker ? highlightStylePicker.querySelectorAll('input[name="highlightStyle"]') : [];

  // 更新 Demo 高亮動畫顏色
  function updateDemoHighlightStyle(style) {
    const demoHL = document.querySelector('.demo-compact-highlight');
    if (!demoHL) return;
    // 重置所有樣式
    demoHL.style.background = '';
    demoHL.style.outline = '';
    demoHL.style.outlineOffset = '';
    demoHL.style.borderBottom = '';

    const colors = {
      yellow: 'rgba(255, 220, 80, 0.45)',
      blue: 'rgba(96, 165, 250, 0.35)',
      red: 'rgba(248, 113, 113, 0.35)',
      green: 'rgba(74, 222, 128, 0.35)',
      gray: 'rgba(156, 163, 175, 0.3)',
    };
    if (colors[style]) {
      demoHL.style.background = colors[style];
    } else if (style === 'underline-dashed') {
      demoHL.style.background = 'transparent';
      demoHL.style.borderBottom = '2px dashed #888';
      demoHL.style.height = '100%';
      demoHL.style.top = '0';
    } else if (style === 'border-dashed') {
      demoHL.style.background = 'transparent';
      demoHL.style.outline = '1.5px dashed #888';
      demoHL.style.outlineOffset = '2px';
    }
  }

  highlightRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const style = radio.value;
      chrome.storage.sync.set({ highlightStyle: style });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'highlightStyle', value: style });
      updateDemoHighlightStyle(style);
      notifyContentScripts({ action: 'changeHighlightStyle', style });
    });
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

  // AI 目標語言變更
  if (aiLanguageSelect) {
    aiLanguageSelect.addEventListener('change', () => {
      const lang = aiLanguageSelect.value;
      chrome.storage.local.set({ aiLanguage: lang });
      notifyContentScripts({ action: 'changeAiLanguage', aiLanguage: lang });
    });
  }

  // AI 提示詞變更
  if (aiPromptInput) {
    aiPromptInput.addEventListener('change', () => {
      const prompt = aiPromptInput.value.trim();
      chrome.storage.local.set({ aiPrompt: prompt });
      notifyContentScripts({ action: 'changeAiPrompt', aiPrompt: prompt });
    });
  }

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
      const targetLang = aiLanguageSelect ? aiLanguageSelect.value : '繁體中文';
      
      let promptTemplate = aiPromptInput ? aiPromptInput.value.trim() : '';
      if (!promptTemplate) {
        promptTemplate = t('optAIDefaultPrompt');
      }

      const sampleWord = "廣東話";
      const sampleSentence = "我哋平時講嘅廣東話，真係好得意。";

      const testPrompt = promptTemplate
        .replace(/{targetLang}/g, targetLang)
        .replace(/\${targetLang}/g, targetLang)
        .replace(/{word}/g, sampleWord)
        .replace(/\${word}/g, sampleWord)
        .replace(/{sentence}/g, sampleSentence)
        .replace(/\${sentence}/g, sampleSentence);
      
      const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 200
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API 錯誤 (${response.status}): ${errText.substring(0, 100)}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || t('optNoReply');
      
      const lang = document.getElementById('langToggle') ? document.getElementById('langToggle').value : 'zh-HK';
      const successTitle = {
        'zh-HK': '連接成功！',
        'zh-CN': '连接成功！',
        'en': 'Connection Successful!',
        'ja': '接続成功！',
        'ko': '연결 성공!'
      };
      const labels = {
        'zh-HK': { word: '測試字詞', sentence: '測試句子', reply: '模型回覆' },
        'zh-CN': { word: '测试字词', sentence: '测试句子', reply: '模型回复' },
        'en': { word: 'Test Word', sentence: 'Test Sentence', reply: 'Model Reply' },
        'ja': { word: 'テスト単語', sentence: 'テスト文', reply: 'モデルの返答' },
        'ko': { word: '테스트 단어', sentence: '테스트 문장', reply: '모델 응답' }
      };
      const title = successTitle[lang] || successTitle['zh-HK'];
      const label = labels[lang] || labels['zh-HK'];

      alert(`✅ ${title}\n\n${label.word}："${sampleWord}"\n${label.sentence}："${sampleSentence}"\n\n${label.reply}：\n${reply}`);
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

  // 更新動態快捷鍵提示資訊
  function updateShortcutDesc(lang) {
    const descEl = document.getElementById('inspectShortcutDesc');
    if (!descEl) return;

    if (chrome.commands && chrome.commands.getAll) {
      chrome.commands.getAll((commands) => {
        let currentShortcut = '';
        for (const cmd of commands) {
          if (cmd.name === 'inspect-ruby') {
            currentShortcut = cmd.shortcut;
            break;
          }
        }

        const prefix = activeDict['optInspectShortcutCurrent'] || '當前快捷鍵：';
        const hint = activeDict['optInspectShortcutModifyHint'] || '點擊右側按鈕修改或綁定。';
        const none = activeDict['optInspectShortcutNone'] || '未設定快捷鍵。';

        if (currentShortcut) {
          const formattedShortcut = currentShortcut.replace(/Command/g, '⌘').replace(/Ctrl/g, 'Ctrl');
          const separator = (lang === 'en' || lang === 'ko') ? '. ' : '。';
          descEl.innerHTML = `${prefix}<kbd>${formattedShortcut}</kbd>${separator}${hint}`;
        } else {
          const space = (lang === 'en' || lang === 'ko') ? ' ' : '';
          descEl.innerHTML = `${none}${space}${hint}`;
        }
      });
    } else {
      descEl.innerText = "";
    }
  }

  // 監聽視窗聚焦，當用戶從 chrome://extensions/shortcuts 返回時自動更新快捷鍵顯示
  window.addEventListener('focus', () => {
    const lang = document.getElementById('langToggle').value || 'zh-HK';
    updateShortcutDesc(lang);
  });

  // TOC Navigation Logic
  const tocLinks = document.querySelectorAll('.toc-list a');
  const sections = document.querySelectorAll('.settings-card[id]');

  // Smooth scroll
  tocLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        window.scrollTo({
          top: targetSection.offsetTop - 20, // offset for padding
          behavior: 'smooth'
        });
      }
    });
  });

  // IntersectionObserver to highlight active section
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -40% 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Remove active class from all links
        tocLinks.forEach(link => link.classList.remove('active'));
        // Add active class to corresponding link
        const id = entry.target.getAttribute('id');
        const activeLink = document.querySelector(`.toc-list a[href="#${id}"]`);
        if (activeLink) {
          activeLink.classList.add('active');
        }
      }
    });
  }, observerOptions);

  sections.forEach(section => {
    observer.observe(section);
  });
});
