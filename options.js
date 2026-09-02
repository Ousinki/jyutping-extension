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
  localStorage.setItem('jyutping_ui_theme', res.uiTheme || 'auto');
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
        if (el.children.length > 0 && !key.startsWith('clItem') && key !== 'optCompactExpandBtn' && key !== 'optTtsAccuracyDesc' && key !== 'optPopupDemoSentence') {
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
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (activeDict[key]) {
      el.setAttribute('title', activeDict[key]);
      if (el.hasAttribute('aria-label')) {
        el.setAttribute('aria-label', activeDict[key]);
      }
    }
  });
  document.querySelectorAll('select:not(.native-only)').forEach(select => {
    select.dispatchEvent(new Event('updateUI'));
  });
  if (typeof window.__updateFbUI === 'function') {
    window.__updateFbUI();
  }
  updateShortcutDesc(lang);
  updateTargetLangHints(lang);
  chrome.storage.sync.get(['paragraphTransDirection', 'yueDefDisplayMode'], (res) => {
    if (typeof updateParaTransDirectionUI === 'function') {
      updateParaTransDirectionUI(res.paragraphTransDirection || 'yue_to_target', lang);
    }
    if (typeof updateYueDefDemo === 'function') {
      updateYueDefDemo(lang, res.yueDefDisplayMode || 'expand');
    }
  });
}

  // Get saved language or default & purge legacy aiLanguage
  chrome.storage.local.remove(['aiLanguage']);
  chrome.storage.local.get(['uiLang'], async (res) => {
    const lang = res.uiLang || 'zh-HK';
    document.getElementById('langToggle').value = lang;
    await applyI18n(lang);
    updateTargetLangHints(lang);
  });

  document.getElementById('langToggle').addEventListener('change', async (e) => {
    const lang = e.target.value;
    chrome.storage.local.set({ uiLang: lang, extensionLang: lang });
    await applyI18n(lang);
    updateTargetLangHints(lang);
    chrome.storage.sync.get(['paragraphTransDirection', 'yueDefDisplayMode'], (res) => {
      updateParaTransDirectionUI(res.paragraphTransDirection || 'yue_to_target', lang);
      updateYueDefDemo(lang, res.yueDefDisplayMode || 'expand');
    });
    // Also refresh dynamically generated buttons
    if (typeof resetTestButton === 'function') resetTestButton();
    if (typeof resetAiTestButton === 'function') resetAiTestButton();
  });



  const displayModeSelect = document.getElementById('displayMode');
  const hoverModifierSelect = document.getElementById('hoverModifier');
  const popupDisplayStyleSelect = document.getElementById('popupDisplayStyle');
  const popupThemeModeSelect = document.getElementById('popupThemeMode');
  const manualThemeWrapper = document.getElementById('manualThemeWrapper');
  const multiThemeWrapper = document.getElementById('multiThemeWrapper');
  const popupThemeSelect = document.getElementById('popupTheme');
  const popupThemeDaySelect = document.getElementById('popupThemeDay');
  const popupThemeNightSelect = document.getElementById('popupThemeNight');
  const themeScheduleRow = document.getElementById('themeScheduleRow');
  const popupThemeDayStartInput = document.getElementById('popupThemeDayStart');
  const popupThemeNightStartInput = document.getElementById('popupThemeNightStart');
  const previewSunIcon = document.getElementById('previewSunIcon');
  const previewMoonIcon = document.getElementById('previewMoonIcon');
  
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
  const aiPromptInput = document.getElementById('aiPrompt');
  const testAiBtn = document.getElementById('testAiBtn');


  // 主題預覽配色數據 (與 content script 完全同步)
  const POPUP_THEMES = {
    classic: {
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
    },
    academic: {
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
    },
    night: {
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
    },
    ink: {
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
    },
    ocean: {
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
    },
    warm: {
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
      '--popup-divider': 'rgba(93, 64, 55, 0.12)',
      '--popup-divider-strong': '#ffe0b2',
      '--popup-example-bg': '#ffecb3',
      '--popup-btn-bg': '#ffe0b2',
      '--popup-btn-hover': '#ffe082',
      '--popup-btn-speaking': '#e65100',
      '--popup-btn-speaking-text': '#ffffff',
      '--popup-shadow': '0 4px 12px rgba(230, 81, 0, 0.15)',
      '--popup-active-bg': '#ffecb3',
    },
    mint: {
      '--popup-bg': '#e8f5e9',
      '--popup-border': '#a5d6a7',
      '--popup-text': '#2e7d32',
      '--popup-text-muted': '#66bb6a',
      '--popup-text-label': '#81c784',
      '--popup-accent': '#1b5e20',
      '--popup-accent-hover': '#2e7d32',
      '--popup-word-color': '#1b5e20',
      '--popup-def-color': '#388e3c',
      '--popup-def-yue': '#bf360c',
      '--popup-divider': 'rgba(46, 125, 50, 0.12)',
      '--popup-divider-strong': '#c8e6c9',
      '--popup-example-bg': '#c8e6c9',
      '--popup-btn-bg': '#c8e6c9',
      '--popup-btn-hover': '#a5d6a7',
      '--popup-btn-speaking': '#1b5e20',
      '--popup-btn-speaking-text': '#ffffff',
      '--popup-shadow': '0 4px 12px rgba(46, 125, 50, 0.2)',
      '--popup-active-bg': '#c8e6c9',
    },
    glass: {
      '--popup-bg': 'rgba(255, 255, 255, 0.78)',
      '--popup-border': 'rgba(255, 255, 255, 0.3)',
      '--popup-text': '#333333',
      '--popup-text-muted': '#666666',
      '--popup-text-label': '#888888',
      '--popup-accent': '#2196f3',
      '--popup-accent-hover': '#1976d2',
      '--popup-word-color': '#1a1a1a',
      '--popup-def-color': '#444444',
      '--popup-def-yue': '#b8860b',
      '--popup-divider': 'rgba(0, 0, 0, 0.08)',
      '--popup-divider-strong': 'rgba(0, 0, 0, 0.12)',
      '--popup-example-bg': 'rgba(240, 240, 240, 0.6)',
      '--popup-btn-bg': 'rgba(240, 240, 240, 0.6)',
      '--popup-btn-hover': 'rgba(220, 220, 220, 0.8)',
      '--popup-btn-speaking': '#2196f3',
      '--popup-btn-speaking-text': '#ffffff',
      '--popup-shadow': '0 4px 16px rgba(0, 0, 0, 0.12)',
      '--popup-active-bg': 'rgba(240, 247, 255, 0.7)',
    },
  };

  // 更新主題預覽
  function updateThemePreview(themeName) {
    const dict = document.getElementById('cantonese-popup-dict');
    if (!dict) return;
    const theme = POPUP_THEMES[themeName] || POPUP_THEMES.classic;
    for (const [key, value] of Object.entries(theme)) {
      dict.style.setProperty(key, value);
    }
    if (themeName === 'glass') {
      dict.classList.add('popup-theme-glass');
    } else {
      dict.classList.remove('popup-theme-glass');
    }
  }

  // 更新預覽字體
  function updatePreviewFont(type, font) {
    const dict = document.getElementById('cantonese-popup-dict');
    if (dict) {
      if (type === 'zh') {
        dict.style.setProperty('--popup-font-zh', font || 'system-ui, -apple-system, sans-serif');
      } else if (type === 'en') {
        dict.style.setProperty('--popup-font-en', font || 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace');
      }
    }
    if (typeof updateInspectDemoTones === 'function') {
      updateInspectDemoTones();
    }
  }

  // 模擬預覽彈窗的完整交互（整詞 TTS、單字發音、例句展開、釋義翻譯）
  function initThemePreviewInteractions() {
    const wordSec = document.getElementById('previewWordSection');
    const pinyinBtn = document.getElementById('previewPinyinBtn');
    const defItem = document.getElementById('previewDefItem');
    const badgeYue = document.getElementById('previewBadgeYue');
    const exampleTtsBtn = document.getElementById('previewExampleTtsBtn');
    const previewPopup = document.getElementById('cantonese-popup-dict');
    const previewExamples = document.getElementById('previewPopupExamples');
    const previewYue = document.getElementById('previewYue');

    // 1. 點擊詞頭：調用 TTS 朗讀整詞「你好」
    if (wordSec) {
      wordSec.addEventListener('click', () => {
        speakWithOptionsTTS('你好', wordSec);
      });
    }

    // 2. 點擊粵拼：調用單字發音音檔 (nei5, hou2)，逐字卡拉OK點亮
    if (pinyinBtn) {
      pinyinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playPreviewSyllables(['nei5', 'hou2'], pinyinBtn);
      });
    }

    // 3. 點擊粵語釋義：展開/收起右側具體例句 (320px <-> 640px)
    if (defItem) {
      defItem.addEventListener('click', (e) => {
        // 如果點擊的是 [粵 🌐] 徽章，不觸發例句折疊
        if (e.target.closest('#previewBadgeYue')) return;
        const arrowIcon = defItem.querySelector('.example-arrow-icon');
        const isExpanded = previewPopup && previewPopup.classList.contains('expanded-mode');
        if (isExpanded) {
          previewPopup.classList.remove('expanded-mode');
          previewPopup.style.width = '320px';
          defItem.classList.remove('active');
          if (previewExamples) previewExamples.style.display = 'none';
          if (arrowIcon) arrowIcon.textContent = ' ▷';
        } else {
          previewPopup.classList.add('expanded-mode');
          previewPopup.style.width = '640px';
          defItem.classList.add('active');
          if (previewExamples) previewExamples.style.display = 'block';
          if (arrowIcon) arrowIcon.textContent = ' ▽';
        }
      });
    }

    // 4. 點擊 [粵 🌐] 徽章：切換普通話翻譯
    if (badgeYue) {
      let isTranslated = false;
      const origText = '打招呼嘅問候語或者一般對話嘅開場白';
      const transText = '打招呼的问候语或一般对话的开场白';
      badgeYue.addEventListener('click', (e) => {
        e.stopPropagation();
        isTranslated = !isTranslated;
        if (previewYue) previewYue.textContent = isTranslated ? transText : origText;
        badgeYue.style.opacity = isTranslated ? '0.7' : '1';
      });
    }

    // 5. 點擊例句右側喇叭：朗讀例句「你好，我叫陳大文。」
    if (exampleTtsBtn) {
      exampleTtsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speakWithOptionsTTS('你好，我叫陳大文。', exampleTtsBtn);
      });
    }

    // 6. 點擊關聯詞（如 hi、嗨、hello、哈佬）：發音該詞
    if (previewPopup) {
      previewPopup.querySelectorAll('.see-also-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.stopPropagation();
          const word = link.dataset.word || link.textContent.trim();
          speakWithOptionsTTS(word, link);
        });
      });

      // 7. 點擊子詞候選面板單項（你好、你、好）
      const flyout = document.getElementById('previewSubwordsFlyout');
      if (flyout) {
        flyout.querySelectorAll('.subword-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            flyout.querySelectorAll('.subword-item').forEach(it => it.classList.remove('active'));
            item.classList.add('active');
            const word = item.dataset.word || item.textContent.trim();
            speakWithOptionsTTS(word, item);
          });
        });
      }
    }
  }

  // 輔助：調用當前配置的 TTS 引擎朗讀文本
  async function speakWithOptionsTTS(text, btn = null) {
    if (btn) btn.classList.add('speaking');
    const engine = ttsEngineSelect ? ttsEngineSelect.value : 'edgeTts';
    const rate = ttsRateSlider ? parseFloat(ttsRateSlider.value) : 1.0;
    try {
      if (engine === 'webSpeech') {
        await speakWithWebSpeech(text, rate);
      } else if (engine === 'chromeTts') {
        await speakWithChromeTts(text, rate);
      } else if (engine === 'edgeTts') {
        await speakWithEdgeTts(text, rate);
      } else if (engine === 'googleTts') {
        await speakWithGoogleTts(text, rate);
      } else if (engine === 'azureTts') {
        const voice = azureTtsVoiceSelect ? azureTtsVoiceSelect.value : 'zh-HK-HiuMaanNeural';
        await speakWithAzureTts(text, rate, voice);
      } else {
        await speakWithEdgeTts(text, rate);
      }
    } catch (err) {
      console.warn('TTS speak error, fallback to WebSpeech:', err);
      await speakWithWebSpeech(text, rate).catch(() => {});
    } finally {
      if (btn) btn.classList.remove('speaking');
    }
  }

  // 輔助：單字發音連續播放與音節點亮
  let previewAudioCtx = null;
  async function playPreviewSyllables(syllables, btn) {
    if (!btn) return;
    btn.classList.add('speaking');
    const sylEls = btn.querySelectorAll('.syllable-item');
    
    try {
      if (!previewAudioCtx) {
        previewAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (previewAudioCtx.state === 'suspended') {
        await previewAudioCtx.resume().catch(() => {});
      }
      for (let i = 0; i < syllables.length; i++) {
        const syl = syllables[i];
        const url = chrome.runtime.getURL(`audio/jyutping_female/${syl}.mp3`);
        sylEls.forEach((el, idx) => el.classList.toggle('speaking-active', idx === i));
        
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Audio file not found: ' + syl);
        const arrayBuffer = await resp.arrayBuffer();
        const audioBuffer = await previewAudioCtx.decodeAudioData(arrayBuffer);
        const source = previewAudioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(previewAudioCtx.destination);
        source.start();
        await new Promise(resolve => setTimeout(resolve, (audioBuffer.duration * 1000) / 1.15));
      }
    } catch (err) {
      console.warn('Preview syllable fallback to TTS:', err);
      await speakWithOptionsTTS('你好', btn);
    } finally {
      sylEls.forEach(el => el.classList.remove('speaking-active'));
      btn.classList.remove('speaking');
    }
  }

  // 初始化預覽交互事件
  initThemePreviewInteractions();

  chrome.storage.sync.get([
    'enabled', 'displayMode', 'toneStyle', 'rubyRtBackground', 'hoverModifier', 'popupDisplayStyle', 'popupTheme', 'popupThemeMode', 'popupThemeDay', 'popupThemeNight', 'popupThemeDayStart', 'popupThemeNightStart', 'customZhFont', 'customEnFont', 'highlightStyle', 'compactExpandBtn', 'ttsEnabled', 
    'ttsEngine', 'edgeTtsMode', 'edgeTtsUrl', 'azureTtsMode', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'ttsRate'
  , 'toneDisplayStyle', 'rubyTextFont', 'rubyTextStyle', 'rubyTextOpacity', 'rubyDictionaryColor', 'transLangs', 'transTrigger', 'transHoverEngine', 'uiTheme', 'paragraphTransKey', 'paragraphTransMode', 'paragraphTransEngine', 'paragraphTransDirection', 'enableAutoTranslateYueDefs', 'autoTranslateYueDefsTargetLang', 'autoTranslateYueDefsEngine', 'yueDefDisplayMode' ], (result) => {

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

    const curLang = document.getElementById('langToggle') ? document.getElementById('langToggle').value : 'zh-HK';
    updateParaTransDirectionUI(result.paragraphTransDirection || 'yue_to_target', curLang);
    
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
          localStorage.setItem('jyutping_ui_theme', theme);
          applyUITheme(theme);
          notifyContentScripts({ action: 'changeUITheme', theme });
        });
      }
    });

    // 跨頁面主題即時同步 (Roadmap / Wordbook <-> Options)
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.uiTheme) {
        const newTheme = changes.uiTheme.newValue || 'auto';
        localStorage.setItem('jyutping_ui_theme', newTheme);
        updateThemeToggleUI(newTheme);
        applyUITheme(newTheme);
      }
    });



    const toneDisplayStyleSelect = document.getElementById('toneDisplayStyle');
    const rubyTextStyleSelect = document.getElementById('rubyTextStyle');
    const rubyTextOpacitySelect = document.getElementById('rubyTextOpacity');
    const rubyDictionaryColorSelect = document.getElementById('rubyDictionaryColor');
    const rubyTextOpacityContainer = document.getElementById('rubyTextOpacityContainer');
    const rubyDictionaryColorContainer = document.getElementById('rubyDictionaryColorContainer');
    const transLangsCheckboxes = document.querySelectorAll('input[name="transLangs"]');
    const transTriggerSelect = document.getElementById('transTriggerSelect');
    const transHoverEngineRadios = document.querySelectorAll('input[name="transHoverEngineRadio"]');

    if (toneDisplayStyleSelect) toneDisplayStyleSelect.value = result.toneDisplayStyle || 'normal';

    if (rubyTextStyleSelect) {
      const savedStyle = result.rubyTextStyle || 'default';
      rubyTextStyleSelect.value = savedStyle;
      updateRubyTextStyleUI(savedStyle);
    }

    if (rubyTextOpacitySelect) rubyTextOpacitySelect.value = result.rubyTextOpacity || '0.85';
    if (rubyDictionaryColorSelect) rubyDictionaryColorSelect.value = result.rubyDictionaryColor || '#999999';
    if (typeof updateInspectDemoTones === 'function') updateInspectDemoTones();

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

    const enableAutoTranslateYueDefsToggle = document.getElementById('enableAutoTranslateYueDefs');
    const autoTranslateYueDefsEngineSelect = document.getElementById('autoTranslateYueDefsEngine');
    const yueDefDisplayModeSelect = document.getElementById('yueDefDisplayMode');

    if (enableAutoTranslateYueDefsToggle) {
      enableAutoTranslateYueDefsToggle.checked = result.enableAutoTranslateYueDefs === true;
    }
    if (autoTranslateYueDefsEngineSelect) {
      autoTranslateYueDefsEngineSelect.value = result.autoTranslateYueDefsEngine || 'google';
    }
    if (yueDefDisplayModeSelect) {
      yueDefDisplayModeSelect.value = result.yueDefDisplayMode || 'expand';
    }
    const currentUiLang = document.getElementById('langToggle') ? document.getElementById('langToggle').value : 'zh-HK';
    updateYueDefDemo(currentUiLang, result.yueDefDisplayMode || 'expand');

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

    // 載入詞頭子詞懸浮面板開關設定
    const enableSubwordsFlyoutToggle = document.getElementById('enableSubwordsFlyoutToggle');
    if (enableSubwordsFlyoutToggle) {
      enableSubwordsFlyoutToggle.checked = result.enableSubwordsFlyout !== false;
      updatePreviewSubwordsHint();
    }
    
    // 載入高亮樣式
    const savedHL = result.highlightStyle || 'yellow';
    const hlRadio = document.querySelector(`input[name="highlightStyle"][value="${savedHL}"]`);
    if (hlRadio) hlRadio.checked = true;
    
    // 載入主題模式與配色配置
    const themeMode = result.popupThemeMode || 'manual';
    if (popupThemeModeSelect) popupThemeModeSelect.value = themeMode;
    if (popupThemeSelect) popupThemeSelect.value = result.popupTheme || 'classic';
    if (popupThemeDaySelect) popupThemeDaySelect.value = result.popupThemeDay || 'classic';
    if (popupThemeNightSelect) popupThemeNightSelect.value = result.popupThemeNight || 'night';
    if (popupThemeDayStartInput) popupThemeDayStartInput.value = result.popupThemeDayStart || '07:00';
    if (popupThemeNightStartInput) popupThemeNightStartInput.value = result.popupThemeNightStart || '19:00';

    updateThemeSettingsUI(result);
    
    const setupFontUI = (selectElem, inputElem, savedValue) => {
      let matchFound = false;
      let valueToCheck = savedValue || '';

      // Normalize default fallback font strings to empty string (which maps to preset default)
      if (selectElem.id === 'enFontSelect') {
        const defaultEnFonts = [
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          'Consolas, "SF Mono", ui-monospace, monospace'
        ];
        if (defaultEnFonts.includes(valueToCheck.trim())) {
          valueToCheck = '';
        }
      } else if (selectElem.id === 'zhFontSelect') {
        if (valueToCheck === 'system-ui' || valueToCheck === 'sans-serif' || valueToCheck === 'system-ui, -apple-system, sans-serif') {
          valueToCheck = '';
        }
      }

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
      selectElem.dispatchEvent(new Event('updateUI'));
    };

    const finishSetup = () => {
      if (typeof buildSingleCustomSelect === 'function') {
        buildSingleCustomSelect(zhFontSelect);
        buildSingleCustomSelect(enFontSelect);
      }
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
    
    azureTtsKeyInput.value = result.azureTtsKey || '';
    azureTtsRegionInput.value = result.azureTtsRegion || '';
    azureTtsVoiceSelect.value = result.azureTtsVoice || 'zh-HK-HiuMaanNeural';
    
    const rate = result.ttsRate || 0.9;
    ttsRateSlider.value = rate;
    ttsRateValue.textContent = rate + 'x';
    
    // 觸發自定義 UI 更新
    document.querySelectorAll('select').forEach(s => s.dispatchEvent(new Event('updateUI')));
  });

  // AI 設定用 local storage（避免 sync 配額不足）
  chrome.storage.local.get(['aiEnabled', 'aiBaseUrl', 'aiApiKey', 'aiModel', 'aiPrompt'], (result) => {
    aiEnabledToggle.checked = result.aiEnabled === true;
    aiSettings.style.display = result.aiEnabled ? 'block' : 'none';
    aiBaseUrlInput.value = result.aiBaseUrl || '';
    aiApiKeyInput.value = result.aiApiKey || '';
    aiModelInput.value = result.aiModel || '';
    if (aiPromptInput) {
      aiPromptInput.value = result.aiPrompt || '';
    }
  });

  // 更新引擎相關 UI
  function updateEngineUI(engine) {
    edgeTtsSettings.style.display = engine === 'edgeTts' ? 'flex' : 'none';
    azureTtsSettings.style.display = engine === 'azureTts' ? 'flex' : 'none';
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

  const enableAutoTranslateYueDefsEl = document.getElementById('enableAutoTranslateYueDefs');
  const autoTranslateYueDefsEngineEl = document.getElementById('autoTranslateYueDefsEngine');

  function updateYueDefDemo(targetLang, mode) {
    const container = document.getElementById('yueDefDemoContainer');
    if (!container) return;

    const langMap = {
      'zh-Hans': { label: '普', text: '标明事物或动作所在的时空' },
      'zh-CN': { label: '普', text: '标明事物或动作所在的时空' },
      'en': { label: '英', text: 'Indicates the time and space of things or actions' },
      'ja': { label: '日', text: '物事や動作の時空を示す' },
      'ko': { label: '韓', text: '사물이나 동작의 시공간을 나타냄' },
      'zh-Hant': { label: '書', text: '標明事物或動作所在的時空' },
      'zh-TW': { label: '書', text: '標明事物或動作所在的時空' },
      'zh-HK': { label: '書', text: '標明事物或動作所在的時空' }
    };

    const info = langMap[targetLang] || { label: '譯', text: '标明事物或动作所在的时空' };

    const expandBadge = document.getElementById('demoExpandLangBadge');
    const expandText = document.getElementById('demoExpandTransText');
    const replacedLang = document.getElementById('demoReplacedLang');
    const replacedText = document.getElementById('demoReplacedText');

    if (expandBadge) expandBadge.textContent = info.label;
    if (expandText) expandText.textContent = info.text;
    if (replacedLang) replacedLang.textContent = info.label;
    if (replacedText) replacedText.textContent = info.text;

    const loadingText = chrome.i18n.getMessage('badgeTranslating') || '翻譯中...';
    container.querySelectorAll('.demo-text-loading, .demo-expand-loading-text').forEach(el => {
      el.textContent = loadingText;
    });

    // Switch demo container mode
    const isReplace = mode === 'replace';
    container.classList.toggle('demo-mode-replace', isReplace);
    container.classList.toggle('demo-mode-expand', !isReplace);

    // Restart animations smoothly
    const animEls = container.querySelectorAll('.demo-def-cursor, .cursor-svg-arrow, .cursor-svg-hand, .demo-def-ripple, .demo-badge-yue, .demo-badge-replaced, .demo-yue-expand-subline, .demo-text-orig, .demo-text-loading, .demo-text-trans, .demo-expand-loading-text, .demo-expand-done-text');
    animEls.forEach(el => el.style.animation = 'none');
    void container.offsetWidth;
    animEls.forEach(el => el.style.animation = '');
  }

  if (enableAutoTranslateYueDefsEl) {
    enableAutoTranslateYueDefsEl.addEventListener('change', () => {
      const val = enableAutoTranslateYueDefsEl.checked;
      chrome.storage.sync.set({ enableAutoTranslateYueDefs: val });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'enableAutoTranslateYueDefs', value: val });
      notifyContentScripts({ action: 'changeEnableAutoTranslateYueDefs', enableAutoTranslateYueDefs: val });
    });
  }

  if (autoTranslateYueDefsEngineEl) {
    autoTranslateYueDefsEngineEl.addEventListener('change', () => {
      const val = autoTranslateYueDefsEngineEl.value;
      chrome.storage.sync.set({ autoTranslateYueDefsEngine: val });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'autoTranslateYueDefsEngine', value: val });
      notifyContentScripts({ action: 'changeAutoTranslateYueDefsEngine', autoTranslateYueDefsEngine: val });
    });
  }

  const yueDefDisplayModeEl = document.getElementById('yueDefDisplayMode');
  if (yueDefDisplayModeEl) {
    yueDefDisplayModeEl.addEventListener('change', () => {
      const val = yueDefDisplayModeEl.value;
      chrome.storage.sync.set({ yueDefDisplayMode: val });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'yueDefDisplayMode', value: val });
      notifyContentScripts({ action: 'changeYueDefDisplayMode', yueDefDisplayMode: val });
      const curUiLang = document.getElementById('langToggle') ? document.getElementById('langToggle').value : 'zh-HK';
      updateYueDefDemo(curUiLang, val);
    });
  }

  if (toneDisplayStyleSelect) {
    toneDisplayStyleSelect.addEventListener('change', () => {
      chrome.storage.sync.set({ toneDisplayStyle: toneDisplayStyleSelect.value });
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
      if (rubyDictionaryColorContainer) rubyDictionaryColorContainer.style.display = 'flex';
    } else {
      if (rubyTextOpacityContainer) rubyTextOpacityContainer.style.display = 'flex';
      if (rubyDictionaryColorContainer) rubyDictionaryColorContainer.style.display = 'none';
    }
  }

  function updateInspectDemoTones() {
    const rubiesEl = document.getElementById('demoRubyRubies');
    const demoBlockEl = document.getElementById('inspectDemo');
    if (!rubiesEl) return;

    const toneSelect = document.getElementById('toneDisplayStyle');
    const toneVal = toneSelect ? toneSelect.value : 'normal';

    const styleSelect = document.getElementById('rubyTextStyle');
    const styleVal = styleSelect ? styleSelect.value : 'default';

    const opacitySelect = document.getElementById('rubyTextOpacity');
    const opacityVal = opacitySelect ? opacitySelect.value : '0.85';

    const colorSelect = document.getElementById('rubyDictionaryColor');
    const colorVal = colorSelect ? colorSelect.value : '#999999';

    const customEnInput = document.getElementById('customEnFont');
    const enSelect = document.getElementById('enFontSelect');
    const enFont = (enSelect && enSelect.value === 'custom' && customEnInput && customEnInput.value.trim()) || (enSelect && enSelect.value) || 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace';

    // 1. 生成對應音調顯示格式的音節
    const syllables = [
      { base: 'cyun', tone: '4' },
      { base: 'man',  tone: '4' },
      { base: 'zyu',  tone: '3' },
      { base: 'jam',  tone: '1' },
      { base: 'si',   tone: '6' },
      { base: 'faan', tone: '6' }
    ];

    rubiesEl.innerHTML = syllables.map(s => {
      let text = s.base + s.tone;
      if (toneVal === 'superscript') {
        text = `${s.base}<sup style="font-size: 0.75em; vertical-align: super; line-height: 0;">${s.tone}</sup>`;
      } else if (toneVal === 'hidden') {
        text = s.base;
      }
      return `<span style="flex: 1; text-align: center;">${text}</span>`;
    }).join('');

    // 2. 套用排版風格、字體、顏色與不透明度
    if (styleVal === 'dictionary') {
      rubiesEl.style.setProperty('--demo-ruby-target-font-family', '"Chiron Hei HK WS", "Microsoft YaHei", sans-serif');
      rubiesEl.style.setProperty('--demo-ruby-target-font-style', 'italic');
      rubiesEl.style.setProperty('--demo-ruby-target-color', colorVal);
      rubiesEl.style.setProperty('--demo-ruby-target-opacity', '1');
      if (demoBlockEl) demoBlockEl.style.setProperty('--demo-ruby-target-opacity', '1');
    } else {
      rubiesEl.style.setProperty('--demo-ruby-target-font-family', enFont);
      rubiesEl.style.setProperty('--demo-ruby-target-font-style', 'normal');
      rubiesEl.style.setProperty('--demo-ruby-target-color', 'var(--primary)');
      rubiesEl.style.setProperty('--demo-ruby-target-opacity', opacityVal);
      if (demoBlockEl) demoBlockEl.style.setProperty('--demo-ruby-target-opacity', opacityVal);
    }
  }

  function updateDemoRubyKeys(shortcutStr) {
    const keysContainer = document.querySelector('.demo-ruby-keys');
    if (!keysContainer) return;
    const isMac = (typeof navigator !== 'undefined') && (
      (navigator.userAgentData && navigator.userAgentData.platform === 'macOS') ||
      (navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0) ||
      (navigator.userAgent && navigator.userAgent.toUpperCase().indexOf('MAC') >= 0)
    );
    if (!shortcutStr) {
      shortcutStr = isMac ? '⇧+⌘+F' : 'Ctrl+Shift+F';
    }

    const raw = String(shortcutStr).trim();
    const symbolTokens = ['⇧', '⌘', '⌥', '⌃', '⎇'];
    let tokenized = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (symbolTokens.includes(ch)) {
        if (tokenized.length > 0 && !tokenized.endsWith('+') && !tokenized.endsWith(' ')) tokenized += '+';
        tokenized += ch + '+';
      } else {
        tokenized += ch;
      }
    }
    tokenized = tokenized.replace(/\++/g, '+').replace(/^\+|\+$/g, '');

    const parts = tokenized.split(/[+\s]+/).map(p => p.trim()).filter(Boolean);
    const keySymbolMap = {
      'Shift': '⇧',
      'Command': '⌘',
      'Cmd': '⌘',
      'MacCtrl': '⌃',
      'Ctrl': isMac ? '⌃' : 'Ctrl',
      'Control': isMac ? '⌃' : 'Ctrl',
      'Alt': isMac ? '⌥' : 'Alt',
      'Option': isMac ? '⌥' : 'Alt'
    };

    keysContainer.innerHTML = parts.map(part => {
      const displayKey = keySymbolMap[part] || part;
      return `<div class="demo-key">${displayKey}</div>`;
    }).join('');
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
    const isYale = displayModeSelect && displayModeSelect.value === 'yale';
    const demoCompactText = document.getElementById('demoCompactText');
    if (demoCompactText) {
      let text = isYale ? 'tīn hei' : 'tin1 hei3';
      if (!isYale && toneStyleToggle && toneStyleToggle.checked) {
        text = text.replace(/(\d+)/g, '<sup class="jyutping-tone">$1</sup>');
      }
      demoCompactText.innerHTML = text;
    }
    
    // 同步更新 Ruby 演示動畫中的注音
    const rubyRts = document.querySelectorAll('.demo-ruby-rt');
    rubyRts.forEach(rt => {
      let text = rt.getAttribute('data-text');
      if (text) {
        if (isYale) {
          // 簡單模擬耶魯拼音
          text = text.replace(/tin1/g, 'tīn').replace(/hei3/g, 'hei');
        } else if (toneStyleToggle && toneStyleToggle.checked) {
          text = text.replace(/(\d+)/g, '<sup class="jyutping-tone">$1</sup>');
        }
        rt.innerHTML = text;
      }
    });
    
    // 同步更新外觀主題預覽懸浮窗中的發音標籤與拼音
    const previewDict = document.getElementById('cantonese-popup-dict');
    if (previewDict) {
      const labelEl = previewDict.querySelector('.pronunciation-label');
      const pinyinEl = document.getElementById('previewPinyin');
      if (labelEl) {
        labelEl.textContent = isYale ? 'Yale:' : '粵拼:';
      }
      if (pinyinEl) {
        if (isYale) {
          pinyinEl.innerHTML = '<span class="syllable-item">néih</span> <span class="syllable-item">hóu</span>';
        } else {
          if (toneStyleToggle && toneStyleToggle.checked) {
            pinyinEl.innerHTML = '<span class="syllable-item">nei⁵</span> <span class="syllable-item">hou²</span>';
          } else {
            pinyinEl.innerHTML = '<span class="syllable-item">nei5</span> <span class="syllable-item">hou2</span>';
          }
        }
      }
    }
    
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

  function getTargetLangDisplayName(langCode) {
    switch (langCode) {
      case 'zh-CN':
      case 'zh-Hans': return t('optAILangCN') || '簡體中文';
      case 'zh-Hant':
      case 'zh-TW':
      case 'zh-HK': return t('optAILangTW') || '繁體中文';
      case 'en': return t('optAILangEN') || 'English';
      case 'ja': return t('optAILangJA') || '日本語';
      case 'ko': return t('optAILangKO') || '한국어';
      default: return t('optAILangCN') || '簡體中文';
    }
  }

  function updateTargetLangHints(langCode) {
    const lang = langCode || (document.getElementById('langToggle') ? document.getElementById('langToggle').value : 'zh-HK');
    const langDisplayName = getTargetLangDisplayName(lang);
    const rawTemplate = t('optTargetLangFollowsUiLangNote') || '💡 目標語言將自動跟隨當前「介面語言」（當前：$LANG$）。如需更改，請在頁面右上角切換「介面語言」。';
    const noteHtml = rawTemplate.replace('$LANG$', `<strong>${langDisplayName}</strong>`).replace('$1', `<strong>${langDisplayName}</strong>`);

    const hintIds = ['paraTransTargetLangHint', 'yueDefsTargetLangHint', 'aiTargetLangHint'];
    hintIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = noteHtml;
    });
  }

  function updateParaTransDirectionUI(direction, currentLangCode) {
    const paraDirFromText = document.getElementById('paraDirFromText');
    const paraDirToText = document.getElementById('paraDirToText');
    const langToggle = document.getElementById('langToggle');
    const effectiveLangCode = currentLangCode || (langToggle ? langToggle.value : 'zh-HK');
    const targetName = `${t('optParaTransLangTarget')} (${getTargetLangDisplayName(effectiveLangCode)})`;
    const yueName = t('optParaTransLangYue');

    if (direction === 'target_to_yue') {
      if (paraDirFromText) paraDirFromText.textContent = targetName;
      if (paraDirToText) paraDirToText.textContent = yueName;
    } else {
      if (paraDirFromText) paraDirFromText.textContent = yueName;
      if (paraDirToText) paraDirToText.textContent = targetName;
    }

    updateDemoParaDirection(direction);
  }

  function updateDemoParaDirection(direction) {
    const demoTextEl = document.querySelector('#paraTransDemo .demo-para-text');
    const demoTransEl = document.querySelector('#paraTransDemo .demo-para-translated span');
    if (demoTextEl && demoTransEl) {
      if (direction === 'target_to_yue') {
        demoTextEl.textContent = t('optParaTransDemoText') || '這是一段用來示範段落翻譯功能的文字。';
        demoTransEl.textContent = t('optParaTransDemoTranslated') || '呢段係用嚟示範段落翻譯功能嘅文字。';
      } else {
        demoTextEl.textContent = t('optParaTransDemoTranslated') || '呢段係用嚟示範段落翻譯功能嘅文字。';
        demoTransEl.textContent = t('optParaTransDemoText') || '這是一段用來示範段落翻譯功能的文字。';
      }
    }
  }

  function toggleParaTransDirection() {
    chrome.storage.sync.get(['paragraphTransDirection'], (res) => {
      const currentDir = res.paragraphTransDirection || 'yue_to_target';
      const newDir = currentDir === 'yue_to_target' ? 'target_to_yue' : 'yue_to_target';
      const curLang = document.getElementById('langToggle') ? document.getElementById('langToggle').value : 'zh-HK';
      chrome.storage.sync.set({ paragraphTransDirection: newDir });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'paragraphTransDirection', value: newDir });
      updateParaTransDirectionUI(newDir, curLang);
      notifyContentScripts({ action: 'changeParagraphTransDirection', value: newDir });
    });
  }

  const paraDirSwapBtn = document.getElementById('paraDirSwapBtn');
  if (paraDirSwapBtn) {
    paraDirSwapBtn.addEventListener('click', toggleParaTransDirection);
  }

  const paraDirFromText = document.getElementById('paraDirFromText');
  if (paraDirFromText) {
    paraDirFromText.addEventListener('click', toggleParaTransDirection);
    paraDirFromText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleParaTransDirection();
      }
    });
  }

  const paraDirToText = document.getElementById('paraDirToText');
  if (paraDirToText) {
    paraDirToText.addEventListener('click', toggleParaTransDirection);
    paraDirToText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleParaTransDirection();
      }
    });
  }

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
      'double_shift': 'Shift ⇧⇧',
      'shift': 'Shift ⇧',
      'double_alt': 'Alt ⌥⌥',
      'alt': 'Alt ⌥',
      'double_ctrl': 'Ctrl ⌃⌃',
      'ctrl': 'Ctrl ⌃',
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

  // 詞頭子詞面板開關
  const enableSubwordsFlyoutToggle = document.getElementById('enableSubwordsFlyoutToggle');
  function updatePreviewSubwordsHint() {
    const hint = document.getElementById('previewSubwordsHint');
    const wordSec = document.getElementById('previewWordSection');
    const flyout = document.getElementById('previewSubwordsFlyout');
    const wrapper = document.querySelector('.theme-preview-wrapper');
    const enabled = enableSubwordsFlyoutToggle ? enableSubwordsFlyoutToggle.checked : true;
    if (hint) hint.style.display = enabled ? 'inline' : 'none';
    if (wordSec) {
      if (enabled) wordSec.classList.add('has-subwords');
      else wordSec.classList.remove('has-subwords');
    }
    if (flyout) {
      flyout.style.display = enabled ? 'block' : 'none';
    }
    if (wrapper) {
      wrapper.style.paddingLeft = enabled ? '68px' : '0px';
    }
  }

  if (enableSubwordsFlyoutToggle) {
    enableSubwordsFlyoutToggle.addEventListener('change', () => {
      const enabled = enableSubwordsFlyoutToggle.checked;
      chrome.storage.sync.set({ enableSubwordsFlyout: enabled });
      updatePreviewSubwordsHint();
      GoogleAnalytics.fireEvent('change_setting', { setting: 'enableSubwordsFlyout', value: enabled });
      notifyContentScripts({ action: 'changeEnableSubwordsFlyout', enabled });
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

  // 更新 Demo 高亮動畫顏色（同時更新 compact demo 與 theme preview 中的選中詞）
  function updateDemoHighlightStyle(style) {
    const demoHL = document.querySelector('.demo-compact-highlight');
    const previewHL = document.querySelector('.preview-hl-word');

    const colors = {
      yellow: 'rgba(254, 240, 138, 0.9)',
      blue: 'rgba(191, 219, 254, 0.9)',
      red: 'rgba(254, 205, 211, 0.9)',
      pink: 'rgba(254, 205, 211, 0.9)',
      green: 'rgba(187, 247, 208, 0.9)',
      gray: 'rgba(229, 231, 235, 0.9)',
    };

    [demoHL, previewHL].forEach(el => {
      if (!el) return;
      el.style.background = '';
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.borderBottom = '';
      el.style.border = '';
      el.style.color = '';

      if (colors[style]) {
        el.style.background = colors[style];
        el.style.color = '#1e293b';
      } else if (style === 'underline-dashed' || style === 'underline') {
        el.style.background = 'transparent';
        el.style.borderBottom = '2px dashed #888';
      } else if (style === 'border-dashed') {
        el.style.background = 'transparent';
        el.style.outline = '1.5px dashed #888';
        el.style.outlineOffset = '2px';
      }
    });
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

  // 輔助函數：解析當前生效的主題
  function getEffectivePopupTheme(settings = {}) {
    const mode = settings.popupThemeMode || (popupThemeModeSelect ? popupThemeModeSelect.value : 'manual');
    if (mode === 'auto_time') {
      const now = new Date();
      const curMins = now.getHours() * 60 + now.getMinutes();
      const dVal = settings.popupThemeDayStart || (popupThemeDayStartInput ? popupThemeDayStartInput.value : '07:00');
      const nVal = settings.popupThemeNightStart || (popupThemeNightStartInput ? popupThemeNightStartInput.value : '19:00');
      const [dH, dM] = dVal.split(':').map(Number);
      const [nH, nM] = nVal.split(':').map(Number);
      const dayStart = (dH || 7) * 60 + (dM || 0);
      const nightStart = (nH || 19) * 60 + (nM || 0);
      let isDay = false;
      if (dayStart < nightStart) {
        isDay = curMins >= dayStart && curMins < nightStart;
      } else {
        isDay = curMins >= dayStart || curMins < nightStart;
      }
      const activeTheme = isDay 
        ? (settings.popupThemeDay || (popupThemeDaySelect ? popupThemeDaySelect.value : 'classic'))
        : (settings.popupThemeNight || (popupThemeNightSelect ? popupThemeNightSelect.value : 'night'));
      return { theme: activeTheme, isDay, mode };
    }
    if (mode === 'follow_system') {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const activeTheme = isDark 
        ? (settings.popupThemeNight || (popupThemeNightSelect ? popupThemeNightSelect.value : 'night'))
        : (settings.popupThemeDay || (popupThemeDaySelect ? popupThemeDaySelect.value : 'classic'));
      return { theme: activeTheme, isDay: !isDark, mode };
    }
    if (mode === 'follow_page') {
      const activeTheme = settings.popupThemeDay || (popupThemeDaySelect ? popupThemeDaySelect.value : 'classic');
      return { theme: activeTheme, isDay: true, mode };
    }
    return {
      theme: settings.popupTheme || (popupThemeSelect ? popupThemeSelect.value : 'classic'),
      isDay: true,
      mode: 'manual'
    };
  }

  // 刷新主題配置面板 UI 與預覽
  function updateThemeSettingsUI(settings = {}) {
    const mode = settings.popupThemeMode || (popupThemeModeSelect ? popupThemeModeSelect.value : 'manual');
    if (manualThemeWrapper) manualThemeWrapper.style.display = mode === 'manual' ? 'flex' : 'none';
    if (multiThemeWrapper) multiThemeWrapper.style.display = mode !== 'manual' ? 'flex' : 'none';
    if (themeScheduleRow) themeScheduleRow.style.display = mode === 'auto_time' ? 'flex' : 'none';

    const eff = getEffectivePopupTheme(settings);
    updateThemePreview(eff.theme);
  }

  // 監聽主題模式切換
  if (popupThemeModeSelect) {
    popupThemeModeSelect.addEventListener('change', () => {
      const mode = popupThemeModeSelect.value;
      chrome.storage.sync.set({ popupThemeMode: mode });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'popupThemeMode', value: mode });
      updateThemeSettingsUI();
      notifyContentScripts({ action: 'changePopupThemeMode', mode });
    });
  }

  // 監聽固定主題切換
  if (popupThemeSelect) {
    popupThemeSelect.addEventListener('change', () => {
      const theme = popupThemeSelect.value;
      chrome.storage.sync.set({ popupTheme: theme });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'popupTheme', value: theme });
      updateThemePreview(theme);
      notifyContentScripts({ action: 'changePopupTheme', theme });
    });
  }

  // 監聽白天主題切換
  if (popupThemeDaySelect) {
    popupThemeDaySelect.addEventListener('change', () => {
      const theme = popupThemeDaySelect.value;
      chrome.storage.sync.set({ popupThemeDay: theme });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'popupThemeDay', value: theme });
      updateThemePreview(theme);
      notifyContentScripts({ action: 'changePopupThemeDay', theme });
    });
  }

  // 監聽夜間主題切換
  if (popupThemeNightSelect) {
    popupThemeNightSelect.addEventListener('change', () => {
      const theme = popupThemeNightSelect.value;
      chrome.storage.sync.set({ popupThemeNight: theme });
      GoogleAnalytics.fireEvent('change_setting', { setting: 'popupThemeNight', value: theme });
      updateThemePreview(theme);
      notifyContentScripts({ action: 'changePopupThemeNight', theme });
    });
  }

  // 監聽時段輸入變更
  if (popupThemeDayStartInput) {
    popupThemeDayStartInput.addEventListener('change', () => {
      const val = popupThemeDayStartInput.value || '07:00';
      chrome.storage.sync.set({ popupThemeDayStart: val });
      updateThemeSettingsUI();
      notifyContentScripts({ action: 'changePopupThemeDayStart', val });
    });
  }
  if (popupThemeNightStartInput) {
    popupThemeNightStartInput.addEventListener('change', () => {
      const val = popupThemeNightStartInput.value || '19:00';
      chrome.storage.sync.set({ popupThemeNightStart: val });
      updateThemeSettingsUI();
      notifyContentScripts({ action: 'changePopupThemeNightStart', val });
    });
  }

  // 點擊太陽/月亮圖標快速預覽白天/夜間主題
  if (previewSunIcon) {
    previewSunIcon.addEventListener('click', () => {
      if (popupThemeDaySelect) updateThemePreview(popupThemeDaySelect.value);
    });
  }
  if (previewMoonIcon) {
    previewMoonIcon.addEventListener('click', () => {
      if (popupThemeNightSelect) updateThemePreview(popupThemeNightSelect.value);
    });
  }

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
      const curUiLang = document.getElementById('langToggle') ? document.getElementById('langToggle').value : 'zh-HK';
      const targetLang = getTargetLangDisplayName(curUiLang);
      
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
      } else if (engine === 'googleTts') {
        await speakWithGoogleTts(testText, rate);
      } else if (engine === 'azureTts') {
        const voice = azureTtsVoiceSelect.value;
        await speakWithAzureTts(testText, rate, voice);
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

  // Google TTS (via Google Translate Cantonese API)
  async function speakWithGoogleTts(text, rate) {
    const encoded = encodeURIComponent(text.slice(0, 200));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=yue&q=${encoded}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google TTS 錯誤: ${response.status}`);
    }
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    if (rate && rate !== 1.0) {
      audio.playbackRate = rate;
    }
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => reject(new Error('音頻播放失敗'));
      audio.play().catch(reject);
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
  const feedbackAttachBtn = document.getElementById('feedbackAttachBtn');
  const feedbackAttachmentInput = document.getElementById('feedbackAttachmentInput');
  const feedbackMessageInput = document.getElementById('feedbackMessageInput') || document.querySelector('textarea[name="message"]');
  const feedbackAttachmentPreview = document.getElementById('feedbackAttachmentPreview');
  const attachmentError = document.getElementById('attachmentError');
  const imageLightboxModal = document.getElementById('imageLightboxModal');
  const imageLightboxImg = document.getElementById('imageLightboxImg');
  const imageLightboxCaption = document.getElementById('imageLightboxCaption');
  const imageLightboxCloseBtn = document.getElementById('imageLightboxCloseBtn');
  const imageLightboxBackdrop = document.querySelector('.image-lightbox-backdrop');

  const MAX_SCREENSHOTS = 3;
  const MAX_SINGLE_SIZE = 3 * 1024 * 1024; // 3MB
  const MAX_TOTAL_SIZE = 4.5 * 1024 * 1024; // 4.5MB

  let attachedScreenshotFiles = []; // Array of File objects

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function setAttachmentError(msg) {
    if (attachmentError) {
      if (msg) {
        attachmentError.textContent = msg;
        attachmentError.style.display = 'block';
      } else {
        attachmentError.style.display = 'none';
      }
    }
  }

  function openLightbox(file) {
    if (!imageLightboxModal || !imageLightboxImg || !file) return;
    const url = URL.createObjectURL(file);
    imageLightboxImg.src = url;
    if (imageLightboxCaption) {
      imageLightboxCaption.textContent = `${file.name || 'screenshot.png'} (${formatFileSize(file.size)})`;
    }
    imageLightboxModal.style.display = 'flex';
    requestAnimationFrame(() => {
      imageLightboxModal.classList.add('active');
    });
  }

  function closeLightbox() {
    if (!imageLightboxModal) return;
    imageLightboxModal.classList.remove('active');
    setTimeout(() => {
      imageLightboxModal.style.display = 'none';
      if (imageLightboxImg) imageLightboxImg.src = '';
    }, 250);
  }

  if (imageLightboxCloseBtn) imageLightboxCloseBtn.addEventListener('click', closeLightbox);
  if (imageLightboxBackdrop) imageLightboxBackdrop.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageLightboxModal && imageLightboxModal.classList.contains('active')) {
      closeLightbox();
    }
  });

  function updateAttachBtnState() {
    if (!feedbackAttachBtn) return;
    const count = attachedScreenshotFiles.length;
    const btnSpan = feedbackAttachBtn.querySelector('span');
    const baseText = t('optAddScreenshot') || '附帶截圖';
    if (btnSpan) {
      btnSpan.textContent = count > 0 ? `${baseText} (${count}/${MAX_SCREENSHOTS})` : baseText;
    }
    if (count >= MAX_SCREENSHOTS) {
      feedbackAttachBtn.style.opacity = '0.6';
      feedbackAttachBtn.style.cursor = 'not-allowed';
      feedbackAttachBtn.title = t('optMaxImagesLimit') || '最多只能附帶 3 張截圖';
    } else {
      feedbackAttachBtn.style.opacity = '1';
      feedbackAttachBtn.style.cursor = 'pointer';
      feedbackAttachBtn.removeAttribute('title');
    }
  }

  function renderAttachmentPreviews() {
    if (!feedbackAttachmentPreview) return;
    updateAttachBtnState();

    if (attachedScreenshotFiles.length === 0) {
      feedbackAttachmentPreview.innerHTML = '';
      feedbackAttachmentPreview.style.display = 'none';
      return;
    }

    let html = '';
    attachedScreenshotFiles.forEach((file, index) => {
      const objectUrl = URL.createObjectURL(file);
      html += `
        <div class="attachment-item-card" data-index="${index}">
          <div class="attachment-thumb-wrap zoom-preview-trigger" data-index="${index}" title="${t('optZoomPreview') || '點擊放大預覽'}">
            <img src="${objectUrl}" alt="Screenshot ${index + 1}" />
            <div class="zoom-icon-hint">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </div>
          </div>
          <div class="zoom-preview-trigger" data-index="${index}" style="flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; cursor: zoom-in;" title="${t('optZoomPreview') || '點擊放大預覽'}">
            <span style="font-size: 12.5px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file.name || 'screenshot_' + (index + 1) + '.png'}</span>
            <span style="font-size: 11px; color: var(--text-muted); line-height: 1.2; margin-top: 2px;">${formatFileSize(file.size)}</span>
          </div>
          <button type="button" class="remove-single-attachment-btn" data-index="${index}" title="${t('optRemoveAttachment') || '移除截圖'}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px 4px; font-size: 14px; line-height: 1; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>
        </div>
      `;
    });

    feedbackAttachmentPreview.innerHTML = html;
    feedbackAttachmentPreview.style.display = 'grid';

    // 綁定點擊放大預覽事件
    feedbackAttachmentPreview.querySelectorAll('.zoom-preview-trigger').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.index, 10);
        if (!isNaN(idx) && idx >= 0 && idx < attachedScreenshotFiles.length) {
          openLightbox(attachedScreenshotFiles[idx]);
        }
      });
    });

    // 綁定每個獨立卡片的刪除事件
    feedbackAttachmentPreview.querySelectorAll('.remove-single-attachment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        if (!isNaN(idx) && idx >= 0 && idx < attachedScreenshotFiles.length) {
          attachedScreenshotFiles.splice(idx, 1);
          setAttachmentError('');
          renderAttachmentPreviews();
        }
      });
    });
  }

  function handleAttachmentFiles(fileList) {
    setAttachmentError('');
    if (!fileList || fileList.length === 0) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const filesToAdd = Array.from(fileList);

    for (const file of filesToAdd) {
      if (attachedScreenshotFiles.length >= MAX_SCREENSHOTS) {
        setAttachmentError(t('optMaxImagesLimit') || '最多只能附帶 3 張截圖');
        break;
      }

      if (!validTypes.includes(file.type)) {
        setAttachmentError(t('optOnlyImageAllowed') || '僅支援上傳 PNG、JPG、WEBP 格式的圖片');
        continue;
      }

      if (file.size > MAX_SINGLE_SIZE) {
        setAttachmentError(t('optSingleImageTooLarge') || '單張圖片不能超過 3MB');
        continue;
      }

      const currentTotal = attachedScreenshotFiles.reduce((acc, f) => acc + f.size, 0);
      if (currentTotal + file.size > MAX_TOTAL_SIZE) {
        setAttachmentError(t('optTotalImagesTooLarge') || '所有圖片總和不能超過 4.5MB');
        break;
      }

      attachedScreenshotFiles.push(file);
    }

    renderAttachmentPreviews();
  }

  function clearAllAttachments() {
    attachedScreenshotFiles = [];
    if (feedbackAttachmentInput) feedbackAttachmentInput.value = '';
    setAttachmentError('');
    renderAttachmentPreviews();
  }

  if (feedbackAttachBtn && feedbackAttachmentInput) {
    feedbackAttachBtn.addEventListener('click', () => {
      if (attachedScreenshotFiles.length >= MAX_SCREENSHOTS) {
        setAttachmentError(t('optMaxImagesLimit') || '最多只能附帶 3 張截圖');
        return;
      }
      feedbackAttachmentInput.click();
    });

    feedbackAttachmentInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleAttachmentFiles(e.target.files);
      }
      feedbackAttachmentInput.value = ''; // 允許重複選取相同檔案
    });
  }

  if (feedbackMessageInput) {
    // 監聽 Cmd/Ctrl + V 剪貼板貼上圖片
    feedbackMessageInput.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const imageFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }
      if (imageFiles.length > 0) {
        handleAttachmentFiles(imageFiles);
      }
    });

    // 支援拖拽圖片到輸入框
    feedbackMessageInput.addEventListener('dragover', (e) => {
      e.preventDefault();
      feedbackMessageInput.style.borderColor = 'var(--accent, #3b82f6)';
    });
    feedbackMessageInput.addEventListener('dragleave', () => {
      feedbackMessageInput.style.borderColor = '';
    });
    feedbackMessageInput.addEventListener('drop', (e) => {
      e.preventDefault();
      feedbackMessageInput.style.borderColor = '';
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleAttachmentFiles(e.dataTransfer.files);
      }
    });
  }

  let feedbackResultTimer = null;

  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(feedbackForm);
      if (attachedScreenshotFiles.length > 0) {
        formData.append("attachment", attachedScreenshotFiles[0], attachedScreenshotFiles[0].name || 'screenshot_1.png');
        if (attachedScreenshotFiles[1]) {
          formData.append("attachment_2", attachedScreenshotFiles[1], attachedScreenshotFiles[1].name || 'screenshot_2.png');
        }
        if (attachedScreenshotFiles[2]) {
          formData.append("attachment_3", attachedScreenshotFiles[2], attachedScreenshotFiles[2].name || 'screenshot_3.png');
        }
      }

      const originalHTML = submitFeedbackBtn.innerHTML;
      
      submitFeedbackBtn.innerHTML = `
        <svg class="spin-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12" />
        </svg>
        <span>${t('optSending') || '發送中...'}</span>
      `;
      submitFeedbackBtn.disabled = true;
      submitFeedbackBtn.style.opacity = '0.75';
      feedbackResult.style.display = 'none';
      if (feedbackResultTimer) clearTimeout(feedbackResultTimer);

      try {
        const response = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
          feedbackResult.className = 'feedback-result-banner success';
          feedbackResult.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>${t('optFeedbackSuccess') || '發送成功！非常感謝您的寶貴反饋！'}</span>
          `;
          feedbackForm.reset();
          clearAllAttachments();
        } else {
          feedbackResult.className = 'feedback-result-banner error';
          feedbackResult.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <span>${(t('optFeedbackFailed') || '發送失敗：') + (data && data.message ? data.message : (t('optFeedbackNetworkError') || '請稍後重試'))}</span>
          `;
        }
      } catch (error) {
        feedbackResult.className = 'feedback-result-banner error';
        feedbackResult.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>${t('optFeedbackNetworkError') || '網絡連接異常或發生錯誤，請稍後重試。'}</span>
        `;
      } finally {
        feedbackResult.style.display = 'flex';
        submitFeedbackBtn.innerHTML = originalHTML;
        submitFeedbackBtn.disabled = false;
        submitFeedbackBtn.style.opacity = '1';
        
        // 6秒後淡出提示
        feedbackResultTimer = setTimeout(() => {
          feedbackResult.style.display = 'none';
        }, 6000);
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

  // === Wordbook Count Badge ===
  const wordbookBadge = document.getElementById('wordbookCountBadge');
  if (wordbookBadge) {
    chrome.storage.local.get(['wordbook'], (result) => {
      wordbookBadge.textContent = (result.wordbook || []).length;
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.wordbook) {
        wordbookBadge.textContent = (changes.wordbook.newValue || []).length;
      }
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
          updateDemoRubyKeys(currentShortcut);
        } else {
          const space = (lang === 'en' || lang === 'ko') ? ' ' : '';
          descEl.innerHTML = `${none}${space}${hint}`;
          updateDemoRubyKeys('');
        }
      });
    } else {
      descEl.innerText = "";
      updateDemoRubyKeys('');
    }
  }

  // 初始化自定義下拉選單 (Progressive Enhancement)
  function buildSingleCustomSelect(select) {
    if (!select) return;
    if (select.nextElementSibling && select.nextElementSibling.classList.contains('custom-select-wrapper')) {
      select.nextElementSibling.remove();
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('tabindex', '0');
    
    const label = document.createElement('span');
    label.className = 'custom-select-label';
    
    const arrow = document.createElement('div');
    arrow.className = 'custom-select-arrow';
    arrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    
    trigger.appendChild(label);
    trigger.appendChild(arrow);
    
    const panel = document.createElement('div');
    panel.className = 'custom-select-panel';
    
    let lastGroup = null;
    Array.from(select.options).forEach(option => {
      const group = option.parentElement && option.parentElement.tagName === 'OPTGROUP' ? option.parentElement : null;
      if (group && group !== lastGroup) {
        lastGroup = group;
        const groupHeader = document.createElement('div');
        groupHeader.className = 'custom-select-group-header';
        groupHeader.textContent = group.label;
        groupHeader.style.cssText = 'padding: 6px 12px; font-size: 11px; font-weight: bold; color: var(--text-secondary, #888); border-top: 1px solid var(--border, #eee); margin-top: 4px; pointer-events: none; opacity: 0.8;';
        panel.appendChild(groupHeader);
      }

      const item = document.createElement('div');
      item.className = 'custom-select-item';
      
      if (option.hasAttribute('data-i18n')) {
        item.setAttribute('data-i18n', option.getAttribute('data-i18n'));
      }
      
      if (option.selected || option.value === select.value) {
        item.classList.add('selected');
        label.textContent = option.textContent;
        if (option.hasAttribute('data-i18n')) {
          label.setAttribute('data-i18n', option.getAttribute('data-i18n'));
        }
      }
      item.textContent = option.textContent;
      item.dataset.value = option.value;
      
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        select.value = option.value;
        
        label.textContent = option.textContent;
        if (option.hasAttribute('data-i18n')) {
          label.setAttribute('data-i18n', option.getAttribute('data-i18n'));
        } else {
          label.removeAttribute('data-i18n');
        }
        panel.querySelectorAll('.custom-select-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        
        wrapper.classList.remove('open');
        select.dispatchEvent(new Event('change'));
      });
      panel.appendChild(item);
    });
    
    const updateUI = () => {
      const selectedOption = (select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null) || Array.from(select.options).find(o => o.value === select.value);
      if (selectedOption) {
        label.textContent = selectedOption.textContent;
        if (selectedOption.hasAttribute('data-i18n')) {
          label.setAttribute('data-i18n', selectedOption.getAttribute('data-i18n'));
        } else {
          label.removeAttribute('data-i18n');
        }
        panel.querySelectorAll('.custom-select-item').forEach(i => {
          if (i.dataset.value === selectedOption.value) {
            i.classList.add('selected');
          } else {
            i.classList.remove('selected');
          }
        });
      }
    };
    
    select.addEventListener('change', updateUI);
    select.addEventListener('updateUI', updateUI);
    
    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    
    select.parentNode.insertBefore(wrapper, select.nextSibling);
    select.style.display = 'none';
    
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isOpen = wrapper.classList.contains('open');
      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
      if (!isOpen) {
        wrapper.classList.add('open');
        const rect = panel.getBoundingClientRect();
        if (rect.bottom > window.innerHeight) {
          panel.style.top = 'auto';
          panel.style.bottom = 'calc(100% + 6px)';
          panel.style.transform = 'translateY(6px)';
        } else {
          panel.style.top = 'calc(100% + 6px)';
          panel.style.bottom = 'auto';
          panel.style.transform = 'none';
        }
      }
    });
  }

  function initCustomSelects() {
    const selects = document.querySelectorAll('select:not(.native-only)');
    selects.forEach(select => {
      if (!select.nextElementSibling || !select.nextElementSibling.classList.contains('custom-select-wrapper')) {
        buildSingleCustomSelect(select);
      }
    });
  }

  initCustomSelects();

  // 監聽視窗聚焦，當用戶從 chrome://extensions/shortcuts 返回時自動更新快捷鍵顯示
  window.addEventListener('focus', () => {
    const lang = document.getElementById('langToggle').value || 'zh-HK';
    updateShortcutDesc(lang);
  });

  // TOC Navigation Logic
  const tocLinks = document.querySelectorAll('.toc-list a');
  const sections = Array.from(document.querySelectorAll('.settings-card[id]'));

  let isManualScrolling = false;
  let scrollTimeout = null;

  function setActiveTOC(id) {
    tocLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${id}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  function updateActiveTOC() {
    if (isManualScrolling || sections.length === 0) return;

    // Check if scrolled near the bottom of page
    const isAtBottom = (window.innerHeight + window.pageYOffset) >= (document.documentElement.scrollHeight - 60);
    if (isAtBottom) {
      const lastSectionId = sections[sections.length - 1].getAttribute('id');
      setActiveTOC(lastSectionId);
      return;
    }

    // Find current active section based on reading trigger line (140px from top)
    let activeId = sections[0].getAttribute('id');
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const rect = section.getBoundingClientRect();
      if (rect.top <= 140) {
        activeId = section.getAttribute('id');
      } else {
        break;
      }
    }

    setActiveTOC(activeId);
  }

  // Smooth scroll click
  tocLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      e.preventDefault();
      const targetId = href.substring(1);
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        isManualScrolling = true;
        setActiveTOC(targetId);

        window.scrollTo({
          top: targetSection.offsetTop - 20,
          behavior: 'smooth'
        });

        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          isManualScrolling = false;
          updateActiveTOC();
        }, 800);
      }
    });
  });

  // RAF throttled scroll event listener
  let isTicking = false;
  window.addEventListener('scroll', () => {
    if (!isTicking) {
      window.requestAnimationFrame(() => {
        updateActiveTOC();
        isTicking = false;
      });
      isTicking = true;
    }
  }, { passive: true });

  // Initial check on load
  updateActiveTOC();

  // === Feedback Widget Logic ===
  const feedbackWidget = document.getElementById('feedbackWidget');
  const closeFeedbackBtn = document.getElementById('closeFeedbackBtn');
  const fbPrevBtn = document.getElementById('fb_prevBtn');
  const fbNextBtn = document.getElementById('fb_nextBtn');
  const fbProgress = document.getElementById('fb_progress');
  const fbSteps = document.querySelectorAll('.feedback-step');
  const fbStars = document.querySelectorAll('.fb-star');
  let fbCurrentStep = 0;
  const fbTotalSteps = 3;
  let selectedRating = 0;

  if (feedbackWidget) {
    chrome.storage.local.get(['v157_feedback_done'], (result) => {
      if (!result.v157_feedback_done) {
        // Show after a delay so it doesn't pop up immediately
        setTimeout(() => {
          feedbackWidget.style.display = 'block';
        }, 1500);
      }
    });

    const updateFbUI = () => {
      fbSteps.forEach((step, index) => {
        step.style.transform = `translateX(-${fbCurrentStep * 100}%)`;
      });
      fbProgress.textContent = `${fbCurrentStep + 1} / ${fbTotalSteps}`;
      
      if (fbCurrentStep === 0) {
        fbPrevBtn.style.opacity = '0.5';
        fbPrevBtn.style.pointerEvents = 'none';
      } else {
        fbPrevBtn.style.opacity = '1';
        fbPrevBtn.style.pointerEvents = 'auto';
      }

      fbPrevBtn.textContent = activeDict['btnPrevStep'] || '上一步';

      if (fbCurrentStep === fbTotalSteps - 1) {
        fbNextBtn.textContent = activeDict['btnSubmit'] || '提交';
      } else {
        fbNextBtn.textContent = activeDict['btnNextStep'] || '下一步';
      }
    };
    
    window.__updateFbUI = updateFbUI;

    // Initialize initial layout (left: 0, 100%, 200%...)
    fbSteps.forEach((step, index) => {
      step.style.left = (index * 100) + '%';
    });
    updateFbUI();

    closeFeedbackBtn.addEventListener('click', () => {
      feedbackWidget.style.display = 'none';
      chrome.storage.local.set({ v157_feedback_done: true });
    });

    fbPrevBtn.addEventListener('click', () => {
      if (fbCurrentStep > 0) {
        fbCurrentStep--;
        updateFbUI();
      }
    });

    fbNextBtn.addEventListener('click', () => {
      if (fbCurrentStep < fbTotalSteps - 1) {
        fbCurrentStep++;
        updateFbUI();
      } else {
        // Submit logic
        submitFeedbackWidget();
      }
    });

    fbStars.forEach(star => {
      star.addEventListener('click', (e) => {
        selectedRating = parseInt(e.currentTarget.getAttribute('data-rating'));
        fbStars.forEach(s => {
          if (parseInt(s.getAttribute('data-rating')) <= selectedRating) {
            s.style.color = '#eab308'; // Tailwind yellow-500
            s.setAttribute('fill', '#eab308');
          } else {
            s.style.color = 'var(--border)';
            s.setAttribute('fill', 'none');
          }
        });
      });
    });

    async function submitFeedbackWidget() {
      // Gather data
      const langInput = document.querySelector('input[name="fb_language"]:checked');
      let chosenLang = langInput ? langInput.value : '';
      if (chosenLang === 'zh-TW') chosenLang = '繁體中文 (Traditional Chinese)';
      if (chosenLang === 'zh-CN') chosenLang = '簡體中文 (Simplified Chinese)';
      if (chosenLang === 'en') chosenLang = 'English (英文)';
      if (chosenLang === 'ja') chosenLang = '日本語 (日文)';
      if (chosenLang === 'ko') chosenLang = '한국어 (韓文)';
      const langOther = document.getElementById('fb_lang_other')?.value || '';

      const finalLang = chosenLang === 'other' ? langOther : chosenLang;
      const comments = document.getElementById('fb_comments')?.value || '';
      const osInfo = navigator.userAgent || '未知';
      const uiLang = navigator.language || '未知';

      const messageBody = `
=== Jyutping Extension v${chrome.runtime?.getManifest?.()?.version || '1.5.8'} 反饋 ===

1. 常用語言: ${finalLang || '未選擇'}
2. 整體評分: ${selectedRating > 0 ? selectedRating + ' 顆星' : '未評分'}
3. 建議/新功能/Bug: ${comments || '無'}

--- 系統資訊 ---
介面語言: ${uiLang}
環境: ${osInfo}
`.trim();

      fbNextBtn.textContent = activeDict['btnSubmitting'] || '發送中...';
      fbNextBtn.style.pointerEvents = 'none';
      fbNextBtn.style.opacity = '0.7';

      try {
        const formData = new FormData();
        formData.append("access_key", "d19a0594-b64b-4593-b0e1-baf1cbeb6a4c");
        formData.append("subject", `[懸浮窗問卷] ${selectedRating > 0 ? selectedRating + '星' : ''}反饋 - 粵語詞典`);
        formData.append("message", messageBody);
        formData.append("from_name", "插件問卷系統");

        const response = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          body: formData
        });

        if (response.ok) {
          const successTitle = activeDict['fbSuccessTitle'] || '✅ 感謝您的反饋！';
          const successDesc = activeDict['fbSuccessDesc'] || '我們將持續優化插件體驗。';
          feedbackWidget.innerHTML = `<div style="padding: 40px 20px; text-align: center; color: var(--text-primary); font-size: 14px; font-weight: 500;">${successTitle}<br><span style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; display: block; font-weight: 400;">${successDesc}</span></div>`;
          
          setTimeout(() => {
            feedbackWidget.style.display = 'none';
          }, 3000);

          chrome.storage.local.set({ v157_feedback_done: true });
        } else {
          throw new Error('網絡請求失敗');
        }
      } catch (error) {
        alert(activeDict['fbErrorAlert'] || '反饋發送失敗，請稍後再試。');
        fbNextBtn.textContent = activeDict['btnSubmit'] || '提交';
        fbNextBtn.style.pointerEvents = 'auto';
        fbNextBtn.style.opacity = '1';
      }
    }
  }

  function handleHashScroll() {
    const hash = window.location.hash;
    if (!hash) return;
    const target = document.querySelector(hash);
    if (target) {
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
        target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.45)';
        setTimeout(() => {
          target.style.boxShadow = '';
        }, 2000);
      }, 250);
    }
  }

  window.addEventListener('hashchange', handleHashScroll);
  setTimeout(handleHashScroll, 300);

  });
