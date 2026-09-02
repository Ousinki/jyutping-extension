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

# 先進行代碼檢查與構建
echo "🔨 構建 content.js 與代碼檢查..."
npm run build
npm run lint

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
    wordbook.html \
    wordbook.js \
    spelling.html \
    spelling.js \
    roadmap.html \
    roadmap.js \
    roadmap-data.js \
    jyutping-ime.js \
    marked.min.js \
    theme-init.js \
    popup.css \
    privacy-policy.html \
    icon.svg \
    icon_favicon.svg \
    icon16.png \
    icon48.png \
    icon128.png \
    icon_action.png \
    icon_action_gray.png \
    _locales/ \
    fonts/ \
    audio/ \
    scripts/google-analytics.js \
    -x "*.DS_Store"

echo "✅ 打包完成: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"

# ── 打包後校驗 ──────────────────────────────────────────
echo ""
echo "🔍 正在校驗打包完整性..."

ERRORS=0
ZIP_LIST=$(unzip -l "$OUTPUT" | awk 'NR>3 && /^[[:space:]]*[0-9]/ {print $NF}')

# 1) 校驗 manifest.json 中聲明的所有圖標
echo "  📋 校驗 manifest.json 圖標引用..."
MANIFEST_ICONS=$(grep -oE '"[^"]+\.(png|svg)"' manifest.json | tr -d '"' | sort -u)
for icon in $MANIFEST_ICONS; do
    if ! echo "$ZIP_LIST" | grep -qx "$icon"; then
        echo "  ❌ manifest.json 引用的 $icon 不在 zip 中！"
        ERRORS=$((ERRORS + 1))
    fi
done

# 2) 校驗 HTML 文件中的 src / href 本地資源引用
echo "  📋 校驗 HTML 資源引用..."
HTML_FILES=$(echo "$ZIP_LIST" | grep '\.html$')
for html in $HTML_FILES; do
    # 提取 src="..." 和 href="..." 中的本地路徑（排除 http/https/# 開頭）
    REFS=$(grep -oE '(src|href)="[^"#]+"' "$html" 2>/dev/null \
        | sed 's/.*="\(.*\)"/\1/' \
        | grep -vE '^(https?://|data:|chrome)' \
        | sort -u)
    for ref in $REFS; do
        if ! echo "$ZIP_LIST" | grep -qx "$ref"; then
            echo "  ❌ $html 引用的 $ref 不在 zip 中！"
            ERRORS=$((ERRORS + 1))
        fi
    done
done

# 3) 校驗 _locales 目錄（i18n 必需）
if grep -q '__MSG_' manifest.json; then
    echo "  📋 校驗 i18n 支持..."
    DEFAULT_LOCALE=$(grep '"default_locale"' manifest.json | sed 's/.*: *"\([^"]*\)".*/\1/')
    if [ -n "$DEFAULT_LOCALE" ]; then
        EXPECTED="_locales/${DEFAULT_LOCALE}/messages.json"
        if ! echo "$ZIP_LIST" | grep -qx "$EXPECTED"; then
            echo "  ❌ 預設語言檔 $EXPECTED 不在 zip 中！"
            ERRORS=$((ERRORS + 1))
        fi
    fi
fi

# 4) 校驗 background.js 中動態引用的圖標
echo "  📋 校驗 background.js 圖標引用..."
BG_ICONS=$(grep -oE '"[^"]+\.(png|svg)"' background.js 2>/dev/null | tr -d '"' | sort -u)
for icon in $BG_ICONS; do
    if ! echo "$ZIP_LIST" | grep -qx "$icon"; then
        echo "  ❌ background.js 引用的 $icon 不在 zip 中！"
        ERRORS=$((ERRORS + 1))
    fi
done

# 5) 校驗 JS 文件中的 import 模組引用
echo "  📋 校驗 JS 模組導入引用..."
JS_FILES=$(echo "$ZIP_LIST" | grep '\.js$')
for js in $JS_FILES; do
    IMPORTS=$(grep -E "import[[:space:]]+.*[[:space:]]+from[[:space:]]+['\"](\.[^'\"]+)['\"]" "$js" 2>/dev/null \
        | sed -E "s/.*from[[:space:]]+['\"](\.[^'\"]+)['\"].*/\1/" \
        | sed 's/^\.\///' \
        | sort -u)
    for imp in $IMPORTS; do
        if ! echo "$ZIP_LIST" | grep -qx "$imp"; then
            echo "  ❌ $js 導入的 $imp 不在 zip 中！"
            ERRORS=$((ERRORS + 1))
        fi
    done
done

echo ""
if [ $ERRORS -gt 0 ]; then
    echo "⛔ 發現 $ERRORS 個問題，請修復後重新打包！"
    exit 1
else
    echo "✅ 校驗通過，所有引用的資源均已包含在 zip 中。"
    
    # ── 自動部署到桌面 ──────────────────────────────────────────
    echo ""
    echo "🚀 正在將最新版本部署到桌面測試環境..."
    DESKTOP_DIR="$HOME/Desktop"
    
    # 清理桌面上舊版本的文件夾
    echo "  🧹 清理舊版本測試文件夾..."
    rm -rf "$DESKTOP_DIR"/jyutping-extension-v*
    rm -rf "$DESKTOP_DIR"/jyutping-extension
    
    TARGET_DIR="$DESKTOP_DIR/jyutping-extension-v${VERSION}"
    mkdir -p "$TARGET_DIR"
    
    echo "  📦 解壓 $OUTPUT 到桌面..."
    unzip -q -o "$OUTPUT" -d "$TARGET_DIR"
    
    echo "✅ 桌面測試環境已更新！可以在其他瀏覽器中加載 $TARGET_DIR 進行測試。"
fi
