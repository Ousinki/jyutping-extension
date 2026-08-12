/**
 * 生詞本存儲模塊
 * 使用 chrome.storage.local 存儲用戶收藏的粵語詞彙
 */

const WORDBOOK_KEY = 'wordbook';

/**
 * 生成唯一 ID
 */
function generateId() {
  return 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

/**
 * 獲取完整生詞列表
 * @returns {Promise<Array>} 按添加時間倒序排列的生詞數組
 */
export async function getWordbook() {
  return new Promise((resolve) => {
    chrome.storage.local.get([WORDBOOK_KEY], (result) => {
      resolve(result[WORDBOOK_KEY] || []);
    });
  });
}

/**
 * 添加一個詞到生詞本（自動去重）
 * @param {Object} wordData - 詞條數據
 * @param {string} wordData.character - 繁體漢字
 * @param {string} [wordData.simplified] - 簡體
 * @param {string} [wordData.jyutping] - 粵拼
 * @param {string} [wordData.yale] - 耶魯拼音
 * @param {Array<string>} [wordData.english] - 英文釋義
 * @param {string} [wordData.sourceUrl] - 來源網頁 URL
 * @param {string} [wordData.sourceTitle] - 來源網頁標題
 * @returns {Promise<{success: boolean, isNew: boolean, entry: Object}>}
 */
export async function addWord(wordData) {
  const wordbook = await getWordbook();

  // 去重：按 character 檢查
  const existing = wordbook.find(w => w.character === wordData.character);
  if (existing) {
    return { success: true, isNew: false, entry: existing };
  }

  const entry = {
    id: generateId(),
    character: wordData.character,
    simplified: wordData.simplified || wordData.character,
    jyutping: wordData.jyutping || '',
    yale: wordData.yale || '',
    english: wordData.english || [],
    timestamp: Date.now(),
    sourceUrl: wordData.sourceUrl || '',
    sourceTitle: wordData.sourceTitle || '',
    tags: [],
    notes: ''
  };

  // 新詞插入到頭部（最新的在前面）
  wordbook.unshift(entry);

  return new Promise((resolve) => {
    chrome.storage.local.set({ [WORDBOOK_KEY]: wordbook }, () => {
      resolve({ success: true, isNew: true, entry });
    });
  });
}

/**
 * 檢查一個詞是否已收藏
 * @param {string} character - 漢字
 * @returns {Promise<boolean>}
 */
export async function isWordSaved(character) {
  const wordbook = await getWordbook();
  return wordbook.some(w => w.character === character);
}

/**
 * 按 ID 刪除一個詞
 * @param {string} id - 詞條 ID
 * @returns {Promise<boolean>}
 */
export async function removeWord(id) {
  const wordbook = await getWordbook();
  const filtered = wordbook.filter(w => w.id !== id);
  if (filtered.length === wordbook.length) return false;

  return new Promise((resolve) => {
    chrome.storage.local.set({ [WORDBOOK_KEY]: filtered }, () => {
      resolve(true);
    });
  });
}

/**
 * 批量刪除
 * @param {Array<string>} ids - 要刪除的 ID 列表
 * @returns {Promise<number>} 刪除的數量
 */
export async function removeWords(ids) {
  const idSet = new Set(ids);
  const wordbook = await getWordbook();
  const filtered = wordbook.filter(w => !idSet.has(w.id));
  const removedCount = wordbook.length - filtered.length;

  return new Promise((resolve) => {
    chrome.storage.local.set({ [WORDBOOK_KEY]: filtered }, () => {
      resolve(removedCount);
    });
  });
}

/**
 * 更新一個詞條的備注或標籤
 * @param {string} id - 詞條 ID
 * @param {Object} updates - 要更新的字段
 * @returns {Promise<boolean>}
 */
export async function updateWord(id, updates) {
  const wordbook = await getWordbook();
  const index = wordbook.findIndex(w => w.id === id);
  if (index === -1) return false;

  // 只允許更新安全的字段
  const safeFields = ['notes', 'tags'];
  for (const key of safeFields) {
    if (key in updates) {
      wordbook[index][key] = updates[key];
    }
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [WORDBOOK_KEY]: wordbook }, () => {
      resolve(true);
    });
  });
}

/**
 * 從生詞本移除一個詞（按 character）
 * @param {string} character - 漢字
 * @returns {Promise<boolean>}
 */
export async function removeWordByCharacter(character) {
  const wordbook = await getWordbook();
  const filtered = wordbook.filter(w => w.character !== character);
  if (filtered.length === wordbook.length) return false;

  return new Promise((resolve) => {
    chrome.storage.local.set({ [WORDBOOK_KEY]: filtered }, () => {
      resolve(true);
    });
  });
}

/**
 * 獲取生詞本統計信息
 * @returns {Promise<Object>}
 */
export async function getWordbookStats() {
  const wordbook = await getWordbook();
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  return {
    total: wordbook.length,
    today: wordbook.filter(w => w.timestamp >= todayStart).length,
    thisWeek: wordbook.filter(w => w.timestamp >= weekStart).length
  };
}

/**
 * 獲取存儲使用量
 * @returns {Promise<{used: number, quota: number, percentage: number}>}
 */
export async function getStorageUsage() {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse([WORDBOOK_KEY], (bytes) => {
      const quota = 5 * 1024 * 1024; // 5MB default
      resolve({
        used: bytes,
        quota,
        percentage: Math.round((bytes / quota) * 100 * 10) / 10
      });
    });
  });
}

/**
 * 導出生詞本
 * @param {'json'|'csv'|'markdown'|'txt'} format
 * @returns {Promise<{content: string, mimeType: string, ext: string}>}
 */
export async function exportWordbook(format) {
  const wordbook = await getWordbook();

  switch (format) {
    case 'json':
      return {
        content: JSON.stringify(wordbook, null, 2),
        mimeType: 'application/json',
        ext: 'json'
      };

    case 'csv': {
      const header = '漢字,粵拼,Yale,英文釋義,添加日期,來源\n';
      const rows = wordbook.map(w =>
        `"${w.character}","${w.jyutping}","${w.yale || ''}","${(w.english || []).join('; ')}","${new Date(w.timestamp).toLocaleDateString()}","${w.sourceUrl || ''}"`
      ).join('\n');
      return {
        content: '\uFEFF' + header + rows,  // BOM for Excel UTF-8
        mimeType: 'text/csv;charset=utf-8',
        ext: 'csv'
      };
    }

    case 'markdown': {
      const mdHeader = '| 漢字 | 粵拼 | 英文 | 日期 |\n|------|------|------|------|\n';
      const mdRows = wordbook.map(w =>
        `| ${w.character} | ${w.jyutping} | ${(w.english || []).join('; ')} | ${new Date(w.timestamp).toLocaleDateString()} |`
      ).join('\n');
      return {
        content: `# 我的粵語生詞本\n\n共 ${wordbook.length} 詞\n\n${mdHeader}${mdRows}\n`,
        mimeType: 'text/markdown',
        ext: 'md'
      };
    }

    case 'txt': {
      const txtRows = wordbook.map(w =>
        `${w.character}\t${w.jyutping}\t${(w.english || []).join('; ')}`
      ).join('\n');
      return {
        content: txtRows,
        mimeType: 'text/plain',
        ext: 'txt'
      };
    }

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * 導入生詞本（合併去重）
 * @param {Array} data - 要導入的詞條數組
 * @returns {Promise<{added: number, skipped: number}>}
 */
export async function importWordbook(data) {
  if (!Array.isArray(data)) throw new Error('Invalid data format');

  const wordbook = await getWordbook();
  const existingChars = new Set(wordbook.map(w => w.character));

  let added = 0;
  let skipped = 0;

  for (const item of data) {
    if (!item.character) continue;

    if (existingChars.has(item.character)) {
      skipped++;
      continue;
    }

    const entry = {
      id: generateId(),
      character: item.character,
      simplified: item.simplified || item.character,
      jyutping: item.jyutping || '',
      yale: item.yale || '',
      english: Array.isArray(item.english) ? item.english : (item.english ? [item.english] : []),
      timestamp: item.timestamp || Date.now(),
      sourceUrl: item.sourceUrl || '',
      sourceTitle: item.sourceTitle || '',
      tags: item.tags || [],
      notes: item.notes || ''
    };

    wordbook.unshift(entry);
    existingChars.add(item.character);
    added++;
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [WORDBOOK_KEY]: wordbook }, () => {
      resolve({ added, skipped });
    });
  });
}
