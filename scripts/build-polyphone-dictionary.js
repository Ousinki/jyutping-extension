/**
 * 完整多音字詞典構建腳本 (Build Polyphone Dictionary)
 * 1. 嚴格以 Words.hk（粵典）的粵語釋義 [粵] 為核心，精準綁定專屬例句（僅含例句的釋義顯示展開箭頭 ▷）。
 * 2. 英文釋義清晰列在下方作為補充，不與粵語釋義交替重複，英文行不附加無關例句箭頭。
 * 3. 嚴格跨讀音去重，徹底消除 CC-Canto 粗暴複製引起的各讀音釋義混雜。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dictJsonPath = '/Volumes/ExternalSSD/Projects/wordshk-tools/dict.json';
const dictionaryJsonPath = path.join(__dirname, '..', 'dictionary.json');
const cccantoPath = path.join(__dirname, '..', 'data', 'cccanto-webdist.txt');
const customEntriesPath = path.join(__dirname, '..', 'data', 'custom_entries.json');

if (!fs.existsSync(dictionaryJsonPath)) {
  console.error(`❌ 找不到 dictionary.json: ${dictionaryJsonPath}`);
  process.exit(1);
}

function jyutpingToYale(jyutping) {
  if (!jyutping) return '';
  const syllables = jyutping.toLowerCase().split(' ');
  const yaleSyllables = syllables.map((syllable) => {
    const toneMatch = syllable.match(/^([a-z]+)([1-6])$/);
    if (!toneMatch) return syllable;
    const [_, letters, tone] = toneMatch;
    const toneMarks = {
      1: '̄',
      2: '́',
      3: '',
      4: '̀',
      5: '̏',
      6: ''
    };
    let yale = letters;
    const vowelIndex = yale.search(/[aeiou]/);
    if (vowelIndex !== -1 && toneMarks[tone]) {
      yale = yale.slice(0, vowelIndex + 1) + toneMarks[tone] + yale.slice(vowelIndex + 1);
    }
    return yale;
  });
  return yaleSyllables.join(' ');
}

console.log('📖 正在讀取現有 dictionary.json...');
const dictionary = JSON.parse(fs.readFileSync(dictionaryJsonPath, 'utf-8'));
console.log(`   現有詞條數: ${Object.keys(dictionary).length.toLocaleString()}`);

// 1. 讀取 CC-Canto 原始多音數據
console.log('📖 正在讀取 CC-Canto 原始數據...');
const cccantoMap = new Map(); // word -> Map(jyutping -> [defs])
if (fs.existsSync(cccantoPath)) {
  const cccantoLines = fs.readFileSync(cccantoPath, 'utf-8').split('\n');
  const fullRegex = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\{([^}]+)\}\s+\/(.+)\//;

  for (let line of cccantoLines) {
    line = line.trim();
    if (line.startsWith('#') || !line) continue;
    const m = line.match(fullRegex);
    if (m) {
      const [_, trad, simp, pinyin, jp, defs] = m;
      const cleanJp = jp.trim();
      if (!cleanJp) continue;
      
      if (!cccantoMap.has(trad)) cccantoMap.set(trad, new Map());
      const wordJpMap = cccantoMap.get(trad);
      if (!wordJpMap.has(cleanJp)) wordJpMap.set(cleanJp, []);
      
      const dList = defs.split('/').map(d => d.trim()).filter(Boolean);
      wordJpMap.get(cleanJp).push(...dList);
    }
  }
  console.log(`   CC-Canto 提取字詞: ${cccantoMap.size.toLocaleString()}`);
}

// 2. 讀取 Words.hk 原始數據
console.log('📖 正在讀取 Words.hk 數據...');
let wordshk = {};
if (fs.existsSync(dictJsonPath)) {
  wordshk = JSON.parse(fs.readFileSync(dictJsonPath, 'utf-8'));
  console.log(`   Words.hk 條目數: ${Object.keys(wordshk).length.toLocaleString()}`);
}

// Jyutping 編碼轉換輔助
const INITIAL_MAP = {
  B: 'b', P: 'p', M: 'm', F: 'f', D: 'd', T: 't', N: 'n', L: 'l',
  G: 'g', K: 'k', Ng: 'ng', H: 'h', Gw: 'gw', Kw: 'kw', W: 'w',
  Z: 'z', C: 'c', S: 's', J: 'j'
};
const NUCLEUS_MAP = {
  Aa: 'aa', I: 'i', U: 'u', E: 'e', O: 'o', Yu: 'yu', Oe: 'oe', A: 'a', Eo: 'eo'
};
const CODA_MAP = {
  P: 'p', T: 't', K: 'k', M: 'm', N: 'n', Ng: 'ng', I: 'i', U: 'u'
};
const TONE_MAP = {
  T1: '1', T2: '2', T3: '3', T4: '4', T5: '5', T6: '6'
};

function convertJyutpingSyllable(jp) {
  let result = '';
  if (jp.i) result += INITIAL_MAP[jp.i] || '';
  if (jp.n) result += NUCLEUS_MAP[jp.n] || '';
  if (jp.c) result += CODA_MAP[jp.c] || '';
  if (jp.t) result += TONE_MAP[jp.t] || '';
  return result;
}

function convertPronunciationArray(pr) {
  if (!pr || !Array.isArray(pr)) return '';
  const syllables = pr.map(seg => {
    if (seg.S) return convertJyutpingSyllable(seg.S);
    if (seg.N) return seg.N;
    return '';
  });
  return syllables.join(' ').trim();
}

function extractText(lines) {
  if (!lines || !Array.isArray(lines)) return '';
  let realLines = lines;
  const first = lines[0];
  if (Array.isArray(first) && first.length > 0 && typeof first[0] === 'string') {
    realLines = [lines];
  }
  return realLines
    .map(line => {
      if (!Array.isArray(line)) return '';
      return line.map(seg => (Array.isArray(seg) && seg.length >= 2 ? seg[1] : (typeof seg === 'string' ? seg : ''))).join('');
    })
    .filter(line => line.trim().length > 0)
    .join('; ');
}

function extractExamples(egs) {
  if (!egs || !Array.isArray(egs)) return [];
  return egs.map(eg => {
    const yueRaw = (eg.yue && Array.isArray(eg.yue)) ? eg.yue[0] : eg.yue;
    return {
      yue: extractText(yueRaw),
      eng: extractText(eg.eng)
    };
  }).filter(e => e.yue || e.eng);
}

// 建立 Words.hk 中 word -> Map(jyutping -> [ { yueText, engText, examples } ])
console.log('🔄 正在解析 Words.hk 多音結構...');
const wordshkPolyMap = new Map();

for (const [id, entry] of Object.entries(wordshk)) {
  const variants = entry.variants || [];
  const rawDefs = entry.defs || [];

  for (const variant of variants) {
    const word = variant.w;
    if (!word) continue;

    if (!wordshkPolyMap.has(word)) {
      wordshkPolyMap.set(word, new Map());
    }
    const wordReadings = wordshkPolyMap.get(word);

    // 收集 variant 下的所有讀音
    const pList = variant.p || [];
    for (const pr of pList) {
      const jp = convertPronunciationArray(pr);
      if (!jp) continue;

      if (!wordReadings.has(jp)) {
        wordReadings.set(jp, []);
      }
      const defArray = wordReadings.get(jp);

      for (const d of rawDefs) {
        const yueText = extractText(d.yue);
        const engText = extractText(d.eng);
        const examples = extractExamples(d.egs);
        if (yueText || engText) {
          defArray.push({ yueText, engText, examples });
        }
      }
    }
  }
}

console.log(`   Words.hk 提取詞彙: ${wordshkPolyMap.size.toLocaleString()}`);

// 3. 遍歷 dictionary.json，為具備多音的詞條注入 readings 結構
console.log('\n⚙️ 正在為 dictionary.json 合入 readings 結構...');
let polyphoneCount = 0;

for (const [word, entry] of Object.entries(dictionary)) {
  const wordshkReadings = wordshkPolyMap.get(word);
  const cccantoReadings = cccantoMap.get(word);

  // 獲取所有可能的拼音候選列表
  const allJpSet = new Set();
  if (entry.jyutping) allJpSet.add(entry.jyutping);
  if (wordshkReadings) {
    for (const jp of wordshkReadings.keys()) allJpSet.add(jp);
  }
  if (cccantoReadings) {
    for (const jp of cccantoReadings.keys()) allJpSet.add(jp);
  }

  // 如果只有 1 個或 0 個讀音，不需要構建多音 readings 數組
  if (allJpSet.size <= 1) {
    continue;
  }

  // 排序：確保 entry.jyutping 放在第一個
  const sortedJpList = Array.from(allJpSet).sort((a, b) => {
    if (a === entry.jyutping) return -1;
    if (b === entry.jyutping) return 1;
    return 0;
  });

  // 建立各讀音的英文關鍵詞索引，用於跨讀音衝突過濾
  const jpEnglishKeywords = new Map(); // jp -> Set<string>
  if (wordshkReadings) {
    for (const [jp, defs] of wordshkReadings.entries()) {
      const s = new Set();
      for (const d of defs) {
        if (d.engText) {
          d.engText.toLowerCase().split(/;\s*|,\s*|\/\s*/).forEach(w => {
            const trimmed = w.trim();
            if (trimmed) s.add(trimmed);
          });
        }
      }
      jpEnglishKeywords.set(jp, s);
    }
  }

  const readings = [];

  for (const jp of sortedJpList) {
    const yale = jyutpingToYale(jp);
    const readingEnglish = [];
    const readingExamples = [];
    const seenDefs = new Set();

    function addDef(text, examples = null) {
      if (!text) return;
      const normalized = text.trim();
      if (!normalized || seenDefs.has(normalized)) return;
      seenDefs.add(normalized);
      readingEnglish.push(normalized);
      readingExamples.push(examples && examples.length > 0 ? examples : null);
    }

    // ★ 優先級 1：Words.hk 該讀音下的粵語釋義 [粵]（精確綁定例句）
    const hasWordsHkForThisJp = Boolean(wordshkReadings && wordshkReadings.has(jp));
    if (hasWordsHkForThisJp) {
      const wDefs = wordshkReadings.get(jp);
      for (const d of wDefs) {
        if (d.yueText) {
          addDef(`[粵] ${d.yueText}`, d.examples);
        } else if (d.engText) {
          addDef(d.engText, d.examples);
        }
      }
    }

    // ★ 優先級 2：CC-Canto / Words.hk 該讀音下的英文釋義（補充，不附帶例句箭頭）
    if (cccantoReadings && cccantoReadings.has(jp)) {
      const cDefs = cccantoReadings.get(jp);
      for (const d of cDefs) {
        const dLower = d.trim().toLowerCase();
        // 檢查該 CC-Canto 釋義是否與其他讀音的專屬釋義重合
        let isConflictWithOtherJp = false;
        for (const [otherJp, kwSet] of jpEnglishKeywords.entries()) {
          if (otherJp !== jp && kwSet.has(dLower)) {
            // 如果此英文在 otherJp 中有明確收錄，且當前 jp 沒有收錄，則視為 CC-Canto 粗暴複製，予以過濾
            const curJpSet = jpEnglishKeywords.get(jp);
            if (!curJpSet || !curJpSet.has(dLower)) {
              isConflictWithOtherJp = true;
              break;
            }
          }
        }
        if (!isConflictWithOtherJp) {
          addDef(d, null);
        }
      }
    } else if (hasWordsHkForThisJp && readingEnglish.length <= 2) {
      const wDefs = wordshkReadings.get(jp);
      for (const d of wDefs) {
        if (d.engText) {
          addDef(d.engText, null);
        }
      }
    }

    // 如果該讀音完全沒有釋義且是主讀音，沿用原 entry.english
    if (readingEnglish.length === 0 && jp === entry.jyutping) {
      const origEnglish = entry.english || [];
      const origExamples = entry.examples || [];
      origEnglish.forEach((def, idx) => {
        addDef(def, origExamples[idx] || null);
      });
    }

    if (readingEnglish.length > 0) {
      readings.push({
        jyutping: jp,
        yale: yale || jp,
        english: readingEnglish,
        examples: readingExamples
      });
    }
  }

  if (readings.length > 1) {
    entry.readings = readings;
    entry.english = readings[0].english;
    entry.examples = readings[0].examples;
    polyphoneCount++;
  }
}

console.log(`✅ 成功為 ${polyphoneCount.toLocaleString()} 個多音字條目生成結構化 readings 數組`);

// 4. 合併 custom_entries.json（確保斷咗等覆蓋）
if (fs.existsSync(customEntriesPath)) {
  console.log('\n📖 正在合併自定義詞條 custom_entries.json...');
  const customEntries = JSON.parse(fs.readFileSync(customEntriesPath, 'utf-8'));
  let customCount = 0;
  for (const [word, entry] of Object.entries(customEntries)) {
    dictionary[word] = {
      ...dictionary[word],
      ...entry
    };
    customCount++;
  }
  console.log(`✅ 已合併 ${customCount} 條自定義詞條`);
}

// 5. 寫回 dictionary.json
console.log('\n💾 正在寫入 dictionary.json...');
fs.writeFileSync(dictionaryJsonPath, JSON.stringify(dictionary, null, 2), 'utf-8');
console.log('🎉 詞典構建完成！');
