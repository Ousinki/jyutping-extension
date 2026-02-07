# 粵語懸浮詞典 (Cantonese Popup Dictionary)

一個 Chrome 擴展，滑鼠懸停即可顯示中文字詞的粵語發音（粵拼/Yale）和英文釋義，支援多種語音引擎點擊發聲。

![Demo Screenshot](screenshot_store_1.png)
![Demo - 懸停查詞](screenshot_demo.png)

## ✨ 功能特點

- **滑鼠懸停即時查詞**：將滑鼠移到任何中文字上，即刻顯示粵語發音
- **雙拼音系統**：支援粵拼 (Jyutping) 和 Yale 兩種標註方式
- **英文解釋**：提供詳細英文翻譯和釋義
- **超過 23 萬詞條**：涵蓋常用詞彙、成語、俚語
- **點擊發聲**：點擊高亮文字即可朗讀粵語發音
- **Shadow DOM 支持**：兼容使用 Web Components 的現代網站（如 Bilibili）

## 🔊 語音引擎 (TTS)

支援 5 種語音引擎，滿足不同使用場景：

| 引擎 | 需要配置？ | 音質 | 費用 |
|------|----------|------|------|
| **Web Speech API** | 免配置 | ⭐⭐⭐ | 免費 |
| **Chrome TTS** | 免配置 | ⭐⭐⭐ | 免費 |
| **Edge TTS** | 免配置（預設伺服器）/ 可自定義 | ⭐⭐⭐⭐ | 免費 |
| **Azure Speech** | 免配置（預設 API）/ 可用自定義密鑰 | ⭐⭐⭐⭐⭐ | 預設免費 / 自定義按量付費 |
| **Bert-VITS2** | 需填伺服器地址 | ⭐⭐⭐⭐ | 取決於服務商 |

### Azure Speech 音色

Azure Speech 提供 3 種高品質粵語音色：

- 🎙️ **曉曼 HiuMaan**（女聲）
- 🎙️ **曉佳 HiuGaai**（女聲）
- 🎙️ **雲龍 WanLung**（男聲）

### 語速調節

所有引擎均支援 0.5x ~ 1.5x 語速調節。

### 音頻緩存

內建智能音頻緩存（最多 20 條），重複點擊同一個詞時無需重新請求 API，實現即時播放。

## 📦 安裝

### Chrome Web Store（推薦）
*審核中...*

### 手動安裝
1. 下載或 Clone 本倉庫
2. 打開 Chrome，進入 `chrome://extensions/`
3. 開啟右上角的「開發者模式」
4. 點擊「載入未封裝項目」
5. 選擇項目資料夾

## 🔧 使用方法

1. 安裝後自動在所有網頁生效
2. 將滑鼠移到任何中文字上
3. 彈窗會顯示：
   - 繁體/簡體字
   - 粵拼讀音
   - 英文解釋

### 💡 使用小貼士

- 🔊 **朗讀發音**：光標選中文字後，再點擊一下即可朗讀粵語發音
- 🎵 **點擊音標**：點擊懸浮窗中的粵拼音標，也可以觸發朗讀
- 📖 **展開例句**：點擊懸浮窗中的英文釋義，可以展開查看更多例句和詳細解釋

## ⚙️ 設定

點擊擴展圖標 → 更多設定：

- **啟用 / 關閉詞典**
- **發音格式**：粵拼 (Jyutping) / Yale
- **語音引擎**：選擇 TTS 服務提供商
- **語音音色**：Azure Speech 可選擇不同音色
- **語速調節**：0.5x ~ 1.5x
- **Edge TTS / Azure Speech**：支援預設伺服器（免配置）或自定義地址/密鑰

## 📚 數據來源

- [words.hk](https://words.hk/) - 粵語開放詞典
- [CC-Canto](https://cantonese.org/) - 粵語詞典
- [CC-CEDICT](https://cc-cedict.org/) - 中英詞典
- [PyCantonese](https://pycantonese.org/) - 粵拼補充

## 🔒 隱私政策

本擴展不收集任何用戶數據。詳見 [隱私政策](privacy-policy.html)。

## 📄 授權

本項目採用 [MIT License](LICENSE) 授權。

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📞 聯繫

如有問題或建議，請通過 GitHub Issues 聯繫。
