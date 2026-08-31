/**
 * Words.hk 原生詞性條目 (POS) 詞典構建腳本
 * 1. 100% 忠實對齊 Words.hk 官方 database (dict.json) 的原生條目與詞性 (Poses) 結構。
 * 2. 每個詞條自帶 1:1 粵語釋義 (yue) + 官方精準英文對譯 (eng) + 展開例句 (egs)。
 * 3. 完美支持多音字 / 兼讀音在同一詞性條目下的並列展示（如 dyun3 與 dyun6）。
 * 4. 無縫融合 CC-Canto 現代漢語通用詞條，維持全網 23 萬+ 詞條高命中率。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dictJsonPath = '/Volumes/ExternalSSD/Projects/wordshk-tools/dict.json';
const dictionaryJsonPath = path.join(__dirname, '..', 'dictionary.json');
const customEntriesPath = path.join(__dirname, '..', 'data', 'custom_entries.json');

if (!fs.existsSync(dictJsonPath)) {
  console.error(`❌ 找不到 Words.hk dict.json: ${dictJsonPath}`);
  process.exit(1);
}

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
  if (!jp) return '';
  let result = '';
  if (jp.i) result += INITIAL_MAP[jp.i] || jp.i.toLowerCase();
  if (jp.n) result += NUCLEUS_MAP[jp.n] || jp.n.toLowerCase();
  if (jp.c) result += CODA_MAP[jp.c] || jp.c.toLowerCase();
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
    const engRaw = (eg.eng && Array.isArray(eg.eng)) ? eg.eng : eg.eng;
    return {
      yue: extractText(yueRaw),
      eng: extractText(engRaw)
    };
  }).filter(e => e.yue || e.eng);
}

console.log('📖 正在讀取 Words.hk 官方數據...');
const wordshk = JSON.parse(fs.readFileSync(dictJsonPath, 'utf-8'));
console.log(`   Words.hk 條目數: ${Object.keys(wordshk).length.toLocaleString()}`);

// 建立 Words.hk 中 word -> entries 映射與關係元數據
const wordshkEntriesMap = new Map();
const wordshkMetaMap = new Map();

for (const [id, entry] of Object.entries(wordshk)) {
  const poses = (entry.poses && entry.poses.length > 0) ? entry.poses.join(' · ') : '';
  const labels = (entry.labels && entry.labels.length > 0) ? entry.labels.join(' · ') : '';
  const fullPos = (poses && labels) ? `${poses} · ${labels}` : (poses || labels);

  const defs = (entry.defs || []).map(d => ({
    yue: extractText(d.yue),
    eng: extractText(d.eng),
    egs: extractExamples(d.egs)
  })).filter(d => d.yue || d.eng);

  const allVariantWords = (entry.variants || []).map(v => v.w).filter(Boolean);

  for (const v of entry.variants || []) {
    const w = v.w;
    if (!w) continue;

    const prs = (v.p || []).map(pr => {
      const jp = convertPronunciationArray(pr);
      return {
        jyutping: jp,
        yale: jyutpingToYale(jp)
      };
    }).filter(p => p.jyutping);

    if (!wordshkEntriesMap.has(w)) {
      wordshkEntriesMap.set(w, []);
    }

    wordshkEntriesMap.get(w).push({
      id: entry.id,
      pos: fullPos,
      pronunciations: prs,
      defs: defs
    });

    if (!wordshkMetaMap.has(w)) {
      wordshkMetaMap.set(w, {
        sims: new Set(),
        ants: new Set(),
        see_also: new Set()
      });
    }

    const meta = wordshkMetaMap.get(w);
    (entry.sims || []).forEach(s => { if (s && s !== w) meta.sims.add(s); });
    (entry.ants || []).forEach(a => { if (a && a !== w) meta.ants.add(a); });
    allVariantWords.forEach(vw => { if (vw && vw !== w) meta.see_also.add(vw); });
  }
}

console.log(`   Words.hk 提取獨立詞彙: ${wordshkEntriesMap.size.toLocaleString()}`);

console.log('\n📖 正在讀取現有 dictionary.json...');
const dictionary = fs.existsSync(dictionaryJsonPath)
  ? JSON.parse(fs.readFileSync(dictionaryJsonPath, 'utf-8'))
  : {};
console.log(`   現有基礎詞典詞條數: ${Object.keys(dictionary).length.toLocaleString()}`);

console.log('\n⚙️ 正在升級詞典架構為原生 entries 結構...');
let wordshkEnhancedCount = 0;
let cccantoFallbackCount = 0;
let newWordshkAddedCount = 0;

// 1. 遍歷現有 dictionary 中的詞條
for (const [word, entry] of Object.entries(dictionary)) {
  if (wordshkEntriesMap.has(word)) {
    const wEntries = wordshkEntriesMap.get(word);
    entry.entries = wEntries;

    // 更新頂級拼音為第一個 entry 的首選拼音
    if (wEntries.length > 0 && wEntries[0].pronunciations.length > 0) {
      entry.jyutping = wEntries[0].pronunciations[0].jyutping;
      entry.yale = wEntries[0].pronunciations[0].yale;
    }

    // 保留向後相容的平鋪 english 與 examples（由第一個 entry 構成）
    const firstDefs = wEntries[0]?.defs || [];
    const legacyEng = [];
    const legacyEgs = [];
    firstDefs.forEach(d => {
      if (d.yue) {
        legacyEng.push(`[粵] ${d.yue}`);
        legacyEgs.push(d.egs && d.egs.length > 0 ? d.egs : null);
      }
      if (d.eng) {
        legacyEng.push(d.eng);
        legacyEgs.push(null);
      }
    });
    entry.english = legacyEng;
    entry.examples = legacyEgs;

    // 注入 Words.hk 關聯詞 (近義詞、反義詞、異體字)
    const meta = wordshkMetaMap.get(word);
    if (meta) {
      if (meta.sims.size > 0) entry.sims = Array.from(meta.sims);
      if (meta.ants.size > 0) entry.ants = Array.from(meta.ants);
      if (meta.see_also.size > 0) entry.see_also = Array.from(meta.see_also);
    }

    // 清理舊的 readings 扁平結構，全面由 entries 接管
    delete entry.readings;

    wordshkEnhancedCount++;
  } else {
    // CC-Canto 通用詞條（Words.hk 未收錄）：封裝單個預設 entry
    const defs = (entry.english || []).map(e => ({
      yue: '',
      eng: e,
      egs: []
    }));

    entry.entries = [
      {
        id: 0,
        pos: '',
        pronunciations: [
          {
            jyutping: entry.jyutping || '',
            yale: entry.yale || ''
          }
        ],
        defs: defs
      }
    ];

    delete entry.readings;
    cccantoFallbackCount++;
  }
}

// 2. 補充 Words.hk 獨有的詞條（CC-Canto 中未收錄的約 1.29 萬詞）
for (const [word, wEntries] of wordshkEntriesMap.entries()) {
  if (!dictionary[word]) {
    const firstPr = wEntries[0]?.pronunciations[0] || { jyutping: '', yale: '' };
    const firstDefs = wEntries[0]?.defs || [];
    const legacyEng = [];
    const legacyEgs = [];
    firstDefs.forEach(d => {
      if (d.yue) {
        legacyEng.push(`[粵] ${d.yue}`);
        legacyEgs.push(d.egs && d.egs.length > 0 ? d.egs : null);
      }
      if (d.eng) {
        legacyEng.push(d.eng);
        legacyEgs.push(null);
      }
    });

    const newEntry = {
      traditional: word,
      simplified: word,
      pinyin: '',
      jyutping: firstPr.jyutping,
      yale: firstPr.yale,
      english: legacyEng,
      examples: legacyEgs,
      entries: wEntries
    };

    const meta = wordshkMetaMap.get(word);
    if (meta) {
      if (meta.sims.size > 0) newEntry.sims = Array.from(meta.sims);
      if (meta.ants.size > 0) newEntry.ants = Array.from(meta.ants);
      if (meta.see_also.size > 0) newEntry.see_also = Array.from(meta.see_also);
    }

    dictionary[word] = newEntry;
    newWordshkAddedCount++;
  }
}

console.log(`   Words.hk 升級覆蓋詞數: ${wordshkEnhancedCount.toLocaleString()}`);
console.log(`   CC-Canto 通用保留詞數: ${cccantoFallbackCount.toLocaleString()}`);
console.log(`   Words.hk 獨有新增詞數: ${newWordshkAddedCount.toLocaleString()}`);
console.log(`   全庫詞條總數: ${Object.keys(dictionary).length.toLocaleString()}`);

// 3. 合併自定義詞條 custom_entries.json
if (fs.existsSync(customEntriesPath)) {
  console.log('\n📖 正在合併自定義詞條 custom_entries.json...');
  const customEntries = JSON.parse(fs.readFileSync(customEntriesPath, 'utf-8'));
  let customCount = 0;
  for (const [word, cEntry] of Object.entries(customEntries)) {
    if (!cEntry.entries && cEntry.jyutping) {
      cEntry.entries = [
        {
          id: 0,
          pos: '',
          pronunciations: [{ jyutping: cEntry.jyutping, yale: cEntry.yale || '' }],
          defs: (cEntry.english || []).map((e, idx) => ({
            yue: e.startsWith('[粵]') ? e.replace(/^\[粵\]\s*/, '') : '',
            eng: e.startsWith('[粵]') ? '' : e,
            egs: cEntry.examples?.[idx] || []
          }))
        }
      ];
    }
    dictionary[word] = {
      ...dictionary[word],
      ...cEntry
    };
    customCount++;
  }
  console.log(`✅ 已合併 ${customCount} 條自定義詞條`);
}

// 4. 寫回 dictionary.json
console.log('\n💾 正在寫入 dictionary.json...');
fs.writeFileSync(dictionaryJsonPath, JSON.stringify(dictionary, null, 2), 'utf-8');
console.log('🎉 Words.hk 原生詞性條目詞典構建完成！');
