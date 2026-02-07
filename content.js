/**
 * 粵語懸浮詞典 - Content Script
 * 實現滑鼠懸停中文字顯示粵語發音和解釋
 */

(function() {
  'use strict';

  let dictionary = {};
  let popup = null;
  let isEnabled = true;
  let displayMode = 'jyutping'; // 'jyutping' 或 'yale'
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
  let currentRange = null; // 儲存當前選中的範圍
  let currentWord = null; // 追蹤當前顯示的詞
  let isMouseOverPopup = false; // 滑鼠是否在彈窗上
  let hideTimeout = null; // 延遲隱藏主彈窗計時器
  let justNavigated = false; // 是否剛進行鏈接導航
  
  // TTS 音頻緩存（避免重複 API 調用）
  const ttsCache = new Map(); // key: "engine:text" -> audioData
  const TTS_CACHE_MAX = 20;
  let pendingTtsText = ''; // 追蹤正在請求的文本

  // 初始化：創建彈窗元素
  function init() {
    createPopup();
    loadDictionary();
    loadSettings();
    setupEventListeners();
  }

  // 創建彈窗 DOM 元素
  function createPopup() {
    popup = document.createElement('div');
    popup.id = 'cantonese-popup-dict';
    popup.style.display = 'none';
    
    // 內部結構：左側主要內容，右側例句（初始隱藏）
    popup.innerHTML = `
      <div class="popup-container">
        <div class="popup-main"></div>
        <div class="popup-examples" style="display:none;"></div>
      </div>
    `;
    
    document.body.appendChild(popup);

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

    // 點擊彈窗內部不關閉
    popup.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }

  // 載入詞典數據
  async function loadDictionary() {
    try {
      const url = chrome.runtime.getURL('dictionary.json');
      const response = await fetch(url);
      dictionary = await response.json();
      console.log('粵語詞典已載入，詞條數：', Object.keys(dictionary).length);
    } catch (error) {
      console.error('載入詞典失敗：', error);
    }
  }

  // 載入用戶設定
  function loadSettings() {
    chrome.storage.sync.get([
      'enabled', 'displayMode', 'ttsEnabled', 
      'ttsEngine', 'edgeTtsMode', 'edgeTtsUrl', 'azureTtsMode', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'ttsRate'
    ], (result) => {
      isEnabled = result.enabled !== false;
      displayMode = result.displayMode || 'jyutping';
      ttsEnabled = result.ttsEnabled !== false;
      ttsEngine = result.ttsEngine || 'webSpeech';
      edgeTtsMode = result.edgeTtsMode || 'default';
      edgeTtsUrl = result.edgeTtsUrl || '';
      azureTtsMode = result.azureTtsMode || 'default';
      azureTtsKey = result.azureTtsKey || '';
      azureTtsRegion = result.azureTtsRegion || '';
      azureTtsVoice = result.azureTtsVoice || 'zh-HK-HiuMaanNeural';
      ttsRate = result.ttsRate || 0.9;
    });
  }

  // 粵語朗讀功能
  async function speakCantonese(text) {
    if (!ttsEnabled) return;
    
    console.log('speakCantonese called, engine:', ttsEngine);
    
    // 檢查緩存（僅對需要 API 調用的引擎）
    const cacheKey = `${ttsEngine}:${ttsRate}:${text}`;
    if (['edgeTts', 'azureTts', 'bertVits2'].includes(ttsEngine)) {
      const cachedAudio = ttsCache.get(cacheKey);
      if (cachedAudio) {
        console.log('TTS cache hit:', text);
        const audio = new Audio(cachedAudio);
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
    let isSelecting = false; // 用戶正在選擇文字

    // 使用 mousemove 實現實時跟隨
    document.addEventListener('mousemove', (e) => {
      if (!isEnabled || isSelecting) return;

      // 如果滑鼠在彈窗上，不處理
      if (isMouseOverPopup) return;

      // 如果剛導航過（粘滯模式），不處理頁面文字掃描，直到用戶進入彈窗
      if (justNavigated) return;

      // ★ 最優先檢查：如果有可編輯元素正在獲得焦點，完全跳過
      // 防止 IME 輸入法被干擾（特別是 Claude/Gemini 等網站）
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
      // 如果有可編輯元素正在獲得焦點，不清除選區
      if (hasEditableFocus()) {
        if (popup) popup.style.display = 'none';
        return;
      }
      hidePopup();
    });

    // 點擊時清除彈窗，開始選擇模式
    document.addEventListener('mousedown', (e) => {
      // 如果點擊在彈窗內部，不隱藏（允許選擇文字）
      if (popup && popup.contains(e.target)) {
        return;
      }

      // 如果有高亮詞且點擊在高亮區域內，觸發朗讀
      if (currentWord && currentRange) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          // 檢查點擊是否在高亮區域內
          if (e.clientX >= rect.left && e.clientX <= rect.right &&
              e.clientY >= rect.top && e.clientY <= rect.bottom) {
            speakCantonese(currentWord);
            e.preventDefault(); // 防止選區被清除
            return; // 不隱藏彈窗，保持顯示
          }
        }
      }
      
      isSelecting = true;
      currentWord = null;
      // 如果有可編輯元素正在獲得焦點，只隱藏彈窗，不清除選區
      if (hasEditableFocus()) {
        if (popup) popup.style.display = 'none';
        return;
      }
      hidePopup();
    });

    // 釋放滑鼠後延遲恢復
    document.addEventListener('mouseup', () => {
      // 延遲 300ms 後恢復，讓用戶有時間完成選擇
      setTimeout(() => {
        isSelecting = false;
      }, 300);
    });

    // 滾動時隱藏彈窗
    document.addEventListener('scroll', () => {
      // 如果點擊觸發，滾動時可能想保持？
      // 為了避免遮擋，還是隱藏吧，或者改為跟隨（複雜）
      hidePopup();
    });

    // 按 ESC 關閉
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hidePopup();
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
    
    // 如果是用戶正在瀏覽的導航彈窗，且滑鼠不在彈窗上
    // 此時不應該讓移動滑鼠打斷導航，除非用戶再次進入
    // (這部分邏輯已在 setupEventListeners 中處理)

    const clientX = e.clientX;
    const clientY = e.clientY;

    // 獲取滑鼠位置的文字（支持 Shadow DOM）
    const range = getCaretRangeFromPointInShadow(clientX, clientY);
    if (!range) {
      // 滑鼠在空白處
      // 如果剛導航過，不隱藏彈窗（保持顯示直到用戶進入彈窗）
      if (!justNavigated) {
        scheduleHidePopup();
      }
      return;
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
    
    // 從當前位置往後取 15 個字符（標準查詞行為：只匹配光標後的詞）
    // 這樣符合大多數詞典插件（如 Zhongwen, Rikaikun）的習慣
    const searchText = text.substring(offset, offset + 15);
    const result = lookupWord(searchText);
    
    if (result) {
      // 如果是用戶正在瀏覽的導航彈窗，而現在滑鼠移到了其他文字上
      // 我們應該取消導航狀態，轉為顯示新詞
      justNavigated = false;

      // 如果是同一個詞，且彈窗已顯示，則跳過
      // 如果彈窗隱藏（bug 修復），則繼續執行 showPopup
      if (currentWord === result.word && popup.style.display !== 'none') {
        // 如果有待執行的隱藏任務，取消它（因為用戶又回來了）
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        return;
      }
      
      // 新詞，更新顯示
      currentWord = result.word;
      highlightText(textNode, offset, result.length);
      
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

  // 顯示彈窗
  // rect: { left, right, top, bottom, width, height }
  function showPopup(result, rect) {
    const entry = result.entry;
    
    // 選擇顯示的拼音格式
    const pronunciation = displayMode === 'yale' 
      ? (entry.yale || entry.jyutping)
      : entry.jyutping;

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
        </div>
      `;
    }

    const popupMain = popup.querySelector('.popup-main');
    const popupExamples = popup.querySelector('.popup-examples');
    
    // 重置樣式
    popupExamples.style.display = 'none';
    popupExamples.innerHTML = '';
    popupMain.innerHTML = '';
    popup.classList.remove('expanded-mode');
    popup.style.width = '320px'; // 默認寬度

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
        speakText(entry.traditional);
      });
    }

    // 綁定發音點擊（只有藍色拼音文字可發聲，標籤不觸發）
    const pronunciationText = popupMain.querySelector('.pronunciation-text');
    if (pronunciationText) {
      pronunciationText.style.cursor = 'pointer';
      pronunciationText.addEventListener('click', (e) => {
        e.stopPropagation();
        speakText(entry.traditional);
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
      
      const x = rect.left;
      const y = rect.bottom; // 默認參考點

      // 水平位置：默認居中對齊或者靠左
      if (x + 5 + popupWidth <= viewportWidth) {
        left = x + 5;
      } else {
        // 右側空間不足，往左放
        left = viewportWidth - popupWidth - 10;
        if (left < 5) left = 5;
      }

      // 垂直位置：優先顯示在文字下方
      // 檢查下方空間是否足夠 (使用 rect.bottom)
      if (rect.bottom + 5 + popupHeight <= viewportHeight) {
        top = rect.bottom + 5;
      } else {
        // 下方不足，放上方 (使用 rect.top)
        top = rect.top - popupHeight - 5;
        
        // 如果上方也不足（例如頂部大段文字），則強制放下方（可能需要滾動），或者放頂部
        if (top < 5) {
            // 如果上方放不下，優先保證頂部可見
            if (rect.bottom + 5 + popupHeight > viewportHeight) {
                // 屏幕太矮，無法完整顯示，優先顯示頂部
                top = 5; 
            } else {
                top = 5;
            }
        }
      }
      
      popup.style.position = 'fixed';
      popup.style.left = left + 'px';
      popup.style.top = top + 'px';
      
      popup.style.visibility = 'visible';
    } else {
       popup.style.display = 'block';
    }
    popup.style.pointerEvents = 'auto'; // 允許交互

    // 朗讀（如果是新詞）
    // speakCantonese(result.word); 
  }

  // 渲染例句到右側面板
  function renderExamples(examples) {
    const popupExamples = popup.querySelector('.popup-examples');
    let html = '<div class="example-title">例句</div>';
    
    examples.forEach(eg => {
      const engPart = eg.eng ? `<div class="example-eng">${eg.eng}</div>` : '';
      html += `
        <div class="example-item">
          <div class="example-yue">${eg.yue}</div>
          ${engPart}
        </div>
      `;
    });
    popupExamples.innerHTML = html;
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
      // examplesPopup 已廢棄，不再使用
    }
    currentWord = null;
    removeHighlight();
  }

  // 選中文字（使用原生 Selection API）
  function highlightText(textNode, offset, length) {
    try {
      // 創建 Range
      const range = document.createRange();
      range.setStart(textNode, offset);
      range.setEnd(textNode, Math.min(offset + length, textNode.textContent.length));

      // 使用瀏覽器原生 Selection API 選中文字
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      currentRange = range;
    } catch (e) {
      console.log('Selection failed:', e);
    }
  }

  // 移除選中
  function removeHighlight() {
    if (currentRange) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      currentRange = null;
    }
  }

  // 監聽來自 popup 的消息（切換開關、設定等）
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleEnabled') {
      isEnabled = request.enabled;
      if (!isEnabled) hidePopup();
    } else if (request.action === 'changeDisplayMode') {
      displayMode = request.mode;
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
      // 緩存音頻數據
      if (pendingTtsText) {
        if (ttsCache.size >= TTS_CACHE_MAX) {
          // 刪除最舊的緩存條目
          const firstKey = ttsCache.keys().next().value;
          ttsCache.delete(firstKey);
        }
        ttsCache.set(pendingTtsText, request.audioData);
        pendingTtsText = '';
      }
      // 播放音頻
      const audio = new Audio(request.audioData);
      audio.play();
    }
  });

  // 啟動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
