/**
 * 粵語懸浮詞典 - Options Script
 * 處理設定頁面的邏輯
 */

document.addEventListener('DOMContentLoaded', () => {
  const enabledToggle = document.getElementById('enabledToggle');
  const displayModeSelect = document.getElementById('displayMode');
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

  // 載入已保存的設定
  chrome.storage.sync.get([
    'enabled', 'displayMode', 'ttsEnabled', 
    'ttsEngine', 'edgeTtsMode', 'edgeTtsUrl', 'azureTtsMode', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'ttsRate'
  ], (result) => {
    enabledToggle.checked = result.enabled !== false;
    displayModeSelect.value = result.displayMode || 'jyutping';
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
    notifyContentScripts({ action: 'toggleEnabled', enabled });
  });

  // 監聽顯示模式切換
  displayModeSelect.addEventListener('change', () => {
    const mode = displayModeSelect.value;
    chrome.storage.sync.set({ displayMode: mode });
    notifyContentScripts({ action: 'changeDisplayMode', mode });
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

  // 測試 TTS 按鈕
  testTtsBtn.addEventListener('click', async () => {
    const engine = ttsEngineSelect.value;
    const rate = parseFloat(ttsRateSlider.value);
    const testText = '你好，歡迎使用粵語詞典';
    
    testTtsBtn.disabled = true;
    testTtsBtn.textContent = '正在播放...';
    
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
      測試語音
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
});
