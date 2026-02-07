/**
 * 粵語懸浮詞典 - Popup Script
 * 處理設定頁面的邏輯
 */

document.addEventListener('DOMContentLoaded', () => {
  const enabledToggle = document.getElementById('enabledToggle');
  const displayModeSelect = document.getElementById('displayMode');
  const openOptionsLink = document.getElementById('openOptions');

  // 載入已保存的設定
  chrome.storage.sync.get(['enabled', 'displayMode'], (result) => {
    enabledToggle.checked = result.enabled !== false; // 默認啟用
    displayModeSelect.value = result.displayMode || 'jyutping';
  });

  // 監聽開關切換
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

  // 打開選項頁面
  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // 通知所有 content scripts
  function notifyContentScripts(message) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // 忽略錯誤（某些頁面可能無法注入 content script）
        });
      });
    });
  }
});
