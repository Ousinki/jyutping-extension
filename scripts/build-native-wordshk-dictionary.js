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
import * as OpenCC from 'opencc-js';

const s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });
const t2s = OpenCC.Converter({ from: 'hk', to: 'cn' });

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

function extractText(lines, preserveLinks = false) {
  if (!lines || !Array.isArray(lines)) return '';
  let realLines = lines;
  const first = lines[0];
  if (Array.isArray(first) && first.length > 0 && typeof first[0] === 'string') {
    realLines = [lines];
  }
  return realLines
    .map(line => {
      if (!Array.isArray(line)) return '';
      return line.map(seg => {
        if (Array.isArray(seg) && seg.length >= 2) {
          const tag = seg[0];
          const text = seg[1];
          if (preserveLinks && tag === 'L' && text) {
            return `<span class="see-also-link" data-word="${text}">${text}</span>`;
          }
          return text;
        }
        return typeof seg === 'string' ? seg : '';
      }).join('');
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
      yue: extractText(yueRaw, false),
      eng: extractText(engRaw, false)
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
    yue: extractText(d.yue, true),
    eng: extractText(d.eng, false),
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

// 載入 Words.hk 官方詞頻表 (word_frequencies.rs) 以實現與官方 App 100% 一致的排序
const wordFrequenciesMap = new Map();
const freqFile = '/Volumes/ExternalSSD/Projects/wordshk-tools/data/word_frequencies.rs';
if (fs.existsSync(freqFile)) {
  const freqContent = fs.readFileSync(freqFile, 'utf-8');
  for (const m of freqContent.matchAll(/\((\d+),\s*(\d+)\)/g)) {
    wordFrequenciesMap.set(parseInt(m[1], 10), parseInt(m[2], 10));
  }
  console.log(`   載入官方詞頻表權重: ${wordFrequenciesMap.size.toLocaleString()} 條`);
}

function getEntryFrequency(id) {
  return wordFrequenciesMap.get(id) ?? 50;
}

// 嚴格按照 Words.hk 官方 App (wordshk-tools/src/entry_group_index.rs) 排序規則：
// 1. 詞頻降序 (Frequency Descending)
// 2. 釋義數量降序 (Defs Count Descending)
// 3. Entry ID 升序 (Entry ID Ascending)
function sortWordEntries(entries) {
  return entries.sort((a, b) => {
    const freqA = getEntryFrequency(a.id);
    const freqB = getEntryFrequency(b.id);
    if (freqA !== freqB) {
      return freqB - freqA;
    }
    const defsLenA = a.defs?.length || 0;
    const defsLenB = b.defs?.length || 0;
    if (defsLenA !== defsLenB) {
      return defsLenB - defsLenA;
    }
    return a.id - b.id;
  });
}

for (const [w, entries] of wordshkEntriesMap.entries()) {
  sortWordEntries(entries);
}

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

// 2.5 同步繁體與簡體詞條：讓所有簡體詞條 100% 繼承其繁體詞條的 Words.hk 原生條目與釋義
console.log('\n🔄 正在同步簡體詞條以完整繼承 Words.hk 原生數據...');
let simpSyncedCount = 0;
for (const [word, entry] of Object.entries(dictionary)) {
  const trad = entry.traditional || s2t(word);
  if (trad && trad !== word && dictionary[trad]) {
    const tradEntry = dictionary[trad];
    const isTradEnhanced = tradEntry.entries && tradEntry.entries.some(e => e.id > 0);
    const isSimpEnhanced = entry.entries && entry.entries.some(e => e.id > 0);

    if (isTradEnhanced && !isSimpEnhanced) {
      entry.entries = tradEntry.entries;
      entry.english = tradEntry.english;
      entry.examples = tradEntry.examples;
      entry.jyutping = tradEntry.jyutping;
      entry.yale = tradEntry.yale;
      if (tradEntry.sims) entry.sims = tradEntry.sims;
      if (tradEntry.ants) entry.ants = tradEntry.ants;
      if (tradEntry.see_also) entry.see_also = tradEntry.see_also;
      if (tradEntry.mandarin) entry.mandarin = tradEntry.mandarin;
      if (tradEntry.cantonese) entry.cantonese = tradEntry.cantonese;
      simpSyncedCount++;
    }
  }
}
console.log(`   成功同步簡體詞條: ${simpSyncedCount.toLocaleString()} 條`);

// 3. 處理普粵對照詞表 (mandarin_variants.tsv)
const mandarinVariantsPath = '/Volumes/ExternalSSD/Projects/wordshk-tools/data/mandarin_variants.tsv';
const c2mMap = new Map(); // 粵語 ➡️ 普通話
const m2cMap = new Map(); // 普通話 ➡️ 粵語

if (fs.existsSync(mandarinVariantsPath)) {
  console.log('\n📖 正在解析普粵對照詞表 mandarin_variants.tsv...');
  const manContent = fs.readFileSync(mandarinVariantsPath, 'utf-8');
  const lines = manContent.trim().split('\n').slice(1);
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 4) continue;
    const yueStr = parts[2];
    const manStr = parts[3];
    if (!yueStr || !manStr) continue;

    const yueWords = yueStr.split('/').map(s => s.trim()).filter(Boolean);
    const manWords = manStr.split('/').map(s => s.trim()).filter(Boolean);

    for (const mw of manWords) {
      const trad = s2t(mw);
      const simp = t2s(mw);

      [trad, simp].forEach(mForm => {
        if (!m2cMap.has(mForm)) m2cMap.set(mForm, new Set());
        yueWords.forEach(yw => m2cMap.get(mForm).add(yw));
      });
    }

    for (const yw of yueWords) {
      if (!c2mMap.has(yw)) c2mMap.set(yw, new Set());
      manWords.forEach(mw => {
        c2mMap.get(yw).add(s2t(mw));
      });
    }
  }
  console.log(`   粵語 ➡️ 普通話映射: ${c2mMap.size.toLocaleString()} 詞`);
  console.log(`   普通話 ➡️ 粵語映射: ${m2cMap.size.toLocaleString()} 詞`);

  // 為所有字典中的粵語詞注入普通話對應說法 (mandarin)
  for (const [word, entry] of Object.entries(dictionary)) {
    if (c2mMap.has(word)) {
      entry.mandarin = Array.from(c2mMap.get(word));
    }
  }

  // 為普通話詞注入粵語對應說法 (cantonese)，若未收錄則自動生成輕量對照條目
  let newMandarinAdded = 0;
  for (const [manWord, yueSet] of m2cMap.entries()) {
    const yueList = Array.from(yueSet);
    const manTrad = s2t(manWord);
    const manSimp = t2s(manWord);

    if (!dictionary[manWord]) {
      const firstYue = yueList[0];
      const yueEntry = dictionary[firstYue];
      const jp = yueEntry ? yueEntry.jyutping : '';
      const yale = yueEntry ? yueEntry.yale : '';

      dictionary[manWord] = {
        traditional: manTrad,
        simplified: manSimp,
        pinyin: '',
        jyutping: jp,
        yale: yale,
        cantonese: yueList,
        english: [
          `普通話詞彙，對應地道粵語說法：${yueList.join('、')}`
        ],
        entries: [
          {
            id: 0,
            pos: '普通話詞彙',
            pronunciations: [
              {
                jyutping: jp,
                yale: yale
              }
            ],
            defs: [
              {
                yue: `普通話詞彙，對應地道粵語說法：${yueList.join('、')}`,
                eng: `Mandarin term, corresponding Cantonese expression: ${yueList.join(', ')}`,
                egs: []
              }
            ]
          }
        ]
      };
      newMandarinAdded++;
    } else {
      dictionary[manWord].cantonese = yueList;
      if (manTrad !== manWord && !dictionary[manTrad]) {
        dictionary[manTrad] = { ...dictionary[manWord], traditional: manTrad, simplified: manSimp };
      }
      if (manSimp !== manWord && !dictionary[manSimp]) {
        dictionary[manSimp] = { ...dictionary[manWord], traditional: manTrad, simplified: manSimp };
      }
    }
  }
  console.log(`   新收錄普通話反查詞條: ${newMandarinAdded.toLocaleString()} 詞`);
}

console.log(`\n📊 詞典最終詞條總數: ${Object.keys(dictionary).length.toLocaleString()}`);

// 4. 合併自定義詞條 custom_entries.json
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
