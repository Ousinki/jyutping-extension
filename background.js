/**
 * 粵語懸浮詞典 - Background Service Worker
 * 處理 Chrome TTS、Edge TTS、Azure Speech 和 Bert-VITS2 調用
 */

const BERT_VITS2_SPACE = 'https://naozumi0512-bert-vits2-cantonese-yue.hf.space';
const AZURE_TTS_PROXY = 'http://114.55.243.162:8090';

// 監聽來自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'chromeTtsSpeak') {
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
    handleEdgeTts(request.text, request.baseUrl, request.rate, sender.tab.id);
  } else if (request.action === 'azureTtsSpeak') {
    handleAzureTts(request.text, request.azureKey, request.azureRegion, request.azureVoice, request.rate, sender.tab.id);
  } else if (request.action === 'azureTtsProxySpeak') {
    handleAzureTtsProxy(request.text, request.azureVoice, request.rate, sender.tab.id);
  } else if (request.action === 'bertVits2Speak') {
    handleBertVits2(request.text, request.rate || 1.0, sender.tab.id);
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
