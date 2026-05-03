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
        if (event.type === 'error') {
          console.error('Chrome TTS error:', event.errorMessage);
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
      });
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
      });
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
      });
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
      });
    };
    reader.readAsDataURL(blob);
    
  } catch (error) {
    console.error('Bert-VITS2 error:', error);
  }
}

// ==================== 翻譯功能（免費 API，無需配置） ====================

// 主翻譯處理函數：將粵語同時翻譯成普通話和英文
async function handleTranslate(request, tabId) {
  const { text } = request;
  
  try {
    // 預先確保 token 已獲取，避免兩個翻譯請求同時去搶 token
    await getBingAccessToken();
    
    // Bing 原生支持 yue（粵語），並行發送兩個翻譯請求
    const [mandarin, english] = await Promise.all([
      translateWithBing(text, 'yue', 'zh-Hans'),
      translateWithBing(text, 'yue', 'en')
    ]);
    
    chrome.tabs.sendMessage(tabId, {
      action: 'translateResult',
      success: true,
      mandarin: mandarin,
      english: english
    });
  } catch (error) {
    console.error('翻譯失敗:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'translateResult',
      success: false,
      error: error.message
    });
  }
}

// Bing 翻譯（免費，通過抓取頁面 token 調用）
let bingAccessToken = null;
let bingTokenPromise = null;

async function getBingAccessToken() {
  // Token 有效期內直接返回
  if (bingAccessToken && (Date.now() - bingAccessToken.tokenTs < bingAccessToken.tokenExpiryInterval)) {
    return bingAccessToken;
  }
  
  // 如果已經在獲取中，直接等待同一個 Promise（防止並發請求時抓取多次 token）
  if (bingTokenPromise) {
    return bingTokenPromise;
  }
  
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
      return bingAccessToken;
    } finally {
      bingTokenPromise = null; // 請求完成後清除 Promise
    }
  })();
  
  return bingTokenPromise;
}

async function translateWithBing(text, from, to) {
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
  throw new Error('Bing Translate 返回空結果');
}

// ==================== AI 語境翻譯 ====================

async function handleAiTranslate(request, tabId) {
  const { word, sentence } = request;
  
  try {
    // 從 storage 讀取 AI 設定
    const settings = await chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel']);
    const { aiBaseUrl, aiApiKey, aiModel } = settings;
    
    if (!aiBaseUrl || !aiApiKey || !aiModel) {
      throw new Error('請先在設定頁面配置 AI 翻譯');
    }
    
    const prompt = `你是一個粵語語言專家。用戶在閱讀粵語文章時選中了一個詞語，請根據上下文語境，用繁體中文簡要解釋這個詞在句中的具體含義（1-2句話）。只需要回覆解釋內容本身，不需要任何格式標記。

【詞語】${word}
【句子】${sentence}`;
    
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
    });
  } catch (error) {
    console.error('AI 翻譯失敗:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'aiTranslateResult',
      success: false,
      error: error.message,
      word: word
    });
  }
}

// ==================== 快捷開關 (單擊圖標) ====================

chrome.action.onClicked.addListener(async (tab) => {
  const result = await chrome.storage.local.get(['enabled']);
  // 默認為 true
  const isCurrentlyEnabled = result.enabled !== false;
  const newEnabledState = !isCurrentlyEnabled;

  // 保存新狀態
  await chrome.storage.local.set({ enabled: newEnabledState });

  // 更新圖標 badge 來顯示狀態
  updateActionBadge(newEnabledState);

  // 記錄開關事件
  GoogleAnalytics.fireEvent('toggle_extension', { enabled: newEnabledState });

  // 通知所有標籤頁更新狀態
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    try {
      chrome.tabs.sendMessage(t.id, {
        action: 'toggleEnabled',
        enabled: newEnabledState
      }).catch(() => {}); // 忽略無法接收消息的頁面
    } catch (e) {}
  }
});

// 啟動或安裝時初始化 badge
chrome.runtime.onStartup.addListener(initBadge);
chrome.runtime.onInstalled.addListener(initBadge);

async function initBadge() {
  const result = await chrome.storage.local.get(['enabled']);
  updateActionBadge(result.enabled !== false);
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
