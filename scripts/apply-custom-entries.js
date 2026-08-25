/**
 * 自建詞條合入腳本 (Apply Custom Entries)
 * 將 data/custom_entries.json 中的自定義粵語詞條合入到主 dictionary.json
 *
 * 使用方法：
 *   node scripts/apply-custom-entries.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const customPath = path.join(__dirname, '..', 'data', 'custom_entries.json');
const dictPath = path.join(__dirname, '..', 'dictionary.json');

if (!fs.existsSync(customPath)) {
  console.error(`❌ 找不到自建詞庫文件: ${customPath}`);
  process.exit(1);
}

if (!fs.existsSync(dictPath)) {
  console.error(`❌ 找不到 dictionary.json: ${dictPath}`);
  process.exit(1);
}

console.log('📖 正在讀取 dictionary.json...');
const dictionary = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

console.log('📖 正在讀取 data/custom_entries.json...');
const customEntries = JSON.parse(fs.readFileSync(customPath, 'utf-8'));

const keys = Object.keys(customEntries);
console.log(`🔍 發現 ${keys.length} 個自建詞條`);

let addedCount = 0;
let updatedCount = 0;

for (const key of keys) {
  const entry = customEntries[key];
  // 確保標記 source: "custom"
  entry.source = entry.source || 'custom';

  if (!dictionary[key]) {
    addedCount++;
  } else {
    updatedCount++;
  }
  dictionary[key] = entry;
}

console.log('💾 正在保存 dictionary.json...');
fs.writeFileSync(dictPath, JSON.stringify(dictionary, null, 2), 'utf-8');

console.log('\n✅ 自建詞條合入完成！');
console.log(`📊 統計：新增 ${addedCount} 個，更新 ${updatedCount} 個，當前總詞條數: ${Object.keys(dictionary).length.toLocaleString()}`);
