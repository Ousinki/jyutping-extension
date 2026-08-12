/**
 * words.hk (粵典) 數據合併腳本
 * 將 words.hk 的 dict.json 合併到現有的 dictionary.json
 *
 * 使用方法：
 *   node merge-wordshk.js
 */

const fs = require("fs");
const path = require("path");
const { jyutpingToYale } = require("./parse-cccanto");

// ============ Jyutping 編碼轉換 ============

// words.hk dict.json 中粵拼使用結構化編碼：
//   { "S": { "i": "W", "n": "A", "c": "T", "t": "T1" } }
// 需要轉換為標準粵拼字符串：wat1

const INITIAL_MAP = {
  B: "b", P: "p", M: "m", F: "f",
  D: "d", T: "t", N: "n", L: "l",
  G: "g", K: "k", Ng: "ng", H: "h",
  Gw: "gw", Kw: "kw", W: "w",
  Z: "z", C: "c", S: "s", J: "j",
};

const NUCLEUS_MAP = {
  Aa: "aa", I: "i", U: "u", E: "e", O: "o",
  Yu: "yu", Oe: "oe", A: "a", Eo: "eo",
};

const CODA_MAP = {
  P: "p", T: "t", K: "k",
  M: "m", N: "n", Ng: "ng",
  I: "i", U: "u",
};

const TONE_MAP = {
  T1: "1", T2: "2", T3: "3",
  T4: "4", T5: "5", T6: "6",
};

/**
 * 將單個粵拼音節從結構化編碼轉換為字符串
 * { "i": "W", "n": "A", "c": "T", "t": "T1" } → "wat1"
 */
function convertJyutpingSyllable(jp) {
  let result = "";
  if (jp.i) result += INITIAL_MAP[jp.i] || "";
  if (jp.n) result += NUCLEUS_MAP[jp.n] || "";
  if (jp.c) result += CODA_MAP[jp.c] || "";
  if (jp.t) result += TONE_MAP[jp.t] || "";
  return result;
}

/**
 * 將 variants 的 p (pronunciation) 轉換為粵拼字符串
 * p 是一個多層數組：p[讀音索引][音節索引] = { S: {...} } 或 { N: "..." }
 */
function convertPronunciation(p) {
  if (!p || p.length === 0) return "";

  // 取第一個讀音
  const firstPr = p[0];
  if (!firstPr || !Array.isArray(firstPr)) return "";

  const syllables = firstPr.map((seg) => {
    if (seg.S) {
      return convertJyutpingSyllable(seg.S);
    } else if (seg.N) {
      return seg.N; // 非標準粵拼，保留原文
    }
    return "";
  });

  return syllables.join(" ");
}

// ============ 文本提取 ============

/**
 * 從 words.hk 的嵌套文本結構中提取純文本
 * 格式：[["T", "文本"], ["L", "鏈接文本"], ...]
 */
/**
 * 提取例句
 */
function extractExamples(egs) {
  if (!egs || !Array.isArray(egs)) return [];
  return egs.map(eg => {
    // yue 是一個 tuple [TextStructure, JyutpingString], 取第0個元素
    const yueRaw = (eg.yue && Array.isArray(eg.yue)) ? eg.yue[0] : eg.yue;
    return {
      yue: extractText(yueRaw),
      eng: extractText(eg.eng)
    };
  });
}

/**
 * 從 words.hk 的嵌套文本結構中提取純文本
 * 格式：[["T", "文本"], ["L", "鏈接文本"], ...] (Multi-line)
 * 或者直接：[["T", "文本"], ...] (Single-line, depth 2)
 */
function extractText(lines) {
  if (!lines || !Array.isArray(lines)) return "";
  
  // 處理單行結構 (Depth 2: Array<Segment>) vs 多行 (Depth 3: Array<Array<Segment>>)
  let realLines = lines;
  const first = lines[0];
  // 如果第一個元素是數組，且其第一個元素是字符串 (e.g. ["T", "text"])，則這是單行結構
  if (Array.isArray(first) && first.length > 0 && typeof first[0] === 'string') {
     realLines = [ lines ];
  }

  return realLines
    .map((line) => {
      if (!Array.isArray(line)) return "";
      return line
        .map((seg) => {
          if (Array.isArray(seg) && seg.length >= 2) {
            return seg[1]; // seg[0] 是類型(T/L)，seg[1] 是文本
          }
          return "";
        })
        .join("");
    })
    .filter(line => line.trim().length > 0) // 過濾空行
    .join("; ");
}

/**
 * 從 dict.json 條目提取英文和粵語解釋及例句
 */
function extractDefinitions(defs) {
  const definitions = []; // { text, examples, type: 'eng'|'yue' }

  if (!defs || !Array.isArray(defs)) return definitions;

  for (const def of defs) {
    const examples = extractExamples(def.egs);
    
    // 英文解釋
    if (def.eng) {
      const engText = extractText(def.eng);
      if (engText) {
        definitions.push({ text: engText, examples, type: 'eng' });
      }
    }
    // 粵語解釋
    if (def.yue) {
      const yueText = extractText(def.yue);
      if (yueText) {
        definitions.push({ text: yueText, examples, type: 'yue' });
      }
    }
  }

  return definitions;
}

// ============ 主合併邏輯 ============

function main() {
  const dictJsonPath = path.join(
    "/Volumes/ExternalSSD/Projects/wordshk-tools",
    "examples/export_json_dict/app_tmp/dict.json"
  );
  const dictionaryJsonPath = path.join(__dirname, "dictionary.json");
  const backupPath = path.join(__dirname, "dictionary.json.bak");

  // 檢查文件存在
  if (!fs.existsSync(dictJsonPath)) {
    console.error(`❌ 找不到 words.hk dict.json: ${dictJsonPath}`);
    console.log("請先運行 export_json_dict 生成 dict.json");
    return;
  }
  if (!fs.existsSync(dictionaryJsonPath)) {
    console.error(`❌ 找不到 dictionary.json: ${dictionaryJsonPath}`);
    return;
  }

  // 讀取文件
  console.log("📖 正在讀取 dictionary.json...");
  const dictionary = JSON.parse(fs.readFileSync(dictionaryJsonPath, "utf-8"));
  const originalCount = Object.keys(dictionary).length;
  console.log(`   原有詞條: ${originalCount.toLocaleString()}`);

  console.log("📖 正在讀取 words.hk dict.json...");
  const wordshk = JSON.parse(fs.readFileSync(dictJsonPath, "utf-8"));
  console.log(`   words.hk 詞條: ${Object.keys(wordshk).length.toLocaleString()}`);

  // 備份
  console.log(`\n💾 備份 dictionary.json → dictionary.json.bak`);
  fs.copyFileSync(dictionaryJsonPath, backupPath);

  // 統計
  let newCount = 0;
  let enrichedCount = 0;
  let skippedCount = 0;

  console.log("\n🔄 正在合併...\n");

  for (const [id, entry] of Object.entries(wordshk)) {
    const variants = entry.variants || [];
    const definitions = extractDefinitions(entry.defs);
    const poses = (entry.poses || []).join(", ");
    const sims = (entry.sims || []).filter(s => s); // 近義詞
    const ants = (entry.ants || []).filter(s => s); // 反義詞

    for (const variant of variants) {
      const word = variant.w;
      if (!word) continue;

      const jyutping = convertPronunciation(variant.p);
      if (!jyutping) {
        skippedCount++;
        continue;
      }

      const yale = jyutpingToYale(jyutping);

      if (dictionary[word]) {
        // 已有詞條：補充粵語解釋
        const existing = dictionary[word];
        const existingEnglish = existing.english || [];
        
        // 初始化 examples 數組（如果還沒有）
        if (!existing.examples) {
          existing.examples = new Array(existingEnglish.length).fill(null);
        }

        // 提取粵語解釋
        const yueDefs = definitions.filter(d => d.type === 'yue');

        if (yueDefs.length > 0) {
          // 添加粵語解釋（帶 [粵] 前綴）及其例句
          let hasAdded = false;
          
          for (const def of yueDefs) {
            const formattedDef = `[粵] ${def.text}`;
            const index = existingEnglish.indexOf(formattedDef);
            
            if (index !== -1) {
              // 定義已存在，檢查是否需要補充例句
              if (!existing.examples[index] && def.examples.length > 0) {
                existing.examples[index] = def.examples;
                // 注意：這裡只補充數據，不算作"新增解釋"，但技術上是豐富了數據
              }
            } else {
              // 新定義
              existing.english.push(formattedDef);
              existing.examples.push(def.examples.length > 0 ? def.examples : null);
              hasAdded = true;
            }
          }

          if (hasAdded) {
            enrichedCount++;
          }
        }

        // 如果原有詞條沒有粵拼，用 words.hk 的
        if (!existing.jyutping && jyutping) {
          existing.jyutping = jyutping;
          existing.yale = yale;
        }

        // 添加近義詞和反義詞
        if (sims.length > 0) existing.sims = sims;
        if (ants.length > 0) existing.ants = ants;
      } else {
        // 新詞條
        if (definitions.length === 0) {
          skippedCount++;
          continue;
        }

        const englishArr = [];
        const examplesArr = [];

        for (const def of definitions) {
          if (def.type === 'eng') {
            englishArr.push(def.text);
          } else {
            englishArr.push(`[粵] ${def.text}`);
          }
          examplesArr.push(def.examples.length > 0 ? def.examples : null);
        }

        const newEntry = {
          traditional: word,
          simplified: word, // words.hk 主要是繁體
          pinyin: "",
          jyutping: jyutping,
          english: englishArr,
          examples: examplesArr,
          yale: yale,
        };
        if (sims.length > 0) newEntry.sims = sims;
        if (ants.length > 0) newEntry.ants = ants;

        dictionary[word] = newEntry;
        newCount++;
      }
    }
  }

  // 第二步：添加 see_also 交叉引用（同一詞條的不同寫法）
  console.log("🔗 正在添加異體字交叉引用...");
  let seeAlsoCount = 0;

  for (const [id, entry] of Object.entries(wordshk)) {
    const variants = entry.variants || [];
    if (variants.length < 2) continue;

    // 提取所有在詞典中存在的 variant 詞
    const variantWords = variants
      .map((v) => v.w)
      .filter((w) => w && dictionary[w]);

    if (variantWords.length < 2) continue;

    // 為每個 variant 添加指向其他 variants 的引用
    for (const word of variantWords) {
      const others = variantWords.filter((w) => w !== word);
      if (others.length > 0) {
        dictionary[word].see_also = others;
        seeAlsoCount++;
      }
    }
  }

  // 保存
  console.log("💾 正在保存合併後的 dictionary.json...");
  fs.writeFileSync(
    dictionaryJsonPath,
    JSON.stringify(dictionary, null, 2),
    "utf-8"
  );

  const finalCount = Object.keys(dictionary).length;
  const fileSize = (fs.statSync(dictionaryJsonPath).size / 1024 / 1024).toFixed(2);

  // 結果報告
  console.log("\n✅ 合併完成！\n");
  console.log("📊 統計：");
  console.log(`   原有詞條: ${originalCount.toLocaleString()}`);
  console.log(`   新增詞條: ${newCount.toLocaleString()}`);
  console.log(`   補充粵語解釋: ${enrichedCount.toLocaleString()}`);
  console.log(`   交叉引用: ${seeAlsoCount.toLocaleString()}`);
  console.log(`   跳過（缺少數據）: ${skippedCount.toLocaleString()}`);
  console.log(`   最終詞條: ${finalCount.toLocaleString()}`);
  console.log(`   文件大小: ${fileSize} MB`);

  // 示例
  console.log("\n📝 示例詞條：");
  const sampleWords = ["屈機", "捉依因", "攤大手板", "格仔舖"];
  for (const word of sampleWords) {
    if (dictionary[word]) {
      const e = dictionary[word];
      console.log(`\n  ${word}:`);
      console.log(`    粵拼: ${e.jyutping}`);
      console.log(`    Yale: ${e.yale}`);
      console.log(
        `    釋義: ${e.english
          .slice(0, 3)
          .map((d) => d.substring(0, 60))
          .join(" | ")}`
      );
    }
  }
}

main();
