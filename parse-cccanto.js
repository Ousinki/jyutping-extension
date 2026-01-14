/**
 * CC-Canto 詞典數據轉換腳本
 * 將 .txt 格式轉換成 JSON 格式供 Chrome Extension 使用
 *
 * 使用方法：
 * 1. 下載 CC-Canto 數據：https://cc-canto.org/cccanto-170202.zip
 * 2. 解壓後將 .txt 文件放在同一目錄
 * 3. 運行：node parse-cccanto.js
 */

const fs = require("fs");
const path = require("path");

/**
 * 解析單行 CC-Canto 數據
 * 格式：你好 你好 [ni3 hao3] {nei5 hou2} /hello/hi/
 */
function parseLine(line) {
  // 跳過註釋行和空行
  if (line.startsWith('#') || !line.trim()) {
    return null;
  }

  // 格式 1：CC-Canto 完整格式
  // 繁體 簡體 [拼音] {粵拼} /釋義/
  const fullRegex = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\{([^}]+)\}\s+\/(.+)\/\s*$/;
  const fullMatch = line.match(fullRegex);
  
  if (fullMatch) {
    const [_, traditional, simplified, pinyin, jyutping, definitions] = fullMatch;
    return {
      traditional,
      simplified,
      pinyin,
      jyutping,
      english: definitions.split('/').filter(d => d.trim())
    };
  }

  // 格式 2：CC-CEDICT Canto Readings 格式（無英文釋義）
  // 繁體 簡體 [拼音] {粵拼}
  const readingsRegex = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\{([^}]+)\}\s*$/;
  const readingsMatch = line.match(readingsRegex);
  
  if (readingsMatch) {
    const [_, traditional, simplified, pinyin, jyutping] = readingsMatch;
    return {
      traditional,
      simplified,
      pinyin,
      jyutping,
      english: [] // 無英文釋義
    };
  }

  // 格式 3：無粵拼的簡化格式
  // 繁體 簡體 [拼音] /釋義/
  const simpleRegex = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/;
  const simpleMatch = line.match(simpleRegex);
  
  if (simpleMatch) {
    const [_, traditional, simplified, pinyin, definitions] = simpleMatch;
    return {
      traditional,
      simplified,
      pinyin,
      jyutping: '', // 沒有粵拼
      english: definitions.split('/').filter(d => d.trim())
    };
  }

  return null;
}

/**
 * Jyutping 轉換成 Yale 拼音（簡化版）
 */
function jyutpingToYale(jyutping) {
  if (!jyutping) return "";

  // 分離音節
  const syllables = jyutping.toLowerCase().split(" ");

  const yaleSyllables = syllables.map((syllable) => {
    // 提取聲調數字
    const toneMatch = syllable.match(/^([a-z]+)([1-6])$/);
    if (!toneMatch) return syllable;

    const [_, letters, tone] = toneMatch;

    // 聲調標記對應
    const toneMarks = {
      1: "̄", // 高平
      2: "́", // 高升
      3: "", // 中平
      4: "̀", // 低降
      5: "̏", // 低升
      6: "", // 低平
    };

    // 簡化版轉換（實際需要更複雜的規則）
    // 這裡只是示範，實際應該根據韻母規則添加聲調
    let yale = letters;

    // 找到主元音添加聲調
    const vowelIndex = yale.search(/[aeiou]/);
    if (vowelIndex !== -1 && toneMarks[tone]) {
      yale =
        yale.slice(0, vowelIndex + 1) +
        toneMarks[tone] +
        yale.slice(vowelIndex + 1);
    }

    return yale;
  });

  return yaleSyllables.join(" ");
}

/**
 * 解析整個詞典文件
 */
function parseDict(filePath) {
  console.log(`正在讀取文件: ${filePath}`);

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const dict = {};

  let parsedCount = 0;
  let errorCount = 0;

  lines.forEach((line, index) => {
    const entry = parseLine(line);
    if (entry) {
      // 同時用繁體和簡體作為 key（如果不同）
      dict[entry.traditional] = {
        ...entry,
        yale: jyutpingToYale(entry.jyutping),
      };

      if (entry.simplified !== entry.traditional) {
        dict[entry.simplified] = {
          ...entry,
          yale: jyutpingToYale(entry.jyutping),
        };
      }

      parsedCount++;
    } else if (line.trim() && !line.startsWith("#")) {
      errorCount++;
      if (errorCount <= 5) {
        console.log(`解析錯誤 (行 ${index + 1}): ${line.substring(0, 50)}...`);
      }
    }
  });

  console.log(`✓ 成功解析 ${parsedCount} 個詞條`);
  if (errorCount > 0) {
    console.log(`⚠ ${errorCount} 行無法解析`);
  }

  return dict;
}

/**
 * 主函數
 */
function main() {
  // 查找粵語詞典文件 (.txt)
  const cantoFiles = fs
    .readdirSync(".")
    .filter((f) => f.endsWith(".txt") && f.includes("canto"));

  // 查找 CC-CEDICT 文件 (.u8)
  const cedictFiles = fs
    .readdirSync(".")
    .filter((f) => f.endsWith(".u8"));

  if (cantoFiles.length === 0 && cedictFiles.length === 0) {
    console.error("❌ 找不到詞典文件！");
    console.log("請下載並解壓 CC-Canto 數據：");
    console.log("https://cc-canto.org/cccanto-170202.zip");
    return;
  }

  console.log("找到以下詞典文件：");
  cantoFiles.forEach((f) => console.log(`  - ${f} (粵語)`));
  cedictFiles.forEach((f) => console.log(`  - ${f} (CC-CEDICT)`));
  console.log("");

  // 第一步：解析粵語詞典文件
  let combinedDict = {};

  cantoFiles.forEach((file) => {
    const dict = parseDict(file);
    
    // 智能合併：保留英文釋義
    Object.keys(dict).forEach(key => {
      const newEntry = dict[key];
      const existingEntry = combinedDict[key];
      
      if (!existingEntry) {
        combinedDict[key] = newEntry;
      } else {
        combinedDict[key] = {
          traditional: newEntry.traditional || existingEntry.traditional,
          simplified: newEntry.simplified || existingEntry.simplified,
          pinyin: newEntry.pinyin || existingEntry.pinyin,
          jyutping: newEntry.jyutping || existingEntry.jyutping,
          yale: newEntry.yale || existingEntry.yale,
          english: (newEntry.english && newEntry.english.length > 0) 
            ? newEntry.english 
            : existingEntry.english
        };
      }
    });
  });

  // 第二步：用 CC-CEDICT 補充英文釋義
  cedictFiles.forEach((file) => {
    console.log(`\n正在讀取 CC-CEDICT: ${file}`);
    const dict = parseDict(file);
    let updatedCount = 0;
    let addedCount = 0;
    let skippedCount = 0;
    
    // 檢查英文釋義是否有用（過濾交叉引用）
    function isUsefulDefinition(english) {
      if (!english || english.length === 0) return false;
      
      const uselessPatterns = [
        /^used in /i,
        /^see also /i,
        /^see /i,
        /^variant of /i,
        /^old variant of /i,
        /^same as /i,
        /^abbr\. for /i,
        /^abbr\./i,
        /^CL:/,
        /^also written /i,
        /^also pr\./i,
        /^erhua variant of /i
      ];
      
      // 如果所有釋義都是無用的，返回 false
      const usefulDefs = english.filter(def => {
        return !uselessPatterns.some(pattern => pattern.test(def));
      });
      
      return usefulDefs.length > 0;
    }
    
    // 獲取有用的釋義
    function getUsefulDefinitions(english) {
      if (!english || english.length === 0) return [];
      
      const uselessPatterns = [
        /^used in /i,
        /^see also /i,
        /^see /i,
        /^variant of /i,
        /^old variant of /i,
        /^same as /i,
        /^abbr\. for /i,
        /^also written /i,
        /^also pr\./i,
        /^erhua variant of /i
      ];
      
      return english.filter(def => {
        return !uselessPatterns.some(pattern => pattern.test(def));
      });
    }
    
    Object.keys(dict).forEach(key => {
      const cedictEntry = dict[key];
      const existingEntry = combinedDict[key];
      
      // 獲取有用的釋義
      const usefulDefs = getUsefulDefinitions(cedictEntry.english);
      
      if (!existingEntry) {
        // 新詞條，只有有用釋義才添加
        if (usefulDefs.length > 0) {
          cedictEntry.english = usefulDefs;
          combinedDict[key] = cedictEntry;
          addedCount++;
        } else {
          skippedCount++;
        }
      } else {
        // 已存在，只有 CC-CEDICT 有用釋義才替換
        if (usefulDefs.length > 0) {
          existingEntry.english = usefulDefs;
          updatedCount++;
        }
        // 保留粵拼
        combinedDict[key] = existingEntry;
      }
    });
    
    console.log(`✓ 更新了 ${updatedCount} 個詞條的英文釋義`);
    console.log(`✓ 添加了 ${addedCount} 個新詞條`);
    console.log(`ℹ 跳過了 ${skippedCount} 個無用條目（交叉引用）`);
  });

  // 儲存為 JSON
  const outputFile = "dictionary.json";
  fs.writeFileSync(outputFile, JSON.stringify(combinedDict, null, 2), "utf-8");

  console.log(`\n✓ 字典已保存到: ${outputFile}`);
  console.log(`  總詞條數: ${Object.keys(combinedDict).length}`);
  console.log(
    `  文件大小: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`
  );

  // 顯示幾個示例
  console.log("\n示例詞條：");
  const samples = Object.keys(combinedDict).slice(0, 3);
  samples.forEach((key) => {
    const entry = combinedDict[key];
    console.log(`\n  ${entry.traditional}:`);
    console.log(`    粵拼: ${entry.jyutping}`);
    console.log(`    Yale: ${entry.yale}`);
    console.log(`    釋義: ${entry.english.slice(0, 2).join(", ")}`);
  });
}

// 運行
if (require.main === module) {
  main();
}

module.exports = { parseLine, jyutpingToYale, parseDict };
