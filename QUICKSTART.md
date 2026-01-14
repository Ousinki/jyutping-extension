# 粵語懸浮詞典 - 快速開始

## 📦 你收到的文件

```
cantonese-popup-dict/
├── manifest.json          ← Chrome Extension 配置
├── content.js             ← 主要功能代碼
├── popup.css              ← 彈窗樣式
├── popup.html             ← 設定頁面
├── popup-script.js        ← 設定頁面邏輯
├── dictionary.json        ← 示例詞典（需替換成完整版）
├── parse-cccanto.js       ← 數據轉換腳本
└── README.md              ← 詳細文檔
```

## 🚀 立即開始（3 步驟）

### 第 1 步：下載完整詞典數據

**示例 dictionary.json 只有 10 個詞！** 你需要下載完整數據：

1. 訪問：https://cc-canto.org/download.html
2. 下載：
   - **CC-Canto**: `cccanto-170202.zip` (~22K 粵語詞)
   - **CC-CEDICT Canto**: `cccedict-canto-readings-150923.zip` (~100K 通用詞)

### 第 2 步：轉換數據

```bash
# 解壓下載的 .zip 文件，得到 .u8 文件
# 將 .u8 文件放到這個文件夾

# 安裝 Node.js (如果未安裝): https://nodejs.org/

# 運行轉換腳本
node parse-cccanto.js

# 會生成完整的 dictionary.json (約 5-10 MB)
```

### 第 3 步：安裝到 Chrome

1. 打開 Chrome
2. 進入 `chrome://extensions/`
3. 右上角開啟「開發者模式」
4. 點擊「載入未封裝項目」
5. 選擇這個文件夾
6. 完成！🎉

## ✅ 測試

打開任何中文網頁，滑鼠懸停在中文字上，應該會看到彈窗！

測試網站推薦：
- https://hk.news.yahoo.com/
- https://www.mingpao.com/
- https://cc-canto.org/

## ⚙️ 設定

點擊 Chrome 工具欄的 Extension 圖標 → 粵語懸浮詞典

可以：
- 開關詞典
- 切換粵拼/Yale 顯示

## 🔧 常見問題

**Q: 為什麼沒有彈窗？**
- 確保已替換成完整的 dictionary.json（不是示例版）
- 檢查 Extension 是否已啟用
- 打開 Console (F12) 看看有沒有錯誤

**Q: 詞典文件太大？**
- 正常！完整詞典約 5-10 MB
- 可以只保留常用詞（編輯 JSON）

**Q: 想添加自己的詞？**
- 直接編輯 dictionary.json，格式參考現有詞條

## 📚 更多資源

- 完整文檔：README.md
- CC-Canto 官網：https://cc-canto.org/
- 問題反饋：[在這裡提 issue]

## 授權

- 代碼：MIT License
- 詞典數據：CC BY-SA 3.0 (CC-Canto, CC-CEDICT)

---

**重要提醒：** 記得替換 dictionary.json！示例版只有 10 個詞，完整版有 10 萬+ 詞條。
