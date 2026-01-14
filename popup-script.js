/**
 * 粵語懸浮詞典 - Popup Script
 * 處理設定頁面的邏輯
 */

document.addEventListener('DOMContentLoaded', () => {
  const enabledToggle = document.getElementById('enabledToggle');
  const displayModeSelect = document.getElementById('displayMode');

  // 載入已保存的設定
  chrome.storage.sync.get(['enabled', 'displayMode'], (result) => {
    enabledToggle.checked = result.enabled !== false; // 默認啟用
    displayModeSelect.value = result.displayMode || 'jyutping';
  });

  // 監聽開關切換
  enabledToggle.addEventListener('change', () => {
    const enabled = enabledToggle.checked;
    
    // 保存設定
    chrome.storage.sync.set({ enabled });
    
    // 通知所有 content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleEnabled',
          enabled: enabled
        }).catch(() => {
          // 忽略錯誤（某些頁面可能無法注入 content script）
        });
      });
    });
  });

  // 監聽顯示模式切換
  displayModeSelect.addEventListener('change', () => {
    const mode = displayModeSelect.value;
    
    // 保存設定
    chrome.storage.sync.set({ displayMode: mode });
    
    // 通知所有 content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'changeDisplayMode',
          mode: mode
        }).catch(() => {
          // 忽略錯誤
        });
      });
    });
  });
});
