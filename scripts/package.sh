#!/bin/bash
# 打包粵語懸浮詞典 Chrome 擴展
# 用法: ./scripts/package.sh [版本號]
# 例如: ./scripts/package.sh 1.2.0

set -e

# 切換到項目根目錄
cd "$(dirname "$0")/.."

# 從 manifest.json 讀取版本號，或使用命令行參數
if [ -n "$1" ]; then
    VERSION="$1"
else
    VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
fi

OUTPUT="jyutping-extension-v${VERSION}.zip"

echo "📦 正在打包粵語懸浮詞典 v${VERSION}..."

# 刪除舊的打包文件（如果存在）
rm -f "$OUTPUT"

# 只打包擴展需要的文件
zip -r "$OUTPUT" \
    manifest.json \
    background.js \
    content.js \
    dictionary.json \
    options.html \
    options.js \
    popup.html \
    popup.css \
    popup-script.js \
    privacy-policy.html \
    icon128.png \
    fonts/ \
    -x "*.DS_Store"

echo "✅ 打包完成: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
