<p align="center">
  <img src="icon_15.png" width="128" alt="粵語懸浮詞典 Logo" />
</p>
<p align="center">
  <strong>繁體中文</strong> | <a href="README_EN.md">English</a>
</p>

# 粵語懸浮詞典 (Cantonese Popup Dictionary)

一個強大而優雅的 Chrome / Edge 瀏覽器擴展，滑鼠懸停即可即時查詢中文字詞的粵語發音（粵拼 Jyutping / 耶魯 Yale）與詳細釋義，支援多種語音引擎點擊朗讀、生詞本管理、段落翻譯、全文注音、粵語釋義翻譯、拼寫練習及 AI 語境問答功能。

![Demo - 懸停查詞](assets/screenshot_demo_hover.png)
![Demo - 雙擊翻譯](assets/screenshot_demo_translate.png)
![Demo - 查詞釋義](assets/screenshot_demo.png)
![Demo - AI 語境翻譯](assets/screenshot_ai_demo.png)
![Demo - 網頁測試](assets/promo_wenweipo.jpg)

## 核心功能特點

- **滑鼠懸停即時查詞**：將滑鼠移到任何中文字詞上，即刻顯示粵語拼音與多語釋義。
- **雙拼音系統切換**：全面支援 **粵拼（Jyutping）** 與 **耶魯拼音（Yale）** 標註。
- **Words.hk 深度融合**：深度集成 Words.hk（粵典）高質量口語釋義與例句，並結合 CC-Canto 形成超過 23 萬條海量詞庫。
- **粵語釋義翻譯**：帶有 `[粵]` 標籤的本土口語釋義支援點擊徽章即時翻譯，或開啟全域自動翻譯（支援 Google / Bing / AI，可選「下方展開」或「原位替換」）。
- **生詞本與單詞卡（Wordbook）**：
  - 支援將查詢詞條一鍵加入生詞本；
  - 自定義文件夾分類、顏色標籤、筆記備註；
  - 多格式導出（Anki 卡片包、CSV、TXT）；
  - 內建 AI 對話助手，針對生詞深度解答詞源、例句與近反義詞。
- **段落翻譯（Paragraph Translation）**：按住快捷鍵（預設 `Shift`）並懸停於長段落上，AI 根據上下文提供精準地道的粵語翻譯。
- **全文注音模式（Full-page Ruby Annotation）**：一鍵為整個網頁上的中文字詞標註粵拼/耶魯音標，支援多音字點擊切換與自定義排除域名。
- **粵拼拼寫練習（Spelling Practice）**：內建生詞拼寫練習模組，支援隨機亂序出題、聲母/韻母/聲調輸入判分與發音跟讀。
- **點擊即時發聲（TTS）**：點擊懸浮窗音標或高亮單詞即可朗讀純正粵語。
- **AI 語境翻譯**：長按高亮詞或手動選區約 0.5 秒，AI 自動根據上下文語境解析詞義。
- **5 種介面語言**：完整支援繁體中文（香港）、簡體中文、English、日本語、한국어。
- **8 款精美主題**：經典、香港紅、深邃夜色、水墨、海洋、暖陽、薄荷、毛玻璃，適配各類視覺偏好。
- **嚴格樣式隔離**：採用獨立 CSS 隔離與 Shadow DOM 支持，防止宿主網頁樣式干擾。

## 語音引擎 (TTS)

支援 4 種語音引擎，滿足不同音質、離線與自定義需求：

| 引擎                   | 是否需要配置                   | 網絡依賴    | 特點與音質                             | 費用           |
| ---------------------- | ------------------------------ | ----------- | -------------------------------------- | -------------- |
| **Chrome TTS**   | 免配置                         | 離線 / 本地 | 系統原生，零網絡延遲                   | 免費           |
| **Edge TTS**     | 免配置（預設伺服器）/ 可自定義 | 在線        | 微軟高品質神經網絡語音                 | 免費           |
| **Google TTS**   | 免配置                         | 在線        | 谷歌官方接口，響應穩定迅速             | 免費           |
| **Azure Speech** | 需填寫 API Key 與 Region       | 在線        | 微軟官方直連，提供極高音質神經網絡音色 | 自定義按量計費 |

## AI 語境翻譯與問答配置

採用統一的 **OpenAI 兼容 API 格式**，只需填寫 3 個欄位，即可適配所有主流 AI 服務商：

| 欄位                   | 說明          | 示例                                |
| ---------------------- | ------------- | ----------------------------------- |
| **API Base URL** | 服務端點地址  | `https://api.deepseek.com`        |
| **API Key**      | 你的 API 密鑰 | `sk-xxxxxxxx`                     |
| **模型名稱**     | 使用的模型    | `deepseek-chat` / `gpt-4o-mini` |

> 支援包括 OpenAI、DeepSeek、火山引擎、Ollama（本地部署）、Groq、Claude 等任何兼容 OpenAI `/chat/completions` 接口的模型服務。

## 操作指南速查

| 功能                   | 觸發方式                       | 效果說明                               |
| ---------------------- | ------------------------------ | -------------------------------------- |
| **即時查詞**     | 滑鼠懸停於中文字詞上           | 浮窗顯示粵拼/Yale 音標、釋義與口語標籤 |
| **單詞朗讀**     | 點擊高亮詞或浮窗音標           | TTS 引擎播放純正粵語讀音               |
| **加入生詞本**   | 點擊浮窗右上方星標按鈕         | 保存到生詞本，支援添加分組與筆記       |
| **雙擊翻譯**     | 選中文字後雙擊選區             | 呼出 Bing 翻譯浮窗（支援普/英翻譯）    |
| **AI 語境翻譯**  | 在高亮詞或選區上長按約 0.5 秒  | AI 根據上下文解釋在該句中的精確含義    |
| **段落翻譯**     | 按住`Shift` 鍵並懸停於段落上 | AI 自動為該段落提供粵語翻譯            |
| **粵語釋義翻譯** | 點擊釋義旁的`[粵]` 徽章      | 即時將粵語口語釋義翻譯為介面語言       |

## 安裝方式

<a href="https://chromewebstore.google.com/detail/%E7%B2%B5%E8%AA%9E%E6%87%B8%E6%B5%AE%E8%A9%9E%E5%85%B8/nkghannminfkihhnkebcjhodfcoamkkm" target="_blank">
  <img src="assets/chrome-web-store-badge.png" height="40" alt="Available in the Chrome Web Store" />
</a>
  
<a href="https://microsoftedge.microsoft.com/addons/detail/%E7%B2%B5%E8%AA%9E%E6%87%B8%E6%B5%AE%E8%A9%9E%E5%85%B8/akejhmlcbfmnoodfibchikfjkgjjbfpc" target="_blank">
  <img src="assets/microsoft-edge-badge-zh.png" height="40" alt="Get it from Microsoft Edge" />
</a>

### 開發者手動安裝

1. 下載或 Clone 本倉庫：`git clone https://github.com/Ousinki/jyutping-extension.git`
2. 打開 Chrome / Edge，進入擴展管理頁面 `chrome://extensions/`
3. 開啟右上角的 **「開發者模式」**
4. 點擊 **「載入未封裝項目」**，選擇本項目的根資料夾即可。

## 數據來源 (Data Sources)

本擴展詞典數據融合並收錄了以下優質開源粵語辭書項目：

- [Words.hk (粵典)](https://words.hk/) — 香港辭書有限公司開放粵語詞典
- [CC-Canto](https://cantonese.org/) — 開放粵語-英語詞典
- [CC-CEDICT](https://cc-cedict.org/) — 開放漢語-英語詞典
- [PyCantonese](https://pycantonese.org/) — 粵語語言學與粵拼數據庫

## 授權協議 (License & Credits)

- **代碼授權**：本項目的源代碼採用 [GNU General Public License v3.0 (GPL-3.0)](LICENSE) 授權開源。
- **詞典數據授權**：
  - **Words.hk (粵典)** 數據採用 [Words.hk 非商業開放資料授權協議 1.0 (Non-Commercial Open Data License 1.0)](https://words.hk/base/hoifong/) 授權；
  - **CC-Canto & CC-CEDICT** 數據採用 [Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)](https://creativecommons.org/licenses/by-sa/3.0/) 授權。

## 隱私政策 (Privacy Policy)

本擴展恪守用戶數據安全，不收集、不出售任何用戶個人信息。所有 AI 查詢直接在用戶本地與用戶自定義的 API 端點之間通信，不經過任何中間伺服器。詳見 [隱私政策 (Privacy Policy)](privacy-policy.html)。

## 貢獻與反饋

歡迎提交 Issue 與 Pull Request 一同完善粵語懸浮詞典！如有任何功能建議或遇到問題，歡迎在 GitHub 討論。
