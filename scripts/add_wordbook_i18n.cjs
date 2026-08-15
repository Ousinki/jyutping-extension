const fs = require('fs');
const path = require('path');

const newKeys = {
  "wordbookModeWord": {
    "zh-TW": "生詞", "zh-CN": "生词", "en": "Words", "ja": "単語", "ko": "단어"
  },
  "wordbookModeDict": {
    "zh-TW": "詞典", "zh-CN": "词典", "en": "Dict", "ja": "辞書", "ko": "사전"
  },
  "wordbookExportJson": {
    "zh-TW": "JSON (完整備份)", "zh-CN": "JSON (完整备份)", "en": "JSON (Full Backup)", "ja": "JSON (完全バックアップ)", "ko": "JSON (전체 백업)"
  },
  "wordbookExportCsv": {
    "zh-TW": "CSV (Excel 兼容)", "zh-CN": "CSV (Excel 兼容)", "en": "CSV (Excel Compatible)", "ja": "CSV (Excel 互換)", "ko": "CSV (Excel 호환)"
  },
  "wordbookExportMd": {
    "zh-TW": "Markdown", "zh-CN": "Markdown", "en": "Markdown", "ja": "Markdown", "ko": "Markdown"
  },
  "wordbookExportTxt": {
    "zh-TW": "純文本 TXT", "zh-CN": "纯文本 TXT", "en": "Plain Text", "ja": "プレーンテキスト", "ko": "일반 텍스트"
  },
  "wordbookExportImport": {
    "zh-TW": "導入...", "zh-CN": "导入...", "en": "Import...", "ja": "インポート...", "ko": "가져오기..."
  },
  "dictSearchFallback": {
    "zh-TW": "📖 詞典搜索", "zh-CN": "📖 词典搜索", "en": "📖 Dictionary Search", "ja": "📖 辞書検索", "ko": "📖 사전 검색"
  },
  "dictSearchEmpty": {
    "zh-TW": "未在詞典中找到匹配結果", "zh-CN": "未在词典中找到匹配结果", "en": "No matching results found in dictionary", "ja": "辞書に一致する結果が見つかりませんでした", "ko": "사전에서 일치하는 결과를 찾을 수 없습니다"
  },
  "dictSearchNoDetail": {
    "zh-TW": "詞典中未找到 <strong>$1</strong> 的詳細釋義。", "zh-CN": "词典中未找到 <strong>$1</strong> 的详细释义。", "en": "Detailed definition for <strong>$1</strong> not found in dictionary.", "ja": "辞書に <strong>$1</strong> の詳細な定義が見つかりません。", "ko": "사전에서 <strong>$1</strong>의 자세한 정의를 찾을 수 없습니다."
  },
  "wordbookAiChat": {
    "zh-TW": "❇️ AI 問答", "zh-CN": "❇️ AI 问答", "en": "❇️ AI Q&A", "ja": "❇️ AI Q&A", "ko": "❇️ AI Q&A"
  },
  "wordbookAiAction1": {
    "zh-TW": "造句", "zh-CN": "造句", "en": "Sentence", "ja": "例文", "ko": "문장"
  },
  "wordbookAiAction2": {
    "zh-TW": "語源", "zh-CN": "语源", "en": "Etymology", "ja": "語源", "ko": "어원"
  },
  "wordbookAiAction3": {
    "zh-TW": "日常用法", "zh-CN": "日常用法", "en": "Daily Usage", "ja": "日常の用法", "ko": "일상 용법"
  },
  "wordbookAiAction4": {
    "zh-TW": "近義反義", "zh-CN": "近义反义", "en": "Synonyms/Antonyms", "ja": "類義/対義", "ko": "유의/반의"
  },
  "wordbookAiInputPlaceholder": {
    "zh-TW": "問關於「$1」的問題...", "zh-CN": "问关于“$1”的问题...", "en": "Ask a question about '$1'...", "ja": "「$1」について質問する...", "ko": "'$1'에 대해 질문하기..."
  }
};

const mapFolder = {
  "zh-TW": "zh_TW",
  "zh-CN": "zh_CN",
  "en": "en",
  "ja": "ja",
  "ko": "ko"
};

const localesDir = path.join(__dirname, '../_locales');

for (const [lang, folder] of Object.entries(mapFolder)) {
  const file = path.join(localesDir, folder, 'messages.json');
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [key, translations] of Object.entries(newKeys)) {
      if (!data[key]) {
        data[key] = {
          message: translations[lang]
        };
      } else {
        data[key].message = translations[lang];
      }
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated ${folder}`);
  }
}

const genericKeys = {
  "wordbookAiInputPlaceholderGeneric": {
    "zh-TW": "問任何關於粵語的問題...",
    "zh-CN": "问任何关于粤语的问题...",
    "en": "Ask any question about Cantonese...",
    "ja": "広東語について質問する...",
    "ko": "광둥어에 대해 무엇이든 물어보세요..."
  }
};

for (const [lang, folder] of Object.entries(mapFolder)) {
  const file = path.join(localesDir, folder, 'messages.json');
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [key, translations] of Object.entries(genericKeys)) {
      data[key] = { message: translations[lang] };
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
}

const emptyStateKeys = {
  "wordbookEmptyDetail1": {
    "zh-TW": "點擊左側單詞查看詳情",
    "zh-CN": "点击左侧单词查看详情",
    "en": "Click left word for details",
    "ja": "左の単語をクリックして詳細を表示",
    "ko": "세부 정보를 보려면 왼쪽 단어를 클릭하세요"
  },
  "wordbookEmptyDetail2": {
    "zh-TW": "或直接在下方提問",
    "zh-CN": "或直接在下方提问",
    "en": "Or ask directly below",
    "ja": "または直接下で質問する",
    "ko": "또는 아래에 직접 질문하세요"
  }
};

for (const [lang, folder] of Object.entries(mapFolder)) {
  const file = path.join(localesDir, folder, 'messages.json');
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [key, translations] of Object.entries(emptyStateKeys)) {
      data[key] = { message: translations[lang] };
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
}
