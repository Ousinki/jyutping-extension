const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';

// 請替換成你在 GA 後台獲取的金鑰
const MEASUREMENT_ID = 'G-3YTJJTTEM4';
const API_SECRET = 'CxWTgG-FQ9OrCEliKCBRDg';

// 是否開啟除錯模式（開啟後請求會送到 debug endpoint，可在 GA 後台查看是否有錯誤，且不會計入正式數據）
const IS_DEBUG_MODE = false;

// Session 預設過期時間（分鐘）
const SESSION_EXPIRATION_IN_MIN = 30;
const DEFAULT_ENGAGEMENT_TIME_IN_MSEC = 100;

class GoogleAnalytics {
  /**
   * 生成隨機字串做為 ID
   */
  static getRandomId() {
    const digits = '123456789'.split('');
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += digits[Math.floor(Math.random() * 9)];
    }
    return result;
  }

  /**
   * 獲取或建立 Client ID (儲存於 local storage，擴充功能安裝期間不變)
   */
  static async getOrCreateClientId() {
    const result = await chrome.storage.local.get('ga_clientId');
    let clientId = result.ga_clientId;
    if (!clientId) {
      // 使用 GA 常見的 <隨機數字>.<時間戳> 格式
      const unixTimestampSeconds = Math.floor(new Date().getTime() / 1000);
      clientId = `${this.getRandomId()}.${unixTimestampSeconds}`;
      await chrome.storage.local.set({ ga_clientId: clientId });
    }
    return clientId;
  }

  /**
   * 獲取或建立 Session ID (儲存於 session storage，瀏覽器關閉或閒置 30 分鐘後失效)
   */
  static async getOrCreateSessionId() {
    let { ga_sessionData } = await chrome.storage.session.get('ga_sessionData');
    const currentTimeInMs = Date.now();

    // 檢查 Session 是否仍然有效
    if (ga_sessionData && ga_sessionData.timestamp) {
      const durationInMin = (currentTimeInMs - ga_sessionData.timestamp) / 60000;
      if (durationInMin > SESSION_EXPIRATION_IN_MIN) {
        // 超過 30 分鐘無活動，清除舊 Session
        ga_sessionData = null;
      } else {
        // 更新時間戳，保持 Session 活躍
        ga_sessionData.timestamp = currentTimeInMs;
        await chrome.storage.session.set({ ga_sessionData });
      }
    }

    if (!ga_sessionData) {
      // 建立新的 Session
      ga_sessionData = {
        session_id: currentTimeInMs.toString(),
        timestamp: currentTimeInMs.toString(),
      };
      await chrome.storage.session.set({ ga_sessionData });
    }

    return ga_sessionData.session_id;
  }

  /**
   * 發送自訂事件到 Google Analytics 4
   * @param {string} eventName 事件名稱
   * @param {object} params 附加參數 (選填)
   */
  static async fireEvent(eventName, params = {}) {
    if (MEASUREMENT_ID === 'G-XXXXXXXXXX') {
      console.warn('GA4: Measurement ID not configured. Skipping event:', eventName);
      return;
    }

    try {
      const sessionId = await this.getOrCreateSessionId();
      const clientId = await this.getOrCreateClientId();
      
      const payload = {
        client_id: clientId,
        events: [
          {
            name: eventName,
            params: {
              session_id: sessionId,
              engagement_time_msec: DEFAULT_ENGAGEMENT_TIME_IN_MSEC,
              ...params
            },
          },
        ],
      };

      const endpoint = IS_DEBUG_MODE ? GA_DEBUG_ENDPOINT : GA_ENDPOINT;
      const url = `${endpoint}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      if (IS_DEBUG_MODE) {
        console.log(`GA4 Event Sent: ${eventName}`, payload);
      }
    } catch (error) {
      console.warn('GA4: Failed to send event', error.message || error);
    }
  }

  /**
   * 記錄頁面瀏覽 (Page View)
   * @param {string} pageTitle 頁面標題
   * @param {string} pageLocation 頁面路徑或網址
   */
  static async trackPageView(pageTitle, pageLocation) {
    return this.fireEvent('page_view', {
      page_title: pageTitle,
      page_location: pageLocation
    });
  }
}

// 匯出供外部使用 (ES Module 語法)
export default GoogleAnalytics;
