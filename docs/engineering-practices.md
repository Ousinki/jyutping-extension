# Chrome 擴充功能工程化實踐：GA4 整合與 CI/CD 自動發布

這份文件記錄了為「粵語懸浮詞典」擴充功能所導入的兩項重要工程化實踐：**突破 Manifest V3 限制的 GA4 數據分析**，以及 **GitHub Actions 自動化發布流程**。

---

## 1. Google Analytics 4 (GA4) 整合

### 1.1 背景與挑戰
在 Chrome 擴充功能的 Manifest V3 (MV3) 安全規範下，禁止加載遠端執行的腳本。這意味著我們無法像一般網頁那樣直接引入官方提供的 `gtag.js` 或 `analytics.js`。

### 1.2 解決方案：Measurement Protocol
為了解決這個問題，我們採用了 **GA4 Measurement Protocol**。這是一種允許開發者透過原始 HTTP 請求，直接將事件數據發送到 Google Analytics 伺服器的協議。

### 1.3 實作細節
1. **核心封裝 (`scripts/google-analytics.js`)**
   我們建立了一個專屬的模組來處理與 GA4 的通訊：
   - **身分識別 (Client ID)**：利用 `chrome.storage.local` 產生並永久保存一組隨機 UUID，確保同一使用者的多次行為能被正確關聯。
   - **會話管理 (Session ID)**：利用 `chrome.storage.session` 管理會話，確保在瀏覽器生命週期內維持同一個 Session，符合 GA4 的計算邏輯。
   - **Fetch API**：將所有追蹤事件轉化為 `POST` 請求，直接發送至 `https://www.google-analytics.com/mp/collect`。

2. **模組化引用 (`manifest.json`)**
   將 `background.js` 和 `options.js` 設定為 ES Modules：
   ```json
   "background": {
     "service_worker": "background.js",
     "type": "module"
   }
   ```
   這樣就能在各個腳本中使用 `import GoogleAnalytics from './scripts/google-analytics.js';` 來調用追蹤功能。

3. **事件埋點**
   - **背景事件**：TTS 引擎調用 (`tts_play`)、翻譯功能調用 (`translate`)、擴充功能開關狀態 (`toggle_extension`)。
   - **UI 事件**：設定頁面的瀏覽 (`page_view`)、使用者變更選項配置 (`change_setting`)。

> [!TIP]
> 開發期間可以將 `google-analytics.js` 中的 `IS_DEBUG_MODE` 設為 `true`，這樣請求會被發送到 `/debug/mp/collect`，方便在 GA4 控制台的 DebugView 即時查看驗證。

---

## 2. CI/CD 自動化上傳 Chrome Web Store

### 2.1 背景與挑戰
每次釋出新版本都需要手動執行壓縮 (`zip`)、排除不需要的檔案 (如 `.git`)、登入 Chrome Web Store 開發者後台、手動上傳。這個過程繁瑣且容易因人為失誤導致問題（例如包進了測試用大檔案）。

### 2.2 解決方案：GitHub Actions
我們建立了一個自動化工作流程 (Workflow)。只要開發者為 Git 打上版本標籤 (Tag，例如 `v1.4.2`) 並推送到 GitHub，雲端機器人就會自動完成打包並透過 API 上傳到 Web Store 的草稿區。

### 2.3 實作細節 (環境配置)

要讓 GitHub 有權限代為上傳，必須先取得 Google 的 API 憑證：

#### 步驟 1：在 Google Cloud Console 啟用 API
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)。
2. 導航至 **APIs & Services (API 和服務) -> Library (程式庫)**。
3. 搜尋並啟用 **`Chrome Web Store API`**。

#### 步驟 2：獲取 Client ID 和 Secret
1. 導航至 **OAuth consent screen (OAuth 同意畫面)**：
   - 選擇 **External (外部)**，並填寫必填的應用程式名稱與信箱。
   - **重要：** 在下方的 **Test users (測試使用者)** 中，必須加入你開發者帳號的 Google 信箱。
2. 導航至 **Credentials (憑證)**：
   - 點擊「+ CREATE CREDENTIALS」->「OAuth client ID」。
   - Application type 選擇 **Desktop app (電腦版應用程式)**。
   - 建立後，即可取得 **`CLIENT_ID`** 和 **`CLIENT_SECRET`**。

#### 步驟 3：獲取 Refresh Token
1. 在瀏覽器中組合並開啟以下授權網址（替換你的 Client ID）：
   `https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=<你的CLIENT_ID>&redirect_uri=urn:ietf:wg:oauth:2.0:oob`
2. 使用剛剛加入 Test Users 的帳號登入並同意授權。
3. 畫面上會出現一串 **Authorization Code (授權碼)**。
4. 在終端機執行 `curl` 指令來換取 **`REFRESH_TOKEN`**：
   ```bash
   curl "https://oauth2.googleapis.com/token" -d "client_id=<CLIENT_ID>&client_secret=<CLIENT_SECRET>&code=<AUTHORIZATION_CODE>&grant_type=authorization_code&redirect_uri=urn:ietf:wg:oauth:2.0:oob"
   ```

#### 步驟 4：配置 GitHub Repository Secrets
在專案的 GitHub 後台 (`Settings -> Secrets and variables -> Actions`) 中，設定以下 4 個機密變數：
- `EXTENSION_ID`：擴充功能的 32 碼 ID
- `CLIENT_ID`
- `CLIENT_SECRET`
- `REFRESH_TOKEN`

*(註：如果本機有安裝並登入 GitHub CLI (`gh`)，可使用 `gh secret set <NAME> -b"<VALUE>"` 快速批量寫入。)*

### 2.4 自動化腳本 (`.github/workflows/upload-extension.yml`)
在專案根目錄建立設定檔：

```yaml
name: Upload Chrome Extension

on:
  push:
    tags:
      - 'v*' # 當推送 v 開頭的標籤時觸發

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Pack extension into ZIP
        run: zip -r extension.zip . -x "*.git*" ".github/*" "docs/*" "README.md" "wordshk-tools/*" "tests/*" "*.zip"

      - name: Upload to Chrome Web Store
        uses: mnao305/chrome-extension-upload@v5.0.0
        with:
          file-path: 'extension.zip'
          extension-id: ${{ secrets.EXTENSION_ID }}
          client-id: ${{ secrets.CLIENT_ID }}
          client-secret: ${{ secrets.CLIENT_SECRET }}
          refresh-token: ${{ secrets.REFRESH_TOKEN }}
          publish: false # 設為 false，保持為草稿狀態，讓開發者手動點擊「提交審查」
```

> [!IMPORTANT]  
> 以後發布新版本的標準作業流程 (SOP) 變更為：
> 1. 更新 `manifest.json` 的 `version`。
> 2. Commit 程式碼。
> 3. `git tag vX.X.X`
> 4. `git push origin vX.X.X`
> 5. 前往 Web Store 開發者後台，點擊「Submit for Review」。
