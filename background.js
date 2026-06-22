/**
 * 粵語懸浮詞典 - Background Service Worker
 * 處理 Chrome TTS、Edge TTS、Azure Speech 和 Bert-VITS2 調用
 */

import GoogleAnalytics from './scripts/google-analytics.js';

// 記錄背景腳本未捕捉的錯誤
addEventListener('unhandledrejection', async (event) => {
  GoogleAnalytics.fireEvent('extension_error', {
    message: event.reason ? event.reason.message : 'Unknown error'
  });
});

const BERT_VITS2_SPACE = 'https://naozumi0512-bert-vits2-cantonese-yue.hf.space';
const AZURE_TTS_PROXY = 'http://114.55.243.162:8090';

// 監聽來自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'chromeTtsSpeak') {
    GoogleAnalytics.fireEvent('tts_play', { engine: 'chromeTts' });
    chrome.tts.speak(request.text, {
      lang: request.options.lang || 'zh-HK',
      rate: request.options.rate || 0.9,
      onEvent: (event) => {
        if (event.type === 'end' || event.type === 'interrupted' || event.type === 'cancelled' || event.type === 'error') {
          if (event.type === 'error') {
            console.error('Chrome TTS error:', event.errorMessage);
          }
          if (sender && sender.tab) {
            chrome.tabs.sendMessage(sender.tab.id, { action: 'ttsEnded' }).catch(() => {});
          }
        }
      }
    });
  } else if (request.action === 'edgeTtsSpeak') {
    GoogleAnalytics.fireEvent('tts_play', { engine: 'edgeTts' });
    handleEdgeTts(request.text, request.baseUrl, request.rate, sender.tab.id);
  } else if (request.action === 'azureTtsSpeak') {
    GoogleAnalytics.fireEvent('tts_play', { engine: 'azureTts' });
    handleAzureTts(request.text, request.azureKey, request.azureRegion, request.azureVoice, request.rate, sender.tab.id);
  } else if (request.action === 'azureTtsProxySpeak') {
    GoogleAnalytics.fireEvent('tts_play', { engine: 'azureTtsProxy' });
    handleAzureTtsProxy(request.text, request.azureVoice, request.rate, sender.tab.id);
  } else if (request.action === 'bertVits2Speak') {
    GoogleAnalytics.fireEvent('tts_play', { engine: 'bertVits2' });
    handleBertVits2(request.text, request.rate || 1.0, sender.tab.id);
  } else if (request.action === 'translate') {
    GoogleAnalytics.fireEvent('translate', { type: 'bing' });
    handleTranslate(request, sender.tab.id);
  } else if (request.action === 'aiTranslate') {
    GoogleAnalytics.fireEvent('translate', { type: 'ai' });
    handleAiTranslate(request, sender.tab.id);
  } else if (request.action === 'aiTranslateParagraph') {
    GoogleAnalytics.fireEvent('translate', { type: 'ai_paragraph' });
    handleAiTranslateParagraph(request, sender.tab.id);
  } else if (request.action === 'aiChatQuery') {
    handleAiChatQuery(request, sendResponse);
    return true; // Keep channel open
  } else if (request.action === 'openOptionsPage') {
    chrome.runtime.openOptionsPage();
  }
  return true;
});

// Edge TTS 請求處理
async function handleEdgeTts(text, baseUrl, rate, tabId) {
  try {
    const url = baseUrl.replace(/\/$/, '') + '/v1/audio/speech';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        voice: 'zh-HK-HiuMaanNeural',
        model: 'tts-1',
        speed: rate
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      chrome.tabs.sendMessage(tabId, {
        action: 'playAudio',
        audioData: reader.result
      }).catch(() => {});
    };
    reader.readAsDataURL(blob);
    
  } catch (error) {
    console.error('Edge TTS error:', error);
  }
}

// Azure Speech TTS 請求處理
async function handleAzureTts(text, apiKey, region, voice, rate, tabId) {
  try {
    voice = voice || 'zh-HK-HiuMaanNeural';
    // Rate: 1.0 = default, convert to SSML percentage
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
      throw new Error(`Azure TTS error: ${response.status}`);
    }
    
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      chrome.tabs.sendMessage(tabId, {
        action: 'playAudio',
        audioData: reader.result
      }).catch(() => {});
    };
    reader.readAsDataURL(blob);
    
  } catch (error) {
    console.error('Azure TTS error:', error);
  }
}

// Azure Speech TTS 代理請求處理（通過阿里雲代理，密鑰在伺服器端）
async function handleAzureTtsProxy(text, voice, rate, tabId) {
  try {
    const response = await fetch(`${AZURE_TTS_PROXY}/v1/azure/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        voice: voice || 'zh-HK-HiuMaanNeural',
        speed: rate
      })
    });
    
    if (!response.ok) {
      throw new Error(`Azure TTS proxy error: ${response.status}`);
    }
    
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      chrome.tabs.sendMessage(tabId, {
        action: 'playAudio',
        audioData: reader.result
      }).catch(() => {});
    };
    reader.readAsDataURL(blob);
    
  } catch (error) {
    console.error('Azure TTS proxy error:', error);
  }
}

// Bert-VITS2 請求處理 (Hugging Face Gradio 4 API)
async function handleBertVits2(text, rate, tabId) {
  try {
    console.log('Bert-VITS2: Starting request for text:', text);
    
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
      throw new Error(`Bert-VITS2 /call error: ${callResponse.status}`);
    }
    
    const callResult = await callResponse.json();
    const eventId = callResult.event_id;
    console.log('Bert-VITS2: Got event_id:', eventId);
    
    if (!eventId) {
      throw new Error('No event_id received');
    }
    
    // Step 2: Poll the event endpoint for result
    const resultResponse = await fetch(`${BERT_VITS2_SPACE}/call/tts_fn/${eventId}`);
    const resultText = await resultResponse.text();
    console.log('Bert-VITS2: Raw response:', resultText);
    
    // Parse SSE response - look for "complete" event
    const lines = resultText.split('\n');
    let audioPath = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('data:')) {
        const dataStr = line.substring(5).trim();
        try {
          const data = JSON.parse(dataStr);
          // Try different positions in the array to find audio info
          if (Array.isArray(data)) {
            for (let j = 0; j < data.length; j++) {
              const item = data[j];
              if (item && typeof item === 'object') {
                if (item.path) {
                  audioPath = item.path;
                  break;
                } else if (item.url) {
                  audioPath = item.url;
                  break;
                } else if (item.name) {
                  audioPath = item.name;
                  break;
                }
              }
            }
            if (audioPath) break;
          }
        } catch (e) {
          // Not JSON, continue
        }
      }
    }
    
    if (!audioPath) {
      throw new Error('No audio path in response');
    }
    
    console.log('Bert-VITS2: Audio path:', audioPath);
    
    // Step 3: Fetch the audio file
    let audioUrl;
    if (audioPath.startsWith('http')) {
      audioUrl = audioPath;
    } else {
      audioUrl = `${BERT_VITS2_SPACE}/file=${audioPath}`;
    }
    
    console.log('Bert-VITS2: Fetching audio from:', audioUrl);
    
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    }
    
    const blob = await audioResponse.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      chrome.tabs.sendMessage(tabId, {
        action: 'playAudio',
        audioData: reader.result
      }).catch(() => {});
    };
    reader.readAsDataURL(blob);
    
  } catch (error) {
    console.error('Bert-VITS2 error:', error);
  }
}

// ==================== 翻譯功能（免費 API，無需配置） ====================

// 主翻譯處理函數：將粵語同時翻譯成多個語言
async function handleTranslate(request, tabId) {
  const { text, transLang, transLangs } = request;
  
  let targetLangs = [];
  if (transLangs && Array.isArray(transLangs)) {
    targetLangs = transLangs;
  } else if (transLang) {
    if (transLang === 'both') targetLangs = ['zh-Hans', 'en'];
    else if (transLang === 'mandarin') targetLangs = ['zh-Hans'];
    else if (transLang === 'english') targetLangs = ['en'];
    else targetLangs = ['zh-Hans', 'en'];
  } else {
    targetLangs = ['zh-Hans', 'en']; // fallback
  }

  try {
    // 預先確保 token 已獲取，避免多個翻譯請求同時去搶 token
    await getBingAccessToken();
    
    // Bing 原生支持 yue（粵語），並行發送需要的翻譯請求
    const promises = targetLangs.map(lang => translateWithBing(text, 'yue', lang));
    const results = await Promise.all(promises);
    
    const translations = {};
    for (let i = 0; i < targetLangs.length; i++) {
      translations[targetLangs[i]] = results[i];
    }
    
    // 兼容舊版
    const mandarin = translations['zh-Hans'] || null;
    const english = translations['en'] || null;

    chrome.tabs.sendMessage(tabId, {
      action: 'translateResult',
      success: true,
      translations: translations,
      mandarin: mandarin, // fallback compatibility
      english: english // fallback compatibility
    }).catch(() => {});
  } catch (error) {
    console.error('翻譯失敗:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'translateResult',
      success: false,
      error: error.message
    }).catch(() => {});
  }
}

// Bing 翻譯（免費，通過抓取頁面 token 調用）
let bingAccessToken = null;
let bingTokenPromise = null;

async function getBingAccessToken() {
  // 1. 先檢查記憶體中是否有有效的 token
  if (bingAccessToken && (Date.now() - bingAccessToken.tokenTs < bingAccessToken.tokenExpiryInterval)) {
    return bingAccessToken;
  }

  // 2. 如果沒有，嘗試從 storage 讀取（防止 Service Worker 休眠後丟失，省去 1 秒的獲取延遲）
  const stored = await chrome.storage.local.get('bingAccessToken');
  if (stored.bingAccessToken && (Date.now() - stored.bingAccessToken.tokenTs < stored.bingAccessToken.tokenExpiryInterval)) {
    bingAccessToken = stored.bingAccessToken;
    return bingAccessToken;
  }
  
  // 3. 如果已經在獲取中，直接等待同一個 Promise（防止並發請求時抓取多次 token）
  if (bingTokenPromise) {
    return bingTokenPromise;
  }
  
  // 4. 重新發送請求抓取最新 Token
  bingTokenPromise = (async () => {
    try {
      const html = await (await fetch('https://www.bing.com/translator')).text();
      const IG = html.match(/IG:"([^"]+)"/)?.[1];
      const IID = html.match(/data-iid="([^"]+)"/)?.[1];
      const paramsMatch = html.match(/params_AbusePreventionHelper\s?=\s?([^\]]+\])/)?.[1];
      
      if (!IG || !paramsMatch) {
        throw new Error('無法獲取 Bing 翻譯 Token');
      }
      
      const [key, token, interval] = JSON.parse(paramsMatch);
      bingAccessToken = { IG, IID, key, token, tokenTs: Date.now(), tokenExpiryInterval: interval, count: 0 };
      
      // 保存到 storage
      await chrome.storage.local.set({ bingAccessToken });
      
      return bingAccessToken;
    } finally {
      bingTokenPromise = null; // 請求完成後清除 Promise
    }
  })();
  
  return bingTokenPromise;
}

async function translateWithBing(text, from, to, retryCount = 0) {
  const { token, key, IG, IID } = await getBingAccessToken();
  
  // Bing 語言代碼映射
  const bingFrom = from === 'auto' ? 'auto-detect' : (from === 'zh-TW' ? 'zh-Hant' : from);
  const bingTo = to === 'zh-TW' ? 'zh-Hant' : to;
  
  const searchParams = new URLSearchParams({ IG, isVertical: '1' });
  if (IID) searchParams.set('IID', IID + '.' + bingAccessToken.count++);
  
  const response = await fetch(`https://www.bing.com/ttranslatev3?${searchParams}`, {
    method: 'POST',
    body: new URLSearchParams({ text, fromLang: bingFrom, to: bingTo, token, key })
  });
  
  if (!response.ok) {
    throw new Error(`Bing Translate 錯誤 (${response.status})`);
  }
  
  const data = await response.json();
  if (data && data[0] && data[0].translations && data[0].translations[0]) {
    return data[0].translations[0].text;
  }

  // Token 失效或被拒絕 (Bing 有時返回 200 OK，但內容是 statusCode: 401 等)
  if (data && data.statusCode) {
    bingAccessToken = null; // 清除失效的 Token
    chrome.storage.local.remove('bingAccessToken'); // 從 storage 中也清除
    if (retryCount === 0) {
      console.log('Bing Token expired or invalid, retrying...', data);
      return translateWithBing(text, from, to, 1); // 重試一次
    }
    throw new Error(`Bing API Error: ${data.errorMessage || data.statusCode}`);
  }

  throw new Error(`Bing Translate 返回空結果: ${JSON.stringify(data)}`);
}

// ==================== AI 語境翻譯 ====================

const localeFolders = {
  'zh-HK': 'zh_TW',
  'zh-CN': 'zh_CN',
  'en': 'en',
  'ja': 'ja',
  'ko': 'ko'
};

async function getDefaultPrompt(uiLang) {
  const folder = localeFolders[uiLang] || 'zh_TW';
  try {
    const res = await fetch(chrome.runtime.getURL(`_locales/${folder}/messages.json`));
    const data = await res.json();
    return data.optAIDefaultPrompt?.message || '';
  } catch (err) {
    console.error('Failed to load default prompt:', err);
    return '';
  }
}

async function handleAiTranslate(request, tabId) {
  const { word, sentence } = request;
  
  try {
    // 從 storage 讀取 AI 設定
    const settings = await chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel', 'aiLanguage', 'aiPrompt', 'uiLang']);
    const { aiBaseUrl, aiApiKey, aiModel, aiLanguage, aiPrompt, uiLang } = settings;
    
    if (!aiBaseUrl || !aiApiKey || !aiModel) {
      throw new Error('請先在設定頁面配置 AI 翻譯');
    }
    
    const targetLang = aiLanguage || '繁體中文';
    let promptTemplate = aiPrompt ? aiPrompt.trim() : '';
    if (!promptTemplate) {
      const dynamicDefault = await getDefaultPrompt(uiLang);
      promptTemplate = dynamicDefault || `你是一個粵語語言專家。用戶在閱讀粵語文章時選中了一個詞語，請根據上下文語境，用{targetLang}簡要解釋這個詞在句中的具體含義（1-2句話）。只需要回覆解釋內容本身，不需要任何格式標記。

【詞語】{word}
【句子】{sentence}`;
    }

    const prompt = promptTemplate
      .replace(/{targetLang}/g, targetLang)
      .replace(/\${targetLang}/g, targetLang)
      .replace(/{word}/g, word)
      .replace(/\${word}/g, word)
      .replace(/{sentence}/g, sentence)
      .replace(/\${sentence}/g, sentence);
    
    const url = aiBaseUrl.replace(/\/$/, '') + '/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 錯誤 (${response.status}): ${errText.substring(0, 100)}`);
    }
    
    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content?.trim() || '';
    
    if (!explanation) {
      throw new Error('AI 返回空結果');
    }
    
    chrome.tabs.sendMessage(tabId, {
      action: 'aiTranslateResult',
      success: true,
      explanation: explanation,
      word: word
    }).catch(() => {});
  } catch (error) {
    console.warn('AI 翻譯失敗:', error.message || error);
    chrome.tabs.sendMessage(tabId, {
      action: 'aiTranslateResult',
      success: false,
      error: error.message,
      word: word
    }).catch(() => {});
  }
}

// 段落整段翻譯成粵語（保留 HTML 結構）。與 handleAiTranslate 共用 AI 設定，
// 但要求更大的 max_tokens 並保留標籤/emoji，結果以 HTML 回傳給 content script。
async function handleAiTranslateParagraph(request, tabId) {
  const { html, id } = request;

  const reply = (payload) => {
    chrome.tabs.sendMessage(tabId, {
      action: 'aiTranslateParagraphResult',
      id,
      ...payload
    }).catch(() => {});
  };

  try {
    const settings = await chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel']);
    const syncSettings = await chrome.storage.sync.get(['paragraphTransEngine']);
    const engine = syncSettings.paragraphTransEngine || 'bing';
    const { aiBaseUrl, aiApiKey, aiModel } = settings;

    if (!html || !html.trim()) {
      throw new Error('沒有可翻譯的內容');
    }

    if (engine === 'bing') {
      // 移除多餘的 HTML 屬性 (保留 href) 以大幅縮減字元數，避免觸發 Bing 1000 字元限制
      let cleanHtml = html.replace(/<([a-z0-9]+)([^>]*)>/gi, (match, tag, attrs) => {
        if (tag.toLowerCase() === 'a') {
          const hrefMatch = attrs.match(/href=(["'])(.*?)\1/i);
          if (hrefMatch) return `<a href="${hrefMatch[2]}">`;
          return `<a>`;
        }
        return `<${tag}>`;
      });

      await getBingAccessToken();

      if (cleanHtml.length > 950) {
        // 段落過長，使用句子分割法分段請求
        const chunks = cleanHtml.split(/(?<=[。！？\n])(?![^<]*>)/);
        let currentBatch = '';
        const batches = [];
        for (const chunk of chunks) {
          if (currentBatch.length + chunk.length > 950) {
            if (currentBatch) batches.push(currentBatch);
            currentBatch = chunk;
          } else {
            currentBatch += chunk;
          }
        }
        if (currentBatch) batches.push(currentBatch);

        // 並行翻譯所有分段
        const promises = batches.map(batch => translateWithBing(batch, 'auto', 'yue'));
        const results = await Promise.all(promises);
        
        reply({ success: true, html: results.join('') });
        return;
      }

      // 使用 Bing 進行極速段落翻譯
      const result = await translateWithBing(cleanHtml, 'auto', 'yue');
      if (!result) {
        throw new Error('Bing Translate 返回空結果');
      }
      reply({ success: true, html: result });
      return;
    }

    // AI 翻譯邏輯
    if (!aiBaseUrl || !aiApiKey || !aiModel) {
      throw new Error('請先在設定頁面配置 AI 翻譯');
    }

    const prompt = `你是一位專業的粵語（廣東話）翻譯。請將下面這段 HTML 片段中的文字內容翻譯成自然、地道的粵語書面語。

嚴格要求：
1. 只翻譯可見文字，原樣保留所有 HTML 標籤、屬性（尤其是 <a> 的 href）、以及 emoji 與標點。
2. 標籤的結構與順序保持不變，只替換其中的文字。
3. 不要新增/刪除標籤，不要加入解釋、Markdown 或程式碼圍欄。
4. 只輸出翻譯後的 HTML 片段本身，不要任何前後綴。

待翻譯 HTML：
${html}`;

    const url = aiBaseUrl.replace(/\/$/, '') + '/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 錯誤 (${response.status}): ${errText.substring(0, 100)}`);
    }

    const data = await response.json();
    let result = data.choices?.[0]?.message?.content?.trim() || '';

    // 去除模型可能加上的 ```html ... ``` 圍欄
    result = result.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();

    if (!result) {
      throw new Error('AI 返回空結果');
    }

    reply({ success: true, html: result });
  } catch (error) {
    console.warn('段落翻譯失敗:', error.message || error);
    reply({ success: false, error: error.message || String(error) });
  }
}

// ==================== 快捷鍵命令 ====================
chrome.commands.onCommand.addListener((command) => {
  console.log('[Background] Received command:', command);
  if (command === 'inspect-ruby') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log('[Background] Found active tabs:', tabs);
      if (tabs.length > 0) {
        console.log('[Background] Sending toggleRuby message to tab:', tabs[0].id);
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleRuby' }).catch(err => {
          // Do not use console.error here as it triggers extension error badges for chrome:// URLs or unrefreshed tabs
          console.warn('[Background] Failed to send toggleRuby message (page might need refresh or is a chrome:// URL):', err.message);
        });
      }
    });
  }
});

// ==================== 快捷開關 (單擊圖標) ====================

chrome.action.onClicked.addListener(async (tab) => {
  const result = await chrome.storage.sync.get(['enabled']);
  // 默認為 true
  const isCurrentlyEnabled = result.enabled !== false;
  const newEnabledState = !isCurrentlyEnabled;

  await setExtensionState(newEnabledState);
});

// 啟動或安裝時初始化
chrome.runtime.onStartup.addListener(initState);
chrome.runtime.onInstalled.addListener(() => {
  // 創建右鍵選單
  chrome.contextMenus.create({
    id: "jyutping-parent",
    title: chrome.i18n.getMessage("extName") || "粵語懸浮詞典",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "toggle-jyutping",
    parentId: "jyutping-parent",
    title: chrome.i18n.getMessage("ctxMenuDisable") || "暫停粵語懸浮詞典",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "sep1",
    parentId: "jyutping-parent",
    type: "separator",
    contexts: ["all"]
  });


  chrome.contextMenus.create({
    id: "mode-full",
    parentId: "jyutping-parent",
    title: chrome.i18n.getMessage("optStyleFull") || "完整模式",
    type: "radio",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "mode-compact",
    parentId: "jyutping-parent",
    title: chrome.i18n.getMessage("optStyleCompact") || "精簡音標",
    type: "radio",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "sep-ruby",
    parentId: "jyutping-parent",
    type: "separator",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "toggle-ruby-menu",
    parentId: "jyutping-parent",
    title: chrome.i18n.getMessage("ctxMenuToggleRuby") || "全文粵語注音",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "sep2",
    parentId: "jyutping-parent",
    type: "separator",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "open-settings",
    parentId: "jyutping-parent",
    title: chrome.i18n.getMessage("ctxMenuSettings") || "詞典設定...",
    contexts: ["all"]
  });
  
  initState();
});

// 監聽右鍵選單點擊
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "toggle-jyutping") {
    const result = await chrome.storage.sync.get(['enabled']);
    const newEnabledState = !(result.enabled !== false);
    await setExtensionState(newEnabledState);
  } else if (info.menuItemId === "toggle-ruby-menu") {
    if (tab && tab.id) {
      const options = info.frameId !== undefined ? { frameId: info.frameId } : {};
      chrome.tabs.sendMessage(tab.id, { action: 'toggleRuby' }, options).catch(() => {});
    }
  } else if (info.menuItemId === "mode-full") {
    await chrome.storage.sync.set({ popupDisplayStyle: 'full' });
    GoogleAnalytics.fireEvent('change_setting_context', { setting: 'popupDisplayStyle', value: 'full' });
  } else if (info.menuItemId === "mode-compact") {
    await chrome.storage.sync.set({ popupDisplayStyle: 'compact' });
    GoogleAnalytics.fireEvent('change_setting_context', { setting: 'popupDisplayStyle', value: 'compact' });
  } else if (info.menuItemId === "open-settings") {
    chrome.runtime.openOptionsPage();
  }
});

// 監聽來自選項頁面的狀態改變
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.enabled !== undefined) {
      const isEnabled = changes.enabled.newValue !== false;
      updateActionBadge(isEnabled);
      updateContextMenuState(isEnabled, null);
    }
    if (changes.popupDisplayStyle !== undefined) {
      updateContextMenuState(null, changes.popupDisplayStyle.newValue);
    }
  }
});

// 初始化狀態
async function initState() {
  const result = await chrome.storage.sync.get(['enabled', 'popupDisplayStyle']);
  const isEnabled = result.enabled !== false;
  const displayStyle = result.popupDisplayStyle || 'full';
  updateActionBadge(isEnabled);
  updateContextMenuState(isEnabled, displayStyle);
}

// 統一設置擴展狀態（保存、更新 UI、通知 Tab）
async function setExtensionState(isEnabled) {
  // 保存新狀態
  await chrome.storage.sync.set({ enabled: isEnabled });

  // 更新圖標 badge 和右鍵選單
  updateActionBadge(isEnabled);
  updateContextMenuState(isEnabled, null);

  // 記錄開關事件
  GoogleAnalytics.fireEvent('toggle_extension', { enabled: isEnabled });

  // 通知所有標籤頁更新狀態
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    try {
      chrome.tabs.sendMessage(t.id, {
        action: 'toggleEnabled',
        enabled: isEnabled
      }).catch(() => {}); // 忽略無法接收消息的頁面
    } catch (e) {}
  }
}

function updateContextMenuState(isEnabled, displayStyle) {
  if (isEnabled !== null) {
    const title = isEnabled 
      ? (chrome.i18n.getMessage("ctxMenuDisable") || "暫停粵語懸浮詞典")
      : (chrome.i18n.getMessage("ctxMenuEnable") || "開啟粵語懸浮詞典");
    
    chrome.contextMenus.update("toggle-jyutping", { title: title }).catch(() => {});
  }
  
  if (displayStyle !== null) {
    const isFull = displayStyle !== 'compact';
    chrome.contextMenus.update("mode-full", { checked: isFull }).catch(() => {});
    chrome.contextMenus.update("mode-compact", { checked: !isFull }).catch(() => {});
  }
}

function updateActionBadge(isEnabled) {
  if (isEnabled) {
    // 啟用時顯示 ON，並使用彩色圖標
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#8A1C1C' }); // 香港紅
    chrome.action.setIcon({
      path: {
        "16": "icon_action.png",
        "48": "icon_action.png",
        "128": "icon_action.png"
      }
    });
  } else {
    // 停用時顯示 OFF，並使用灰色圖標
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#888888' }); // 灰色
    chrome.action.setIcon({
      path: {
        "16": "icon_action_gray.png",
        "48": "icon_action_gray.png",
        "128": "icon_action_gray.png"
      }
    });
  }
}

// ==================== AI 隨身問答 ====================

async function handleAiChatQuery(request, sendResponse) {
  const { word, sentence, originalTranslation, question, history } = request;

  try {
    const settings = await chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel', 'aiLanguage']);
    const { aiBaseUrl, aiApiKey, aiModel, aiLanguage } = settings;

    if (!aiBaseUrl || !aiApiKey || !aiModel) {
      throw new Error('請先在設定頁面配置 AI 翻譯');
    }

    const targetLang = aiLanguage || '繁體中文';

    const messages = [];

    // System instruction
    messages.push({
      role: 'system',
      content: `你是一個粵語語言專家。請用${targetLang}回答用戶關於選中字詞或句子的疑問，解答要簡明扼要、準確可靠。`
    });

    // Conversation history
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // New user question: Send selected phrase, context sentence, and question together to the AI
    let userMsg = '';
    if (word) {
      userMsg += `選中短語：「${word}」\n`;
      userMsg += `所在句子：「${sentence || ''}」\n`;
    } else {
      userMsg += `選中句子：「${sentence || ''}」\n`;
    }
    if (originalTranslation) {
      userMsg += `初始翻譯：「${originalTranslation}」\n`;
    }
    userMsg += `追問：${question}`;

    messages.push({
      role: 'user',
      content: userMsg
    });

    const url = aiBaseUrl.replace(/\/$/, '') + '/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: JSON.stringify({
        model: aiModel,
        messages: messages,
        max_tokens: 300,
        temperature: 0.5
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 錯誤 (${response.status}): ${errText.substring(0, 100)}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';

    if (!reply) {
      throw new Error('AI 返回空結果');
    }

    sendResponse({ success: true, reply: reply });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}
