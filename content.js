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
  let currentRange = null; // 儲存當前選中的範圍
  let currentWord = null; // 追蹤當前顯示的詞

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
    document.body.appendChild(popup);
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
    chrome.storage.sync.get(['enabled', 'displayMode'], (result) => {
      isEnabled = result.enabled !== false; // 默認開啟
      displayMode = result.displayMode || 'jyutping';
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

      // ★ 最優先檢查：如果有可編輯元素正在獲得焦點，完全跳過
      // 防止 IME 輸入法被干擾（特別是 Claude/Gemini 等網站）
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable ||
        activeEl.getAttribute('contenteditable') === 'true' ||
        activeEl.closest('[contenteditable="true"]')
      )) {
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

    // 滾動時隱藏彈窗
    document.addEventListener('scroll', () => {
      // 如果有可編輯元素正在獲得焦點，不清除選區
      if (hasEditableFocus()) {
        if (popup) popup.style.display = 'none';
        return;
      }
      hidePopup();
    });

    // 點擊時清除彈窗，開始選擇模式
    document.addEventListener('mousedown', () => {
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
    const clientX = e.clientX;
    const clientY = e.clientY;

    // 檢查是否在可編輯元素上（輸入框、文本域、contenteditable）
    const targetElement = document.elementFromPoint(clientX, clientY);
    if (isEditableElement(targetElement)) {
      currentWord = null;
      hidePopup();
      return;
    }

    // 檢查是否有可編輯元素正在獲得焦點（防止搶焦）
    if (isEditableElement(document.activeElement)) {
      currentWord = null;
      hidePopup();
      return;
    }
    
    // 獲取滑鼠位置的文字（支持 Shadow DOM）
    const range = getCaretRangeFromPointInShadow(clientX, clientY);
    if (!range) {
      currentWord = null;
      hidePopup();
      return;
    }

    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
      currentWord = null;
      hidePopup();
      return;
    }

    // 使用精確定位找出最近的字符
    const offset = getAccurateOffset(textNode, clientX, clientY);
    if (offset === -1) {
      currentWord = null;
      hidePopup();
      return;
    }

    // 提取文字內容
    const text = textNode.textContent;
    
    // 從當前位置往後取 15 個字符（用於匹配詞組）
    const searchText = text.substring(offset, offset + 15);
    
    // 查詞
    const result = lookupWord(searchText);
    if (result) {
      // 如果是同一個詞，不更新彈窗位置
      if (currentWord === result.word) {
        return;
      }
      
      // 新詞，更新顯示
      currentWord = result.word;
      highlightText(textNode, offset, result.length);
      // 使用 clientX/clientY（position: fixed 不需要 scroll offset）
      const popupX = e.clientX;
      const popupY = e.clientY;

      
      showPopup(result, popupX, popupY);
    } else {
      currentWord = null;
      hidePopup();
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

  // 查詞函數：從長到短匹配
  function lookupWord(text) {
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

  // 顯示彈窗
  function showPopup(result, x, y) {
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

    if (entry.english && entry.english.length > 0) {
      const definitions = entry.english.slice(0, 5).join('; '); // 最多顯示 5 個釋義
      html += `
        <div class="definition-section">
          ${definitions}
        </div>
      `;
    }

    popup.innerHTML = html;

    // 計算彈窗位置（position: fixed，使用視窗座標）
    const popupWidth = 320;
    const popupHeight = 150;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left, top;

    // 水平位置：優先顯示在右邊
    if (x + 5 + popupWidth <= viewportWidth) {
      // 右邊放得下
      left = x + 5;
    } else {
      // 右邊放唔落，將彈窗中心對齊滑鼠位置，但確保唔超出邊界
      left = x - popupWidth / 2;
      // 確保唔超出左邊界
      if (left < 5) {
        left = 5;
      }
      // 確保唔超出右邊界
      if (left + popupWidth > viewportWidth - 5) {
        left = viewportWidth - popupWidth - 5;
      }
    }

    // 垂直位置：優先顯示在下方，如果放不下則顯示在上方
    if (y + 20 + popupHeight <= viewportHeight) {
      top = y + 20;
    } else {
      top = y - popupHeight - 10;
    }
    // 使用 setProperty 確保樣式不被覆蓋
    popup.style.setProperty('position', 'fixed', 'important');
    popup.style.setProperty('left', left + 'px', 'important');
    popup.style.setProperty('top', top + 'px', 'important');
    popup.style.display = 'block';
  }

  // 隱藏彈窗
  function hidePopup() {
    if (popup) {
      popup.style.display = 'none';
    }
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
    const selection = window.getSelection();
    selection.removeAllRanges();
    currentRange = null;
  }

  // 監聽來自 popup 的消息（切換開關、設定等）
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleEnabled') {
      isEnabled = request.enabled;
      if (!isEnabled) {
        hidePopup();
      }
    } else if (request.action === 'changeDisplayMode') {
      displayMode = request.mode;
    }
  });

  // 啟動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
