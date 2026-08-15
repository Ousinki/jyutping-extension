/**
 * 生詞本管理頁面邏輯
 * wordbook.js
 */
(function () {
  'use strict';

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderSimpleMarkdown(text) {
    if (typeof marked !== 'undefined') {
      return marked.parse(text);
    }
    // Escape HTML first for safety
    let html = escapeHtml(text);

    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_ (not inside words)
    html = html.replace(/(?<![\w*])\*([^*]+?)\*(?![\w*])/g, '<em>$1</em>');
    html = html.replace(/(?<![\w_])_([^_]+?)_(?![\w_])/g, '<em>$1</em>');

    // Inline code: `code`
    html = html.replace(/`([^`]+?)`/g, '<code style="background: var(--border); padding: 1px 4px; border-radius: 3px; font-size: 12px;">$1</code>');

    // Split into lines for block-level processing
    const lines = html.split('\n');
    const result = [];
    let inOl = false, inUl = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const olMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
      const ulMatch = line.match(/^\s*[-*]\s+(.*)/);
      const hMatch = line.match(/^\s*(#{1,6})\s+(.*)/);
      const hrMatch = line.match(/^\s*---\s*$/);

      if (olMatch) {
        if (!inOl) { if (inUl) { result.push('</ul>'); inUl = false; } result.push('<ol>'); inOl = true; }
        result.push('<li>' + olMatch[2] + '</li>');
      } else if (ulMatch) {
        if (!inUl) { if (inOl) { result.push('</ol>'); inOl = false; } result.push('<ul>'); inUl = true; }
        result.push('<li>' + ulMatch[1] + '</li>');
      } else if (hMatch) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inUl) { result.push('</ul>'); inUl = false; }
        const level = hMatch[1].length;
        result.push(`<h${level}>` + hMatch[2] + `</h${level}>`);
      } else if (hrMatch) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inUl) { result.push('</ul>'); inUl = false; }
        result.push('<hr style="border: 0; border-top: 1px dashed var(--border); margin: 16px 0;">');
      } else {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (line.trim() === '') {
          result.push('<br>');
        } else {
          result.push(line);
        }
      }
    }
    if (inOl) result.push('</ol>');
    if (inUl) result.push('</ul>');

    return result.join('\n');
  }

  function renderMarkdown(text) {
    if (!text) return '';
    let cleanText = text.trim();

    // Strip markdown code fences if wrapped in ```json ... ``` or ```markdown ... ```
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(?:json|markdown)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    // Auto-unwrap structured JSON if returned by model
    if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
      try {
        const data = JSON.parse(cleanText);
        if (data && (data.answer || data.reply)) {
          let md = data.answer || data.reply || '';
          if (Array.isArray(data.examples) && data.examples.length > 0) {
            md += '\n\n**例句：**\n' + data.examples.map((ex, i) => `${i + 1}. ${ex.yue || ex.sentence || ''}${ex.trans ? '（' + ex.trans + '）' : ''}`).join('\n');
          }
          cleanText = md;
        }
      } catch (e) {}
    }

    try {
      if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        return marked.parse(cleanText);
      }
    } catch(e) {}
    return renderSimpleMarkdown(cleanText);
  }

  const WORDBOOK_KEY = 'wordbook';
  const TRASH_AUTO_PURGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  let dictionary = null;
  let isDetailMode = localStorage.getItem('jyutping_detail_mode') === 'true';
  let aiHoverPronunciationEnabled = true;
  chrome.storage.local.get({ aiHoverPronunciationEnabled: true }, (res) => {
    aiHoverPronunciationEnabled = res.aiHoverPronunciationEnabled !== false;
  });

  // ==================== 存儲工具 ====================

  async function getWordbook() {
    return new Promise(resolve => {
      chrome.storage.local.get([WORDBOOK_KEY], result => {
        let list = result[WORDBOOK_KEY] || [];
        const now = Date.now();
        let hasExpired = false;

        // 自動清理超過 30 天的廢紙簍詞條
        const purged = list.filter(w => {
          if (w.deletedAt && (now - w.deletedAt > TRASH_AUTO_PURGE_MS)) {
            hasExpired = true;
            return false;
          }
          return true;
        });

        if (hasExpired) {
          chrome.storage.local.set({ [WORDBOOK_KEY]: purged });
          resolve(purged);
        } else {
          resolve(list);
        }
      });
    });
  }

  async function saveWordbook(wordbook) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [WORDBOOK_KEY]: wordbook }, resolve);
    });
  }

  async function getStorageUsage() {
    return new Promise(resolve => {
      chrome.storage.local.getBytesInUse([WORDBOOK_KEY], bytes => {
        const quota = 5 * 1024 * 1024;
        resolve({ used: bytes, quota, percentage: Math.round((bytes / quota) * 1000) / 10 });
      });
    });
  }

  // ==================== i18n ====================

  const i18nStrings = {
    'zh-HK': {
      wordbookAiSettingsTitle: 'AI 設定',
      wordbookAiSettingsDesc: '自訂詞典面板底部的快捷提問按鈕，點擊即可快速發送預設對話指令。',
      wordbookAiTabQuickActions: '快捷指令',
      wordbookAiTabCustomPrompt: '全域 Prompt',
      wordbookAiTabInteraction: '交互設定',
      wordbookAiTabInteractionDesc: '自訂 AI 回答區域中的浮動音標、單詞吸附與劃詞朗讀等互動功能。',
      aiHoverTtsSettingTitle: 'AI 回答懸停吸附音標與劃詞朗讀',
      aiHoverTtsSettingDesc: '光標懸停在 AI 回答的粵語單詞上時吸附展示音標發音膠囊，拖選文字時彈出朗讀懸浮窗。',
      wordbookEnableAiQuickActions: '顯示快捷指令欄',
      wordbookAddQuickAction: '添加新指令',
      wordbookAiQuery1: '用呢個詞造一個粵語例句，並附上書面語翻譯',
      wordbookAiQuery2: '呢個詞嘅粵語語源係咩？',
      wordbookAiQuery3: '呢個詞喺日常粵語入面點用？請提供例句並附上書面語翻譯',
      wordbookAiQuery4: '呢個詞有咩近義詞同反義詞？',
      wordbookTitle: '我的生詞本',
      wordbookSubtitle: 'My Cantonese Word Book',
      wordbookBackToSettings: '返回設定',
      wordbookWarning: '生詞本數據僅保存在本機，不會上傳雲端。卸載插件或清除瀏覽數據可能導致生詞丟失。建議定期',
      wordbookWarningExport: '導出備份',
      wordbookWarningEnd: '以防數據遺失。',
      wordbookTotal: '共',
      wordbookWords: '詞',
      wordbookToday: '今日',
      wordbookWeek: '本週',
      wordbookSearchPlaceholder: '搜索生詞…',
      wordbookSortNewest: '最新',
      wordbookSortOldest: '最早',
      wordbookSortAlpha: '字符',
      wordbookSortJyutping: '粵拼',
      wordbookExport: '導出',
      wordbookSelectAll: '全選',
      wordbookDeleteSelected: '刪除選中',
      wordbookCancel: '取消',
      wordbookConfirmImport: '確認導入',
      wordbookImportTitle: '導入生詞',
      wordbookEmptyTitle: '尚無生詞',
      wordbookEmptyDesc: '在網頁上懸停查詞時，點擊懸浮窗中的 ⭐ 按鈕即可收藏。<br>也可以在任何模式下按 <kbd class="kbd">S</kbd> 鍵快速收藏當前高亮詞。',
      wordbookDeleteConfirm: '確定要刪除選中的 {n} 個詞嗎？',
      wordbookImportSuccess: '成功導入 {added} 個新詞（跳過 {skipped} 個重複）',
      wordbookExported: '已導出 {format} 文件',
      wordbookDetailMode: '詞典模式',
      wordbookEmptyDetail: '點擊左側單字<br>查看詳細詞典釋義',
      wordbookModeWord: '生詞',
      wordbookModeDict: '詞典',
      wordbookExportJson: 'JSON (完整備份)',
      wordbookExportCsv: 'CSV (Excel 兼容)',
      wordbookExportMd: 'Markdown',
      wordbookExportTxt: '純文本 TXT',
      wordbookExportImport: '導入...',
      wordbookSpeak: '朗讀',
      aiActionRegenerate: '重新生成',
      aiActionFeedback: '反饋與建議',
      aiFeedbackModalTitle: '問題與反饋',
      aiFeedbackContextLabel: '提問與 AI 回答上下文',
      aiFeedbackMessageLabel: '反饋建議與問題描述',
      aiFeedbackMessagePlaceholder: '請描述這條 AI 回答有什麼問題或您的改進建議...',
      aiFeedbackTagWord: '詞',
      aiFeedbackTagQuestion: '問',
      aiFeedbackTagAi: 'AI',
      aiFeedbackSending: '發送中...',
      aiFeedbackSuccess: '發送成功！感謝您的反饋',
      aiFeedbackFail: '發送失敗，請稍後再試',
      aiFeedbackNetError: '發送失敗，請檢查網絡連接',
      optRequired: '必填',
      optOptional: '選填',
      optEmailLabel: '聯絡電郵',
      optEmailPlaceholder: 'your@email.com (方便回覆您)',
      optSend: '發送反饋',
      titleClose: '關閉',
      dictSearchFallback: '📖 詞典搜索',
      dictSearchEmpty: '未在詞典中找到匹配結果',
      dictSearchNoDetail: '詞典中未找到 <strong>$1</strong> 的詳細釋義。',
      wordbookAiChat: 'AI 問答',
      wordbookAiAction1: '造句',
      wordbookAiAction2: '語源',
      wordbookAiAction3: '日常用法',
      wordbookAiAction4: '近義反義',
      wordbookAiInputPlaceholder: '問關於「$1」的問題...',
      wordbookAiInputPlaceholderGeneric: '問任何關於粵語的問題...',
      wordbookEmptyDetail1: '點擊左側單詞查看詳情',
      wordbookEmptyDetail2: '或直接在下方提問',
      wordbookAiActionNamePlaceholder: '指令名稱 (如: 造句)',
      wordbookAiActionPromptPlaceholder: 'AI 提示詞 (如: 用這個詞造句...)',
      wordbookConfirmRestorePrompt: '確定要恢復預設 Prompt 嗎？這將會清除您自訂的系統提示詞。',
      badgeClickToTranslate: '點擊翻譯此釋義',
      badgeTranslating: '翻譯中...',
      badgeTranslationError: '翻譯失敗',
      badgeClickToRestore: '點擊切換回粵語原文',
      wordbookTabAll: '全部生詞',
      wordbookTabTrash: '廢紙簍',
      wordbookTrashBannerNotice: '已刪除的生詞將在廢紙簍中保留 30 天，逾期將自動徹底清除。',
      wordbookEmptyTrash: '清空廢紙簍',
      wordbookEmptyTrashConfirm: '確定要清空廢紙簍嗎？這將會永久刪除所有已刪除的生詞，無法復原。',
      wordbookRestoreAll: '全部還原',
      wordbookRestoreAllConfirm: '確定要還原廢紙簍中的所有生詞嗎？',
      wordbookRestoreSelected: '還原選中',
      wordbookDeletePermanentSelected: '徹底刪除',
      wordbookDeletePermanentConfirm: '確定要永久刪除選中的生詞嗎？此操作無法撤銷。',
      wordbookRestoreSingle: '還原',
      wordbookDeletePermanentSingle: '徹底刪除',
      wordbookTrashEmptyTitle: '廢紙簍為空',
      wordbookTrashEmptyDesc: '沒有已刪除的生詞',
      wordbookMovedToTrash: '已移至廢紙簍',
      wordbookRestored: '已還原',
      wordbookTabContextMenu: '右鍵搜尋',
      wordbookContextMenuDesc: '自訂在生詞本中右鍵點擊單詞時彈出的第三方詞典與搜尋引擎，支援使用 {word} 作為單詞佔位符。',
      wordbookAddSearchEngine: '添加新搜尋源',
      wordbookRestoreSearchEngines: '恢復預設搜尋源',
      wordbookEngineNamePlaceholder: '搜尋源名稱 (如: Wiki 粵語詞典)',
      wordbookEngineUrlPlaceholder: '搜尋 URL 範本 (如: https://.../{word})',
      wordbookSearchSettings: '管理搜尋源...',
      wordbookSearchPrefix: '搜尋'
    },
    'zh-CN': {
      wordbookAiSettingsTitle: 'AI 设置',
      wordbookAiSettingsDesc: '自定义词典面板底部的快捷提问按钮，点击即可快速发送预设对话指令。',
      wordbookAiTabQuickActions: '快捷指令',
      wordbookAiTabCustomPrompt: '全局 Prompt',
      wordbookAiTabInteraction: '交互设置',
      wordbookAiTabInteractionDesc: '自定义 AI 回答区域中的浮动音标、单词吸附与划词朗读等互动功能。',
      aiHoverTtsSettingTitle: 'AI 回答悬停吸附音标与划词朗读',
      aiHoverTtsSettingDesc: '光标悬停在 AI 回答的粤语单词上时吸附展示音标发音胶囊，拖选文字时弹出朗读悬浮窗。',
      wordbookEnableAiQuickActions: '显示快捷指令栏',
      wordbookAddQuickAction: '添加新指令',
      wordbookAiQuery1: '用这个词造一个粤语例句，并附上书面语翻译',
      wordbookAiQuery2: '这个词的粤语语源是什么？',
      wordbookAiQuery3: '这个词在日常粤语里怎么用？请提供例句并附上书面语翻译',
      wordbookAiQuery4: '这个词有什么近义词和反义词？',
      wordbookTitle: '我的生词本',
      wordbookSubtitle: 'My Cantonese Word Book',
      wordbookBackToSettings: '返回设定',
      wordbookWarning: '生词本数据仅保存在本机，不会上传云端。卸载插件或清除浏览数据可能导致生词丢失。建议定期',
      wordbookWarningExport: '导出备份',
      wordbookWarningEnd: '以防数据遗失。',
      wordbookTotal: '共',
      wordbookWords: '词',
      wordbookToday: '今日',
      wordbookWeek: '本周',
      wordbookSearchPlaceholder: '搜索生词…',
      wordbookSortNewest: '最新',
      wordbookSortOldest: '最早',
      wordbookSortAlpha: '字符',
      wordbookSortJyutping: '粤拼',
      wordbookExport: '导出',
      wordbookSelectAll: '全选',
      wordbookDeleteSelected: '删除选中',
      wordbookCancel: '取消',
      wordbookConfirmImport: '确认导入',
      wordbookImportTitle: '导入生词',
      wordbookEmptyTitle: '暂无生词',
      wordbookEmptyDesc: '在网页上悬停查词时，点击悬浮窗中的 ⭐ 按钮即可收藏。<br>也可以在任何模式下按 <kbd class="kbd">S</kbd> 键快速收藏当前高亮词。',
      wordbookDeleteConfirm: '确定要删除选中的 {n} 个词吗？',
      wordbookImportSuccess: '成功导入 {added} 个新词（跳过 {skipped} 个重复）',
      wordbookExported: '已导出 {format} 文件',
      wordbookDetailMode: '词典模式',
      wordbookEmptyDetail: '点击左侧单词<br>查看详细词典释义',
      wordbookModeWord: '生词',
      wordbookModeDict: '词典',
      wordbookExportJson: 'JSON (完整备份)',
      wordbookExportCsv: 'CSV (Excel 兼容)',
      wordbookExportMd: 'Markdown',
      wordbookExportTxt: '纯文本 TXT',
      wordbookExportImport: '导入...',
      wordbookSpeak: '朗读',
      aiActionCopy: '复制内容',
      aiActionCopied: '已复制',
      aiActionRegenerate: '重新生成',
      aiActionFeedback: '反馈与建议',
      aiFeedbackModalTitle: '问题与反馈',
      aiFeedbackContextLabel: '提问与 AI 回答上下文',
      aiFeedbackMessageLabel: '反馈建议与问题描述',
      aiFeedbackMessagePlaceholder: '请描述这条 AI 回答有什么问题或您的改进建议...',
      aiFeedbackTagWord: '词',
      aiFeedbackTagQuestion: '问',
      aiFeedbackTagAi: 'AI',
      aiFeedbackSending: '发送中...',
      aiFeedbackSuccess: '发送成功！感谢您的反馈',
      aiFeedbackFail: '发送失败，请稍后再试',
      aiFeedbackNetError: '发送失败，请检查网络连接',
      optRequired: '必填',
      optOptional: '选填',
      optEmailLabel: '联系邮箱',
      optEmailPlaceholder: 'your@email.com (方便回复您)',
      optSend: '发送反馈',
      titleClose: '关闭',
      dictSearchFallback: '📖 词典搜索',
      dictSearchEmpty: '未在词典中找到匹配结果',
      dictSearchNoDetail: '词典中未找到 <strong>$1</strong> 的详细释义。',
      wordbookAiChat: 'AI 问答',
      wordbookAiAction1: '造句',
      wordbookAiAction2: '语源',
      wordbookAiAction3: '日常用法',
      wordbookAiAction4: '近义反义',
      wordbookAiInputPlaceholder: '问关于“$1”的问题...',
      wordbookAiInputPlaceholderGeneric: '问任何关于粤语的问题...',
      wordbookEmptyDetail1: '点击左侧单词查看详情',
      wordbookEmptyDetail2: '或直接在下方提问',
      wordbookAiActionNamePlaceholder: '指令名称 (如: 造句)',
      wordbookAiActionPromptPlaceholder: 'AI 提示词 (如: 用这个词造句...)',
      wordbookConfirmRestorePrompt: '确定要恢复默认 Prompt 吗？这将会清除您自定义的系统提示词。',
      badgeClickToTranslate: '点击翻译此释义',
      badgeTranslating: '翻译中...',
      badgeTranslationError: '翻译失败',
      badgeClickToRestore: '点击切换回粤语原文',
      wordbookTabAll: '全部生词',
      wordbookTabTrash: '废纸篓',
      wordbookTrashBannerNotice: '已删除的生词将在废纸篓中保留 30 天，逾期将自动彻底清除。',
      wordbookEmptyTrash: '清空废纸篓',
      wordbookEmptyTrashConfirm: '确定要清空废纸篓吗？这将会永久删除所有已删除的生词，无法恢复。',
      wordbookRestoreAll: '全部还原',
      wordbookRestoreAllConfirm: '确定要还原废纸篓中的所有生词吗？',
      wordbookRestoreSelected: '还原选中',
      wordbookDeletePermanentSelected: '彻底删除',
      wordbookDeletePermanentConfirm: '确定要永久删除选中的生词吗？此操作无法撤销。',
      wordbookRestoreSingle: '还原',
      wordbookDeletePermanentSingle: '彻底删除',
      wordbookTrashEmptyTitle: '废纸篓为空',
      wordbookTrashEmptyDesc: '没有已删除的生词',
      wordbookMovedToTrash: '已移至废纸篓',
      wordbookRestored: '已还原',
      wordbookTabContextMenu: '右键搜索',
      wordbookContextMenuDesc: '自定义在生词本中右键点击单词时弹出的第三方词典与搜索引擎，支持使用 {word} 作为单词占位符。',
      wordbookAddSearchEngine: '添加新搜索源',
      wordbookRestoreSearchEngines: '恢复默认搜索源',
      wordbookEngineNamePlaceholder: '搜索源名称 (如: Wiki 粤语词典)',
      wordbookEngineUrlPlaceholder: '搜索 URL 模板 (如: https://.../{word})',
      wordbookSearchSettings: '管理搜索源...',
      wordbookSearchPrefix: '搜索'
    },
    'en': {
      wordbookAiSettingsTitle: 'AI Settings',
      wordbookAiSettingsDesc: 'Customize the shortcut buttons below the dictionary panel to quickly send predefined prompts to AI.',
      wordbookAiTabQuickActions: 'Quick Actions',
      wordbookAiTabCustomPrompt: 'Global Prompt',
      wordbookAiTabInteraction: 'Interaction',
      wordbookAiTabInteractionDesc: 'Customize floating phonetic pills, word snapping, and selection reading in AI responses.',
      aiHoverTtsSettingTitle: 'AI Hover Phonetic Pill & Selection Reading',
      aiHoverTtsSettingDesc: 'Show floating phonetic pill on word hover, and show reading button on text selection in AI responses.',
      wordbookEnableAiQuickActions: 'Show Quick Actions Bar',
      wordbookAddQuickAction: 'Add Action',
      wordbookAiQuery1: 'Make a Cantonese example sentence using this word, and provide an English translation.',
      wordbookAiQuery2: 'What is the etymology of this word?',
      wordbookAiQuery3: 'How is this word used in daily Cantonese? Provide examples with English translations.',
      wordbookAiQuery4: 'What are the synonyms and antonyms of this word?',
      wordbookTitle: 'My Word Book',
      wordbookSubtitle: 'Cantonese Vocabulary',
      wordbookBackToSettings: 'Back to Settings',
      wordbookWarning: 'Word Book data is stored locally only, not synced to cloud. Uninstalling the extension or clearing browser data may delete your words. Please',
      wordbookWarningExport: 'export a backup',
      wordbookWarningEnd: 'regularly to prevent data loss.',
      wordbookTotal: 'Total',
      wordbookWords: 'words',
      wordbookToday: 'Today',
      wordbookWeek: 'This week',
      wordbookSearchPlaceholder: 'Search words…',
      wordbookSortNewest: 'Newest',
      wordbookSortOldest: 'Oldest',
      wordbookSortAlpha: 'Character',
      wordbookSortJyutping: 'Jyutping',
      wordbookExport: 'Export',
      wordbookSelectAll: 'Select All',
      wordbookDeleteSelected: 'Delete selected',
      wordbookCancel: 'Cancel',
      wordbookConfirmImport: 'Confirm Import',
      wordbookImportTitle: 'Import Words',
      wordbookEmptyTitle: 'No words saved',
      wordbookEmptyDesc: 'Hover over Chinese text on any page and click the ⭐ button to save.<br>You can also press <kbd class="kbd">S</kbd> to quickly save the highlighted word in any mode.',
      wordbookDeleteConfirm: 'Delete {n} selected words?',
      wordbookImportSuccess: 'Imported {added} new words (skipped {skipped} duplicates)',
      wordbookExported: 'Exported {format} file',
      wordbookDetailMode: 'Dictionary Mode',
      wordbookEmptyDetail: 'Click a word on the left<br>to view dictionary details',
      wordbookModeWord: 'Words',
      wordbookModeDict: 'Dict',
      wordbookExportJson: 'JSON (Full Backup)',
      wordbookExportCsv: 'CSV (Excel Compatible)',
      wordbookExportMd: 'Markdown',
      wordbookExportTxt: 'Plain Text',
      wordbookExportImport: 'Import...',
      wordbookSpeak: 'Read',
      aiActionCopy: 'Copy',
      aiActionCopied: 'Copied',
      aiActionRegenerate: 'Regenerate',
      aiActionFeedback: 'Feedback & Report',
      aiFeedbackModalTitle: 'Feedback & Issues',
      aiFeedbackContextLabel: 'Question & AI Response Context',
      aiFeedbackMessageLabel: 'Feedback & Issue Description',
      aiFeedbackMessagePlaceholder: 'Please describe what was wrong with this AI answer or suggestions for improvement...',
      aiFeedbackTagWord: 'Word',
      aiFeedbackTagQuestion: 'Ask',
      aiFeedbackTagAi: 'AI',
      aiFeedbackSending: 'Sending...',
      aiFeedbackSuccess: 'Sent successfully! Thank you for your feedback',
      aiFeedbackFail: 'Failed to send, please try again later',
      aiFeedbackNetError: 'Failed to send, please check network connection',
      optRequired: 'Required',
      optOptional: 'Optional',
      optEmailLabel: 'Contact Email',
      optEmailPlaceholder: 'your@email.com (so we can reply)',
      optSend: 'Send Feedback',
      titleClose: 'Close',
      dictSearchFallback: '📖 Dictionary Search',
      dictSearchEmpty: 'No matching results found in dictionary',
      dictSearchNoDetail: 'Detailed definition for <strong>$1</strong> not found in dictionary.',
      wordbookAiChat: 'Ask AI',
      wordbookAiAction1: 'Sentence',
      wordbookAiAction2: 'Etymology',
      wordbookAiAction3: 'Daily Usage',
      wordbookAiAction4: 'Synonyms/Antonyms',
      wordbookAiInputPlaceholder: 'Ask a question about \'$1\'...',
      wordbookAiInputPlaceholderGeneric: 'Ask any question about Cantonese...',
      wordbookEmptyDetail1: 'Click left word for details',
      wordbookEmptyDetail2: 'Or ask directly below',
      wordbookAiActionNamePlaceholder: 'Action Name (e.g. Sentence)',
      wordbookAiActionPromptPlaceholder: 'AI Prompt (e.g. Make a sentence with...)',
      wordbookConfirmRestorePrompt: 'Are you sure you want to restore the default Prompt? This will clear your custom system prompt.',
      badgeClickToTranslate: 'Click to translate definition',
      badgeTranslating: 'Translating...',
      badgeTranslationError: 'Translation failed',
      badgeClickToRestore: 'Click to switch back to Cantonese',
      wordbookTabAll: 'All Words',
      wordbookTabTrash: 'Trash',
      wordbookTrashBannerNotice: 'Deleted words will be kept in the Trash for 30 days before being permanently removed.',
      wordbookEmptyTrash: 'Empty Trash',
      wordbookEmptyTrashConfirm: 'Are you sure you want to empty the Trash? All deleted words will be permanently removed and cannot be recovered.',
      wordbookRestoreAll: 'Restore All',
      wordbookRestoreAllConfirm: 'Are you sure you want to restore all words from Trash?',
      wordbookRestoreSelected: 'Restore Selected',
      wordbookDeletePermanentSelected: 'Delete Permanently',
      wordbookDeletePermanentConfirm: 'Are you sure you want to permanently delete the selected word(s)? This action cannot be undone.',
      wordbookRestoreSingle: 'Restore',
      wordbookDeletePermanentSingle: 'Delete',
      wordbookTrashEmptyTitle: 'Trash is Empty',
      wordbookTrashEmptyDesc: 'No deleted words found',
      wordbookMovedToTrash: 'Moved to Trash',
      wordbookRestored: 'Restored',
      wordbookTabContextMenu: 'Right-click Search',
      wordbookContextMenuDesc: 'Customize third-party dictionaries and search engines for right-clicking words in the word book. Use {word} as placeholder.',
      wordbookAddSearchEngine: 'Add New Search Engine',
      wordbookRestoreSearchEngines: 'Restore Default Engines',
      wordbookEngineNamePlaceholder: 'Engine Name (e.g. Wiki Cantonese)',
      wordbookEngineUrlPlaceholder: 'Search URL Template (e.g. https://.../{word})',
      wordbookSearchSettings: 'Manage Search Engines...',
      wordbookSearchPrefix: 'Search'
    },
    'ja': {
      wordbookAiSettingsTitle: 'AI 設定',
      wordbookAiSettingsDesc: '辞書パネルの下にあるショートカットボタンをカスタマイズして、定義済みのプロンプトをAIにすばやく送信します。',
      wordbookAiTabQuickActions: 'クイックアクション',
      wordbookAiTabCustomPrompt: 'グローバルプロンプト',
      wordbookAiTabInteraction: '対話設定',
      wordbookAiTabInteractionDesc: 'AI 回答領域における発音記号の浮動表示、単語スナップ、選択読み上げなどをカスタマイズします。',
      aiHoverTtsSettingTitle: 'AI 回答ホバー発音記号＆選択読み上げ',
      aiHoverTtsSettingDesc: 'AI 回答の広東語単語にホバーすると発音記号を表示し、テキスト選択時に読み上げボタンを表示します。',
      wordbookEnableAiQuickActions: 'クイックアクションバーを表示',
      wordbookAddQuickAction: 'アクションを追加',
      wordbookAiQuery1: 'この言葉を使って広東語の例文を作り、日本語の翻訳を付けてください',
      wordbookAiQuery2: 'この言葉の語源は何ですか？',
      wordbookAiQuery3: 'この言葉は日常広東語でどのように使われますか？例文と日本語の翻訳を付けてください',
      wordbookAiQuery4: 'この言葉の類義語と対義語は何ですか？',
      wordbookTitle: '単語帳',
      wordbookSubtitle: '広東語ボキャブラリー',
      wordbookBackToSettings: '設定に戻る',
      wordbookWarning: '単語帳データはローカルにのみ保存され、クラウドには同期されません。拡張機能のアンインストールやブラウザデータの消去により、データが失われる可能性があります。定期的に',
      wordbookWarningExport: 'バックアップをエクスポート',
      wordbookWarningEnd: 'することをお勧めします。',
      wordbookTotal: '合計',
      wordbookWords: '語',
      wordbookToday: '今日',
      wordbookWeek: '今週',
      wordbookSearchPlaceholder: '検索…',
      wordbookSortNewest: '最新',
      wordbookSortOldest: '最古',
      wordbookSortAlpha: '文字',
      wordbookSortJyutping: '粤拼',
      wordbookExport: 'エクスポート',
      wordbookSelectAll: '全選択',
      wordbookDeleteSelected: '選択を削除',
      wordbookCancel: 'キャンセル',
      wordbookConfirmImport: 'インポート確認',
      wordbookImportTitle: '単語のインポート',
      wordbookEmptyTitle: '単語がありません',
      wordbookEmptyDesc: 'ウェブページで漢字にホバーし、⭐ ボタンをクリックして保存できます。<br>任意のモードで <kbd class="kbd">S</kbd> キーを押すと素早く保存できます。',
      wordbookDeleteConfirm: '選択した {n} 個の単語を削除しますか？',
      wordbookImportSuccess: '{added} 個の新しい単語をインポートしました（{skipped} 個の重複をスキップ）',
      wordbookExported: '{format} ファイルをエクスポートしました',
      wordbookDetailMode: '辞書モード',
      wordbookEmptyDetail: '左側の単語をクリックして<br>辞書の詳細を表示します',
      wordbookModeWord: '単語',
      wordbookModeDict: '辞書',
      wordbookExportJson: 'JSON (完全バックアップ)',
      wordbookExportCsv: 'CSV (Excel 互換)',
      wordbookExportMd: 'Markdown',
      wordbookExportTxt: 'プレーンテキスト',
      wordbookExportImport: 'インポート...',
      wordbookSpeak: '読み上げ',
      aiActionCopy: 'コピー',
      aiActionCopied: 'コピーしました',
      aiActionRegenerate: '再生成',
      aiActionFeedback: 'フィードバック',
      aiFeedbackModalTitle: 'フィードバック',
      aiFeedbackContextLabel: '質問と AI 回答のコンテキスト',
      aiFeedbackMessageLabel: 'フィードバックと問題の説明',
      aiFeedbackMessagePlaceholder: 'この AI 回答の問題点や改善提案を記入してください...',
      aiFeedbackTagWord: '単語',
      aiFeedbackTagQuestion: '質問',
      aiFeedbackTagAi: 'AI',
      aiFeedbackSending: '送信中...',
      aiFeedbackSuccess: '送信しました！ご意見ありがとうございます',
      aiFeedbackFail: '送信に失敗しました。後でもう一度お試しください',
      aiFeedbackNetError: '送信に失敗しました。ネットワーク接続を確認してください',
      optRequired: '必須',
      optOptional: '任意',
      optEmailLabel: '連絡先メール',
      optEmailPlaceholder: 'your@email.com（返信用）',
      optSend: '送信',
      titleClose: '閉じる',
      dictSearchFallback: '📖 辞書検索',
      dictSearchEmpty: '辞書に一致する結果が見つかりませんでした',
      dictSearchNoDetail: '辞書に <strong>$1</strong> の詳細な定義が見つかりません。',
      wordbookAiChat: 'AI アシスタント',
      wordbookAiAction1: '例文',
      wordbookAiAction2: '語源',
      wordbookAiAction3: '日常の用法',
      wordbookAiAction4: '類義/対義',
      wordbookAiInputPlaceholder: '「$1」について質問する...',
      wordbookAiInputPlaceholderGeneric: '広東語について質問する...',
      wordbookEmptyDetail1: '左の単語をクリックして詳細を表示',
      wordbookEmptyDetail2: 'または直接下で質問する',
      wordbookAiActionNamePlaceholder: 'アクション名 (例: 例文)',
      wordbookAiActionPromptPlaceholder: 'AI プロンプト (例: この言葉を使って...)',
      wordbookConfirmRestorePrompt: 'デフォルトの Prompt に戻してもよろしいですか？カスタムシステムプロンプトは消去されます。',
      badgeClickToTranslate: 'クリックしてこの解説を翻訳',
      badgeTranslating: '翻訳中...',
      badgeTranslationError: '翻訳失敗',
      badgeClickToRestore: 'クリックして広東語の原文に戻す',
      wordbookTabAll: 'すべての単語',
      wordbookTabTrash: 'ゴミ箱',
      wordbookTrashBannerNotice: '削除された単語は30日間ゴミ箱に保持された後、自動的に完全に削除されます。',
      wordbookEmptyTrash: 'ゴミ箱を空にする',
      wordbookEmptyTrashConfirm: 'ゴミ箱を空にしてもよろしいですか？削除されたすべての単語が完全に削除され、復元できなくなります。',
      wordbookRestoreAll: 'すべて復元',
      wordbookRestoreAllConfirm: 'ゴミ箱内のすべての単語を復元してもよろしいですか？',
      wordbookRestoreSelected: '選択項目を復元',
      wordbookDeletePermanentSelected: '完全に削除',
      wordbookDeletePermanentConfirm: '選択した単語を完全に削除してもよろしいですか？この操作は元に戻せません。',
      wordbookRestoreSingle: '復元',
      wordbookDeletePermanentSingle: '完全削除',
      wordbookTrashEmptyTitle: 'ゴミ箱は空です',
      wordbookTrashEmptyDesc: '削除された単語はありません',
      wordbookMovedToTrash: 'ゴミ箱に移動しました',
      wordbookRestored: '復元しました',
      wordbookTabContextMenu: '右クリック検索',
      wordbookContextMenuDesc: '単語を右クリックしたときにポップアップする外部辞書や検索エンジンをカスタマイズします。{word} プレースホルダーに対応。',
      wordbookAddSearchEngine: '新しい検索エンジンを追加',
      wordbookRestoreSearchEngines: 'デフォルトに戻す',
      wordbookEngineNamePlaceholder: 'エンジン名 (例: Wiki 広東語辞書)',
      wordbookEngineUrlPlaceholder: '検索 URL テンプレート (例: https://.../{word})',
      wordbookSearchSettings: '検索エンジンを管理...',
      wordbookSearchPrefix: '検索'
    },
    'ko': {
      wordbookAiSettingsTitle: 'AI 설정',
      wordbookAiSettingsDesc: '사전 패널 아래의 단축 버튼을 사용자 정의하여 AI에 미리 정의된 프롬프트를 빠르게 보냅니다.',
      wordbookAiTabQuickActions: '빠른 작업',
      wordbookAiTabCustomPrompt: '글로벌 프롬프트',
      wordbookAiTabInteraction: '인터랙션 설정',
      wordbookAiTabInteractionDesc: 'AI 답변 영역의 발음 기호 팝업, 단어 스냅 및 선택 낭독 등의 상호작용 기능을 설정합니다。',
      aiHoverTtsSettingTitle: 'AI 답변 호버 발음 기호 및 선택 낭독',
      aiHoverTtsSettingDesc: 'AI 답변의 광둥어 단어에 마우스를 올리면 발음 기호를 표시하고, 텍스트 선택 시 낭독 버튼을 표시합니다。',
      wordbookEnableAiQuickActions: '빠른 작업 표시줄 표시',
      wordbookAddQuickAction: '작업 추가',
      wordbookAiQuery1: '이 단어를 사용하여 광둥어 예문을 만들고 한국어 번역을 제공해 주세요',
      wordbookAiQuery2: '이 단어의 어원은 무엇인가요?',
      wordbookAiQuery3: '이 단어는 일상 광둥어에서 어떻게 사용되나요? 예문과 한국어 번역을 제공해 주세요',
      wordbookAiQuery4: '이 단어의 유의어와 반의어는 무엇인가요?',
      wordbookTitle: '단어장',
      wordbookSubtitle: '광둥어 어휘',
      wordbookBackToSettings: '설정으로 돌아가기',
      wordbookWarning: '단어장 데이터는 로컬에만 저장되며 클라우드에 동기화되지 않습니다. 확장 프로그램 제거 또는 브라우저 데이터 삭제 시 데이터가 손실될 수 있습니다. 정기적으로',
      wordbookWarningExport: '백업 내보내기',
      wordbookWarningEnd: '를 권장합니다.',
      wordbookTotal: '총',
      wordbookWords: '단어',
      wordbookToday: '오늘',
      wordbookWeek: '이번 주',
      wordbookSearchPlaceholder: '검색…',
      wordbookSortNewest: '최신',
      wordbookSortOldest: '오래된 순',
      wordbookSortAlpha: '문자',
      wordbookSortJyutping: '월병',
      wordbookExport: '내보내기',
      wordbookSelectAll: '전체 선택',
      wordbookDeleteSelected: '선택 삭제',
      wordbookCancel: '취소',
      wordbookConfirmImport: '가져오기 확인',
      wordbookImportTitle: '단어 가져오기',
      wordbookEmptyTitle: '저장된 단어 없음',
      wordbookEmptyDesc: '웹페이지에서 한자에 마우스를 올리고 ⭐ 버튼을 클릭하여 저장하세요.<br>어떤 모드에서든 <kbd class="kbd">S</kbd> 키를 눌러 선택한 단어를 빠르게 저장할 수도 있습니다.',
      wordbookDeleteConfirm: '선택한 {n}개의 단어를 삭제하시겠습니까?',
      wordbookImportSuccess: '{added}개의 새 단어 가져오기 완료 ({skipped}개의 중복 항목 건너뜀)',
      wordbookExported: '{format} 파일이 내보내졌습니다',
      wordbookDetailMode: '사전 모드',
      wordbookEmptyDetail: '왼쪽 단어를 클릭하여<br>사전 세부 정보를 봅니다',
      wordbookModeWord: '단어',
      wordbookModeDict: '사전',
      wordbookExportJson: 'JSON (전체 백업)',
      wordbookExportCsv: 'CSV (Excel 호환)',
      wordbookExportMd: 'Markdown',
      wordbookExportTxt: '일반 텍스트',
      wordbookExportImport: '가져오기...',
      wordbookSpeak: '낭독',
      aiActionCopy: '복사',
      aiActionCopied: '복사됨',
      aiActionRegenerate: '다시 생성',
      aiFeedbackModalTitle: '피드백 및 문의',
      aiFeedbackContextLabel: '질문 및 AI 답변 컨텍스트',
      aiFeedbackMessageLabel: '피드백 및 문제 설명',
      aiFeedbackMessagePlaceholder: '이 AI 답변의 문제점이나 개선 제안을 적어주세요...',
      aiFeedbackTagWord: '단어',
      aiFeedbackTagQuestion: '질문',
      aiFeedbackTagAi: 'AI',
      aiFeedbackSending: '전송 중...',
      aiFeedbackSuccess: '전송 완료! 의견 감사합니다',
      aiFeedbackFail: '전송 실패, 나중에 다시 시도해 주세요',
      aiFeedbackNetError: '전송 실패, 네트워크 연결을 확인해 주세요',
      optRequired: '필수',
      optOptional: '선택',
      optEmailLabel: '연락처 이메일',
      optEmailPlaceholder: 'your@email.com (답변용)',
      optSend: '피드백 보내기',
      titleClose: '닫기',
      dictSearchFallback: '📖 사전 검색',
      dictSearchEmpty: '사전에서 일치하는 결과를 찾을 수 없습니다',
      dictSearchNoDetail: '사전에서 <strong>$1</strong>의 자세한 정의를 찾을 수 없습니다.',
      wordbookAiChat: 'AI 도우미',
      wordbookAiAction1: '문장',
      wordbookAiAction2: '어원',
      wordbookAiAction3: '일상 용법',
      wordbookAiAction4: '유의/반의',
      wordbookAiInputPlaceholder: "'$1'에 대해 질문하기...",
      wordbookAiInputPlaceholderGeneric: '광둥어에 대해 무엇이든 물어보세요...',
      wordbookEmptyDetail1: '세부 정보를 보려면 왼쪽 단어를 클릭하세요',
      wordbookEmptyDetail2: '또는 아래에 직접 질문하세요',
      wordbookAiActionNamePlaceholder: '작업 이름 (예: 예문)',
      wordbookAiActionPromptPlaceholder: 'AI 프롬프트 (예: 이 단어를 사용하여...)',
      wordbookConfirmRestorePrompt: '기본 Prompt로 복원하시겠습니까? 사용자 지정 시스템 프롬프트가 삭제됩니다.',
      badgeClickToTranslate: '클릭하여 이 설명 번역',
      badgeTranslating: '번역 중...',
      badgeTranslationError: '번역 실패',
      badgeClickToRestore: '클릭하여 광둥어 원문으로 전환',
      wordbookTabAll: '모든 단어',
      wordbookTabTrash: '휴지통',
      wordbookTrashBannerNotice: '삭제된 단어는 30일 동안 휴지통에 보관된 후 자동으로 영구 삭제됩니다.',
      wordbookEmptyTrash: '휴지통 비우기',
      wordbookEmptyTrashConfirm: '휴지통을 비우시겠습니까? 삭제된 모든 단어가 영구적으로 삭제되며 복구할 수 없습니다.',
      wordbookRestoreAll: '모두 복원',
      wordbookRestoreAllConfirm: '휴지통의 모든 단어를 복원하시겠습니까?',
      wordbookRestoreSelected: '선택 항목 복원',
      wordbookDeletePermanentSelected: '영구 삭제',
      wordbookDeletePermanentConfirm: '선택한 단어를 영구 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.',
      wordbookRestoreSingle: '복원',
      wordbookDeletePermanentSingle: '영구 삭제',
      wordbookTrashEmptyTitle: '휴지통이 비어 있습니다',
      wordbookTrashEmptyDesc: '삭제된 단어가 없습니다',
      wordbookMovedToTrash: '휴지통으로 이동되었습니다',
      wordbookRestored: '복원되었습니다',
      wordbookTabContextMenu: '우클릭 검색',
      wordbookContextMenuDesc: '단어를 우클릭할 때 팝업되는 외부 사전 및 검색 엔진을 설정합니다. {word} 플레이스홀더 지원.',
      wordbookAddSearchEngine: '새 검색 엔진 추가',
      wordbookRestoreSearchEngines: '기본값 복원',
      wordbookEngineNamePlaceholder: '엔진 이름 (예: 위키 광둥어 사전)',
      wordbookEngineUrlPlaceholder: '검색 URL 템플릿 (예: https://.../{word})',
      wordbookSearchSettings: '검색 엔진 관리...',
      wordbookSearchPrefix: '검색'
    }
  };

  let currentLang = 'zh-HK';

  const DEFAULT_AI_SYSTEM_PROMPT = '你是一個粵語語言專家。請用{targetLang}回答用戶關於選中字詞或句子的疑問，解答要簡明扼要、準確可靠。';

  const AI_PROMPT_PRESETS = {
    expert: '你是一個粵語語言專家。請用{targetLang}回答用戶關於選中字詞或句子的疑問，解答要簡明扼要、準確可靠。',
    examples: '你是一個熱情耐心的粵語老師。請用{targetLang}深入解答，並針對日常口語生活場景提供 2-3 個道地的粵語對話例句和繁體字解釋。',
    etymology: '你是一個語言學家。請從粵語語法結構、九聲六調、中古漢語詞源演變等學術維度進行深入剖析，並用{targetLang}清晰解答。',
    concise: '請以極簡扼要的方式回答，直接給出最核心的粵語發音、用法要點，不要冗長客套。'
  };

  let globalEnableAiQuickActions = true;
  let globalAiCustomSystemPrompt = '';
  let globalAiQuickActions = [
    { id: 'default1', isDefault: true, labelKey: 'wordbookAiAction1', promptKey: 'wordbookAiQuery1', active: true },
    { id: 'default2', isDefault: true, labelKey: 'wordbookAiAction2', promptKey: 'wordbookAiQuery2', active: true },
    { id: 'default3', isDefault: true, labelKey: 'wordbookAiAction3', promptKey: 'wordbookAiQuery3', active: true },
    { id: 'default4', isDefault: true, labelKey: 'wordbookAiAction4', promptKey: 'wordbookAiQuery4', active: true }
  ];

  const DEFAULT_CONTEXT_MENU_ENGINES = [
    { id: 'wiki', name: 'Wiki 粵語詞典', url: 'https://zh.wiktionary.org/wiki/{word}', active: true, icon: 'wiki' },
    { id: 'wordshk', name: 'Words.hk 粵典', url: 'https://words.hk/zidian/v2/search?q={word}', active: true, icon: 'book' },
    { id: 'sheik', name: '羊羊粵語詞典', url: 'https://shyyp.net/search?q={word}', active: true, icon: 'sheep' },
    { id: 'twitter', name: 'X (Twitter) 搜尋', url: 'https://x.com/search?q="{word}"', active: true, icon: 'x' },
    { id: 'google', name: 'Google 粵語搜尋', url: 'https://www.google.com/search?q={word}+粵語', active: false, icon: 'globe' }
  ];

  let globalContextMenuEngines = JSON.parse(JSON.stringify(DEFAULT_CONTEXT_MENU_ENGINES));

  chrome.storage.local.get(['enableAiQuickActions', 'aiQuickActions', 'aiCustomSystemPrompt', 'customContextMenuEngines'], (result) => {
    if (result.enableAiQuickActions !== undefined) {
      globalEnableAiQuickActions = result.enableAiQuickActions;
    }
    if (result.aiQuickActions) {
      globalAiQuickActions = result.aiQuickActions;
    }
    if (result.customContextMenuEngines && Array.isArray(result.customContextMenuEngines) && result.customContextMenuEngines.length > 0) {
      globalContextMenuEngines = result.customContextMenuEngines.map(e => {
        if (e.id === 'twitter' && e.url === 'https://x.com/search?q={word}') {
          return { ...e, url: 'https://x.com/search?q="{word}"' };
        }
        return e;
      });
      chrome.storage.local.set({ customContextMenuEngines: globalContextMenuEngines });
    }
    if (result.aiCustomSystemPrompt !== undefined) {
      let promptVal = result.aiCustomSystemPrompt || '';
      if (promptVal.includes('"answer"') || promptVal.includes('JSON 格式') || promptVal.includes('"terms"')) {
        promptVal = '';
        chrome.storage.local.set({ aiCustomSystemPrompt: '' });
      }
      globalAiCustomSystemPrompt = promptVal;
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enableAiQuickActions) {
      globalEnableAiQuickActions = changes.enableAiQuickActions.newValue;
    }
    if (changes.aiQuickActions) {
      globalAiQuickActions = changes.aiQuickActions.newValue;
    }
    if (changes.customContextMenuEngines) {
      globalContextMenuEngines = changes.customContextMenuEngines.newValue || DEFAULT_CONTEXT_MENU_ENGINES;
    }
    if (changes.aiCustomSystemPrompt) {
      let newPromptVal = changes.aiCustomSystemPrompt.newValue || '';
      if (newPromptVal.includes('"answer"') || newPromptVal.includes('JSON 格式') || newPromptVal.includes('"terms"')) {
        newPromptVal = '';
      }
      globalAiCustomSystemPrompt = newPromptVal;
    }
  });

  function t(key) {
    const localString = (i18nStrings[currentLang] || i18nStrings['zh-HK'])[key];
    if (localString) return localString;
    return chrome.i18n.getMessage(key) || key;
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val) el.innerHTML = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      if (el.id === 'searchInput') return; // Managed dynamically based on searchMode
      const key = el.getAttribute('data-i18n-placeholder');
      const val = t(key);
      if (val) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const val = t(key);
      if (val) el.title = val;
    });
    // Sort select options
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.querySelectorAll('option').forEach(opt => {
        const key = opt.getAttribute('data-i18n');
        if (key) opt.textContent = t(key);
      });
    }
    if (typeof updateSearchModeUI === 'function') {
      updateSearchModeUI();
    }
  }

  // ==================== State ====================

  let wordbook = [];
  let filteredWords = [];
  let selectedIds = new Set();
  let currentSort = 'newest';
  let searchQuery = '';
  let currentView = 'all'; // 'all' | 'trash'

  // ==================== DOM References ====================

  const wordListEl = document.getElementById('wordList');
  const searchInput = document.getElementById('searchInput');

  const trashToggleBtn = document.getElementById('trashToggleBtn');
  const btnBackToAll = document.getElementById('btnBackToAll');
  const badgeTrash = document.getElementById('badgeTrash');
  const trashBanner = document.getElementById('trashBanner');
  const restoreAllBtn = document.getElementById('restoreAllBtn');
  const emptyTrashBtn = document.getElementById('emptyTrashBtn');

  const exportBtn = document.getElementById('exportBtn');
  const exportMenu = document.getElementById('exportMenu');
  const importBtn = document.getElementById('importBtn');
  const importModal = document.getElementById('importModal');
  const importCancelBtn = document.getElementById('importCancelBtn');
  const importConfirmBtn = document.getElementById('importConfirmBtn');
  const importFileInput = document.getElementById('importFileInput');
  const importPreview = document.getElementById('importPreview');
  const dropZone = document.getElementById('dropZone');
  const chooseFileLink = document.getElementById('chooseFileLink');
  const selectAllCheckbox = document.getElementById('selectAll');
  const selectAllLabel = document.getElementById('selectAllLabel');
  const bulkActions = document.getElementById('bulkActions');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const bulkBtnsAll = document.getElementById('bulkBtnsAll');
  const bulkBtnsTrash = document.getElementById('bulkBtnsTrash');
  const bulkRestoreBtn = document.getElementById('bulkRestoreBtn');
  const bulkDeletePermanentBtn = document.getElementById('bulkDeletePermanentBtn');
  const selectedCountEl = document.getElementById('selectedCount');
  const selectedCountTrash = document.getElementById('selectedCountTrash');
  const themeToggle = document.getElementById('themeToggle');
  const warningExportBtn = document.getElementById('warningExportBtn');

  // ==================== Theme ====================

  let enableAutoTranslateYueDefs = false;
  let autoTranslateYueDefsTargetLang = 'zh-Hans';
  let autoTranslateYueDefsEngine = 'google';
  let yueDefDisplayMode = 'expand'; // 'expand' or 'replace'
  const yueDefTranslationCache = new Map();

  function initTranslationSettings() {
    chrome.storage.sync.get(['enableAutoTranslateYueDefs', 'autoTranslateYueDefsTargetLang', 'autoTranslateYueDefsEngine', 'yueDefDisplayMode'], (res) => {
      enableAutoTranslateYueDefs = res.enableAutoTranslateYueDefs === true;
      autoTranslateYueDefsTargetLang = res.autoTranslateYueDefsTargetLang || 'zh-Hans';
      autoTranslateYueDefsEngine = res.autoTranslateYueDefsEngine || 'google';
      yueDefDisplayMode = res.yueDefDisplayMode || 'expand';
    });
  }
  initTranslationSettings();

  function initTheme() {
    chrome.storage.sync.get(['uiTheme'], (res) => {
      const theme = res.uiTheme || 'auto';
      localStorage.setItem('jyutping_ui_theme', theme);
      const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        if (changes.uiTheme) {
          const theme = changes.uiTheme.newValue || 'auto';
          const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
          } else {
            document.documentElement.removeAttribute('data-theme');
          }
        }
        if (changes.enableAutoTranslateYueDefs) {
          enableAutoTranslateYueDefs = changes.enableAutoTranslateYueDefs.newValue === true;
        }
        if (changes.autoTranslateYueDefsTargetLang) {
          autoTranslateYueDefsTargetLang = changes.autoTranslateYueDefsTargetLang.newValue;
        }
        if (changes.autoTranslateYueDefsEngine) {
          autoTranslateYueDefsEngine = changes.autoTranslateYueDefsEngine.newValue;
        }
        if (changes.yueDefDisplayMode) {
          yueDefDisplayMode = changes.yueDefDisplayMode.newValue || 'expand';
        }
      }
    });
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    chrome.storage.sync.set({ uiTheme: newTheme });
    localStorage.setItem('jyutping_ui_theme', newTheme);
  });

  // ==================== Rendering ====================

  function matchWord(w, rawQ, qNoTones, qCompact, tokens) {
    if (!rawQ) return true;

    const char = (w.character || '').toLowerCase();
    const simp = (w.simplified || '').toLowerCase();
    const jp = (w.jyutping || '').toLowerCase();
    const yale = (w.yale || '').toLowerCase();
    const py = (w.pinyin || '').toLowerCase();
    const eng = (Array.isArray(w.english) ? w.english.join(' ') : (w.english || '')).toLowerCase();
    const exp = (w.explanation || '').toLowerCase();
    const notes = (w.notes || '').toLowerCase();

    // 1. Direct substring match (exact characters, exact jyutping with tones, English, notes)
    if (char.includes(rawQ) || simp.includes(rawQ) || jp.includes(rawQ) ||
        yale.includes(rawQ) || py.includes(rawQ) || eng.includes(rawQ) ||
        exp.includes(rawQ) || notes.includes(rawQ)) {
      return true;
    }

    // 2. Toneless phonetic match (e.g. "hoeng gong" matches "hoeng1 gong2")
    const jpNoTones = jp.replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();
    const yaleNoTones = yale.replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();
    const pyNoTones = py.replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();

    if (qNoTones && (jpNoTones.includes(qNoTones) || yaleNoTones.includes(qNoTones) || pyNoTones.includes(qNoTones))) {
      return true;
    }

    // 3. Compact toneless match (e.g. "hoenggong" matches "hoeng1 gong2")
    if (qCompact) {
      const jpCompact = jp.replace(/[\s\d]/g, '');
      const yaleCompact = yale.replace(/[\s\d]/g, '');
      const pyCompact = py.replace(/[\s\d]/g, '');

      if (jpCompact.includes(qCompact) || yaleCompact.includes(qCompact) || pyCompact.includes(qCompact)) {
        return true;
      }
    }

    // 4. Multi-token match (all whitespace-separated terms must match somewhere in the word's fields)
    if (tokens.length > 1) {
      const allTokensMatch = tokens.every(token => {
        const tokenNoTone = token.replace(/[0-9]/g, '');
        return char.includes(token) || simp.includes(token) ||
               jp.includes(token) || jpNoTones.includes(tokenNoTone) ||
               yale.includes(token) || yaleNoTones.includes(tokenNoTone) ||
               py.includes(token) || pyNoTones.includes(tokenNoTone) ||
               eng.includes(token) || exp.includes(token) || notes.includes(token);
      });
      if (allTokensMatch) return true;
    }

    return false;
  }

  function filterAndSort() {
    const rawQ = searchQuery.trim().toLowerCase();
    const qNoTones = rawQ.replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();
    const qCompact = rawQ.replace(/[\s\d]/g, '');
    const tokens = rawQ.split(/\s+/).filter(Boolean);

    const sourceWords = wordbook.filter(w => currentView === 'trash' ? !!w.deletedAt : !w.deletedAt);
    filteredWords = sourceWords.filter(w => matchWord(w, rawQ, qNoTones, qCompact, tokens));

    switch (currentSort) {
      case 'oldest':
        filteredWords.sort((a, b) => a.timestamp - b.timestamp);
        break;
      case 'alpha':
        filteredWords.sort((a, b) => (a.character || '').localeCompare(b.character || '', 'zh'));
        break;
      case 'jyutping':
        filteredWords.sort((a, b) => (a.jyutping || '').localeCompare(b.jyutping || ''));
        break;
      default: // newest
        if (currentView === 'trash') {
          filteredWords.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
        } else {
          filteredWords.sort((a, b) => b.timestamp - a.timestamp);
        }
    }
  }

  function renderList() {
    filterAndSort();

    const isTrash = currentView === 'trash';
    const sourceTotal = wordbook.filter(w => isTrash ? !!w.deletedAt : !w.deletedAt).length;

    if (filteredWords.length === 0) {
      if (sourceTotal === 0) {
        if (isTrash) {
          wordListEl.innerHTML = `
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 6h16l-1.5 14a2 2 0 0 1-2 2H7.5a2 2 0 0 1-2-2L4 6z"></path>
                <line x1="9" y1="10" x2="9" y2="17"></line>
                <line x1="12" y1="10" x2="12" y2="17"></line>
                <line x1="15" y1="10" x2="15" y2="17"></line>
              </svg>
              <h3>${t('wordbookTrashEmptyTitle') || '廢紙簍為空'}</h3>
              <p>${t('wordbookTrashEmptyDesc') || '沒有已刪除的生詞'}</p>
              <div>
                <button class="empty-state-action-btn" id="btnBackToAllEmpty">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                  <span>${t('wordbookTabAll') || '返回全部生詞'}</span>
                </button>
              </div>
            </div>
          `;
          const btnBackEmpty = document.getElementById('btnBackToAllEmpty');
          if (btnBackEmpty) btnBackEmpty.addEventListener('click', () => switchView('all'));
        } else {
          wordListEl.innerHTML = `
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                <line x1="12" y1="8" x2="12" y2="14"></line>
                <line x1="9" y1="11" x2="15" y2="11"></line>
              </svg>
              <h3>${t('wordbookEmptyTitle')}</h3>
              <p>${t('wordbookEmptyDesc')}</p>
            </div>
          `;
        }
      } else {
        wordListEl.innerHTML = `
          <div class="empty-state">
            <h3>🔍</h3>
            <p>沒有匹配的結果</p>
          </div>
        `;
      }
      
      const hasTrash = wordbook.some(w => !!w.deletedAt);
      if (!isTrash && hasTrash) {
        bulkActions.style.display = 'flex';
        if (selectAllLabel) selectAllLabel.style.display = 'none';
        if (bulkDeleteBtn) bulkDeleteBtn.style.display = 'none';
      } else {
        bulkActions.style.display = 'none';
      }
      return;
    }

    bulkActions.style.display = 'flex';
    if (selectAllLabel) selectAllLabel.style.display = '';
    if (bulkDeleteBtn) bulkDeleteBtn.style.display = '';

    // Build chronological ID mapping for the current view scope (1 = earliest created, N = newest)
    const currentScopeWords = wordbook.filter(w => isTrash ? !!w.deletedAt : !w.deletedAt);
    const chronologicalOrder = [...currentScopeWords].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const idSeqMap = new Map();
    chronologicalOrder.forEach((w, i) => {
      idSeqMap.set(w.id, i + 1);
    });

    const headerColsHTML = colOrder.map(c => {
      if (c === 'col-date' && isTrash) {
        return `<div class="col-date"><span>操作</span><div class="col-resizer" data-col="col-date" title="拖動調整寬度 / 雙擊恢復默認"></div></div>`;
      }
      return HEADER_COL_TEMPLATES[c] || '';
    }).join('');

    const headerHTML = `
      <div class="table-header">
        <div class="col-selection">
          <div class="col-header-sortable" id="colHeaderId" title="點擊切換升序/降序">
            <span>ID</span>
            <svg class="sort-indicator" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="${currentSort === 'oldest' ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"></polyline>
            </svg>
          </div>
          <div class="col-resizer" data-col="col-selection" title="雙擊恢復默認寬度"></div>
        </div>
        ${headerColsHTML}
      </div>
    `;

    const rowsHTML = filteredWords.map((word, index) => {
      const date = new Date(word.deletedAt || word.timestamp).toLocaleDateString();
      const englishText = (word.english || []).join('; ') || '—';
      const isChecked = selectedIds.has(word.id) ? 'checked' : '';
      const displayId = idSeqMap.get(word.id) || (index + 1);

      const colsHTML = colOrder.map(c => {
        if (c === 'col-date' && isTrash) {
          return `
            <div class="col-date">
              <div class="trash-row-actions">
                <button class="trash-action-btn restore-single-btn" data-id="${word.id}" title="${t('wordbookRestoreSingle') || '還原'}">${t('wordbookRestoreSingle') || '還原'}</button>
                <button class="trash-action-btn del-perm delete-single-perm-btn" data-id="${word.id}" title="${t('wordbookDeletePermanentSingle') || '徹底刪除'}">${t('wordbookDeletePermanentSingle') || '徹底刪除'}</button>
              </div>
            </div>
          `;
        }
        return getRowColHTML(c, word, date, englishText);
      }).join('');

      return `
        <div class="table-row word-card" data-id="${word.id}">
          <div class="col-selection">
            <label class="selection-label">
              <input type="checkbox" class="word-card-checkbox" data-id="${word.id}" ${isChecked} />
              <span class="selection-text">${displayId}</span>
            </label>
          </div>
          ${colsHTML}
        </div>
      `;
    }).join('');

    wordListEl.innerHTML = headerHTML + rowsHTML;

    updateSelectionUI();
    applyColumnVisibility();
  }

  function updateStats() {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

    const activeWords = wordbook.filter(w => !w.deletedAt);
    const trashWords = wordbook.filter(w => !!w.deletedAt);

    const statTotalEl = document.getElementById('statTotal');
    const statTodayEl = document.getElementById('statToday');
    const statWeekEl = document.getElementById('statWeek');
    if (statTotalEl) statTotalEl.textContent = activeWords.length;
    if (statTodayEl) statTodayEl.textContent = activeWords.filter(w => w.timestamp >= todayStart).length;
    if (statWeekEl) statWeekEl.textContent = activeWords.filter(w => w.timestamp >= weekStart).length;

    if (badgeTrash) {
      badgeTrash.textContent = trashWords.length > 99 ? '99+' : trashWords.length;
      badgeTrash.classList.toggle('has-items', trashWords.length > 0);
    }
  }

  async function updateStorage() {
    const usage = await getStorageUsage();
    const storageText = document.getElementById('storageText');
    const storageFill = document.getElementById('storageProgressFill');
    const activeWords = wordbook.filter(w => !w.deletedAt);
    if (storageText) {
      const usedKB = (usage.used / 1024).toFixed(1);
      const quotaMB = (usage.quota / (1024 * 1024)).toFixed(0);
      storageText.textContent = `${usedKB} KB / ${quotaMB} MB（${t('wordbookTotal')} ${activeWords.length} ${t('wordbookWords')}）`;
    }
    if (storageFill) {
      storageFill.style.width = Math.min(usage.percentage, 100) + '%';
    }
  }

  // ==================== Selection ====================

  function updateSelectionUI() {
    const count = selectedIds.size;
    if (selectedCountEl) selectedCountEl.textContent = count;
    if (selectedCountTrash) selectedCountTrash.textContent = count;
    if (bulkDeleteBtn) bulkDeleteBtn.disabled = count === 0;
    if (bulkRestoreBtn) bulkRestoreBtn.disabled = count === 0;
    if (bulkDeletePermanentBtn) bulkDeletePermanentBtn.disabled = count === 0;
    selectAllCheckbox.checked = filteredWords.length > 0 && filteredWords.every(w => selectedIds.has(w.id));
  }

  // ==================== Event Handlers ====================

  // Header collapse toggle
  const headerCollapsible = document.getElementById('headerCollapsible');
  const headerCollapseToggle = document.getElementById('headerCollapseToggle');
  if (headerCollapsible && headerCollapseToggle) {
    const isCollapsed = localStorage.getItem('jyutping_header_collapsed') === 'true';
    if (isCollapsed) {
      headerCollapsible.classList.add('collapsed');
      headerCollapseToggle.classList.add('collapsed');
      headerCollapseToggle.title = '展開表頭';
    }
    headerCollapseToggle.addEventListener('click', () => {
      const collapsed = headerCollapsible.classList.toggle('collapsed');
      headerCollapseToggle.classList.toggle('collapsed', collapsed);
      headerCollapseToggle.title = collapsed ? '展開表頭' : '收起表頭';
      localStorage.setItem('jyutping_header_collapsed', collapsed);
    });
  }

  // Unified table header context menu (sort + column visibility + reorder)
  const tableHeaderMenu = document.getElementById('tableHeaderMenu');

  // Column order state
  const DEFAULT_COL_ORDER = ['col-char', 'col-jyutping', 'col-yale', 'col-meaning', 'col-date'];
  let colOrder = [...DEFAULT_COL_ORDER];
  try {
    const savedOrder = JSON.parse(localStorage.getItem('jyutping_col_order'));
    if (Array.isArray(savedOrder)) {
      if (!savedOrder.includes('col-yale')) {
        const jpIdx = savedOrder.indexOf('col-jyutping');
        if (jpIdx !== -1) {
          savedOrder.splice(jpIdx + 1, 0, 'col-yale');
        } else {
          savedOrder.push('col-yale');
        }
      }
      if (DEFAULT_COL_ORDER.every(c => savedOrder.includes(c))) {
        colOrder = savedOrder;
      }
    }
  } catch(e) {}

  // Column templates for header and row rendering
  const HEADER_COL_TEMPLATES = {
    'col-char': `<div class="col-char"><span>Character</span><div class="col-resizer" data-col="col-char" title="拖動調整寬度 / 雙擊恢復默認"></div></div>`,
    'col-jyutping': `<div class="col-jyutping"><span>Jyutping</span><div class="col-resizer" data-col="col-jyutping" title="拖動調整寬度 / 雙擊恢復默認"></div></div>`,
    'col-yale': `<div class="col-yale"><span>Yale</span><div class="col-resizer" data-col="col-yale" title="拖動調整寬度 / 雙擊恢復默認"></div></div>`,
    'col-meaning': `<div class="col-meaning"><span>Meaning</span><div class="col-resizer" data-col="col-meaning" title="拖動調整寬度 / 雙擊恢復默認"></div></div>`,
    'col-date': `<div class="col-date"><span>Date</span><div class="col-resizer" data-col="col-date" title="拖動調整寬度 / 雙擊恢復默認"></div></div>`
  };

  function getRowColHTML(colKey, word, date, englishText) {
    switch (colKey) {
      case 'col-char':
        return `
          <div class="col-char">
            <div class="excel-cell">
              <span class="word-character excel-cell-text" data-word="${escapeHtml(word.character)}">${escapeHtml(word.character)}</span>
              <span class="word-character excel-cell-floating" data-word="${escapeHtml(word.character)}">${escapeHtml(word.character)}</span>
            </div>
          </div>
        `;
      case 'col-jyutping':
        return `
          <div class="col-jyutping word-jyutping">
            <div class="excel-cell">
              <span class="jyutping-text excel-cell-text" data-word="${escapeHtml(word.character)}">${escapeHtml(word.jyutping || '')}</span>
              <span class="jyutping-text excel-cell-floating" data-word="${escapeHtml(word.character)}">${escapeHtml(word.jyutping || '')}</span>
            </div>
          </div>
        `;
      case 'col-yale':
        const yaleText = word.yale || word.jyutping || '';
        return `
          <div class="col-yale word-jyutping">
            <div class="excel-cell">
              <span class="jyutping-text excel-cell-text" data-word="${escapeHtml(word.character)}">${escapeHtml(yaleText)}</span>
              <span class="jyutping-text excel-cell-floating" data-word="${escapeHtml(word.character)}">${escapeHtml(yaleText)}</span>
            </div>
          </div>
        `;
      case 'col-meaning':
        return `<div class="col-meaning"></div>`;
      case 'col-date':
        return `<div class="col-date">${date}</div>`;
      default:
        return '';
    }
  }

  // Column visibility state (Yale is hidden by default)
  const defaultCols = { 'col-char': true, 'col-jyutping': true, 'col-yale': false, 'col-meaning': true, 'col-date': true };
  let visibleCols = { ...defaultCols };
  try {
    const saved = JSON.parse(localStorage.getItem('jyutping_visible_cols'));
    if (saved) {
      visibleCols = { ...defaultCols, ...saved };
      if (visibleCols['col-yale'] === undefined) {
        visibleCols['col-yale'] = false;
      }
    }
  } catch(e) {}

  // Default and custom column sizes (in px)
  const DEFAULT_COL_SIZES = {
    'col-selection': 56,
    'col-char': 120,
    'col-jyutping': 160,
    'col-yale': 160,
    'col-date': 75
  };
  let customColSizes = { ...DEFAULT_COL_SIZES };
  try {
    const savedSizes = JSON.parse(localStorage.getItem('jyutping_col_sizes'));
    if (savedSizes) {
      customColSizes = { ...DEFAULT_COL_SIZES, ...savedSizes };
      // Sanitize stored widths against corruption
      customColSizes['col-selection'] = Math.max(56, customColSizes['col-selection'] || 56);
      customColSizes['col-char'] = Math.min(400, Math.max(70, customColSizes['col-char'] || 120));
      customColSizes['col-jyutping'] = Math.min(450, Math.max(90, customColSizes['col-jyutping'] || 160));
      customColSizes['col-yale'] = Math.min(450, Math.max(90, customColSizes['col-yale'] || 160));
      customColSizes['col-date'] = Math.min(250, Math.max(55, customColSizes['col-date'] || 75));
    }
  } catch(e) {}

  const COL_NAMES = {
    'col-char': 'Character',
    'col-jyutping': 'Jyutping',
    'col-yale': 'Yale',
    'col-meaning': 'Meaning',
    'col-date': 'Date'
  };

  function updateMenuToggles() {
    const container = document.getElementById('menuTogglesContainer');
    if (!container) return;

    container.innerHTML = colOrder.map(colKey => {
      const isChecked = visibleCols[colKey] !== false ? 'checked' : '';
      const name = COL_NAMES[colKey] || colKey;
      return `
        <div class="sort-context-menu-toggle" data-col="${colKey}" draggable="true">
          <span class="col-drag-handle" title="按住拖動調整欄位順序">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="5" r="1.5"></circle>
              <circle cx="9" cy="12" r="1.5"></circle>
              <circle cx="9" cy="19" r="1.5"></circle>
              <circle cx="15" cy="5" r="1.5"></circle>
              <circle cx="15" cy="12" r="1.5"></circle>
              <circle cx="15" cy="19" r="1.5"></circle>
            </svg>
          </span>
          <label class="toggle-checkbox-label">
            <input type="checkbox" ${isChecked} />
            <span>${name}</span>
          </label>
        </div>
      `;
    }).join('');
  }

  function setupMenuDragAndDrop() {
    const container = document.getElementById('menuTogglesContainer');
    if (!container) return;

    let draggedItem = null;

    container.addEventListener('dragstart', (e) => {
      const toggle = e.target.closest('.sort-context-menu-toggle');
      if (!toggle) return;
      draggedItem = toggle;
      toggle.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', toggle.dataset.col);
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const targetToggle = e.target.closest('.sort-context-menu-toggle');
      if (!targetToggle || targetToggle === draggedItem) return;

      const rect = targetToggle.getBoundingClientRect();
      const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;

      container.querySelectorAll('.sort-context-menu-toggle').forEach(el => {
        el.classList.remove('drag-over-above', 'drag-over-below');
      });

      if (next) {
        targetToggle.classList.add('drag-over-below');
      } else {
        targetToggle.classList.add('drag-over-above');
      }
    });

    container.addEventListener('dragleave', (e) => {
      const targetToggle = e.target.closest('.sort-context-menu-toggle');
      if (targetToggle) {
        targetToggle.classList.remove('drag-over-above', 'drag-over-below');
      }
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetToggle = e.target.closest('.sort-context-menu-toggle');
      if (!targetToggle || !draggedItem || targetToggle === draggedItem) return;

      const srcCol = draggedItem.dataset.col;
      const targetCol = targetToggle.dataset.col;

      const rect = targetToggle.getBoundingClientRect();
      const isAfter = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;

      const srcIdx = colOrder.indexOf(srcCol);
      if (srcIdx > -1) colOrder.splice(srcIdx, 1);

      let targetIdx = colOrder.indexOf(targetCol);
      if (isAfter) targetIdx += 1;
      colOrder.splice(targetIdx, 0, srcCol);

      try {
        localStorage.setItem('jyutping_col_order', JSON.stringify(colOrder));
      } catch(err) {}

      renderList();
      applyColumnVisibility();
    });

    container.addEventListener('dragend', () => {
      if (draggedItem) draggedItem.classList.remove('is-dragging');
      draggedItem = null;
      container.querySelectorAll('.sort-context-menu-toggle').forEach(el => {
        el.classList.remove('drag-over-above', 'drag-over-below', 'is-dragging');
      });
    });

    // Checkbox toggle inside menuTogglesContainer
    container.addEventListener('change', (e) => {
      const toggle = e.target.closest('.sort-context-menu-toggle');
      if (!toggle) return;
      const col = toggle.dataset.col;
      const checkbox = toggle.querySelector('input[type="checkbox"]');
      if (checkbox) {
        visibleCols[col] = checkbox.checked;
        try {
          localStorage.setItem('jyutping_visible_cols', JSON.stringify(visibleCols));
        } catch(err) {}
        applyColumnVisibility();
      }
    });
  }

  function applyColumnVisibility() {
    Object.entries(visibleCols).forEach(([col, visible]) => {
      document.querySelectorAll('.' + col).forEach(el => {
        el.style.display = visible ? '' : 'none';
      });
    });

    // Hide divider resizer on the rightmost visible column so no line leaks at table right edge
    const headerCols = Array.from(document.querySelectorAll('.table-header > div'));
    const visibleHeaderCells = headerCols.filter(el => el.style.display !== 'none');
    document.querySelectorAll('.table-header .col-resizer').forEach(r => { r.style.display = ''; });
    if (visibleHeaderCells.length > 0) {
      const lastCell = visibleHeaderCells[visibleHeaderCells.length - 1];
      const lastResizer = lastCell.querySelector('.col-resizer');
      if (lastResizer) lastResizer.style.display = 'none';
    }

    // Rebuild grid-template-columns dynamically based on colOrder & visibleCols
    const colSizeMap = {
      'col-char': (customColSizes['col-char'] || 120) + 'px',
      'col-jyutping': (customColSizes['col-jyutping'] || 160) + 'px',
      'col-yale': (customColSizes['col-yale'] || 160) + 'px',
      'col-meaning': 'minmax(0, 1fr)',
      'col-date': (customColSizes['col-date'] || 75) + 'px',
    };

    const activeCols = [
      Math.max(56, customColSizes['col-selection'] || 56) + 'px',
      ...colOrder.filter(c => visibleCols[c] !== false).map(c => colSizeMap[c] || '1fr')
    ];

    const gridCols = activeCols.join(' ');
    document.querySelectorAll('.table-header, .table-row').forEach(el => {
      el.style.gridTemplateColumns = gridCols;
    });

    updateMenuToggles();
  }

  // Column drag resizing interaction
  const MIN_COL_SIZES = {
    'col-selection': 56,
    'col-char': 70,
    'col-jyutping': 90,
    'col-yale': 90,
    'col-meaning': 90,
    'col-date': 55
  };

  let isResizingCol = false;
  let currentResizer = null;
  let startX = 0;
  let startWidth = 0;
  let startDateWidth = 0;
  let targetCol = '';

  document.addEventListener('mousedown', (e) => {
    const resizer = e.target.closest('.col-resizer');
    if (!resizer) return;

    e.preventDefault();
    e.stopPropagation();

    targetCol = resizer.dataset.col;
    if (!targetCol) return;

    const headerCell = resizer.closest('.' + targetCol);
    if (!headerCell) return;

    isResizingCol = true;
    currentResizer = resizer;
    startX = e.clientX;
    startWidth = headerCell.getBoundingClientRect().width;
    const dateCell = document.querySelector('.table-header .col-date');
    startDateWidth = dateCell ? dateCell.getBoundingClientRect().width : (customColSizes['col-date'] || 75);

    resizer.classList.add('is-resizing');
    document.body.classList.add('is-col-resizing');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizingCol || !currentResizer || !targetCol) return;

    const deltaX = e.clientX - startX;
    let newWidth = Math.round(startWidth + deltaX);
    const minW = MIN_COL_SIZES[targetCol] || 60;
    if (newWidth < minW) newWidth = minW;

    if (targetCol === 'col-meaning') {
      // Dragging meaning's right resizer adjusts date column smoothly
      let newDateWidth = Math.round(startDateWidth - deltaX);
      const minDateW = MIN_COL_SIZES['col-date'] || 55;
      if (newDateWidth < minDateW) newDateWidth = minDateW;
      if (newDateWidth > 250) newDateWidth = 250;
      customColSizes['col-date'] = newDateWidth;
    } else if (DEFAULT_COL_SIZES[targetCol] !== undefined) {
      customColSizes[targetCol] = newWidth;
    }
    applyColumnVisibility();
  });

  document.addEventListener('mouseup', () => {
    if (!isResizingCol) return;
    isResizingCol = false;
    if (currentResizer) {
      currentResizer.classList.remove('is-resizing');
      currentResizer = null;
    }
    document.body.classList.remove('is-col-resizing');
    try {
      localStorage.setItem('jyutping_col_sizes', JSON.stringify(customColSizes));
    } catch(e) {}
  });

  // Double-click on resizer -> reset column width to default
  document.addEventListener('dblclick', (e) => {
    const resizer = e.target.closest('.col-resizer');
    if (resizer && resizer.dataset.col) {
      const col = resizer.dataset.col;
      if (col === 'col-meaning') {
        customColSizes['col-date'] = DEFAULT_COL_SIZES['col-date'];
      } else if (DEFAULT_COL_SIZES[col] !== undefined) {
        customColSizes[col] = DEFAULT_COL_SIZES[col];
      }
      try {
        localStorage.setItem('jyutping_col_sizes', JSON.stringify(customColSizes));
      } catch(err) {}
      applyColumnVisibility();
    }
  });

  // Apply on initial render & setup menu DND
  setTimeout(() => {
    applyColumnVisibility();
    setupMenuDragAndDrop();
  }, 0);

  if (tableHeaderMenu) {
    // Right-click on any table header column
    document.addEventListener('contextmenu', (e) => {
      const header = e.target.closest('.table-header');
      if (header) {
        e.preventDefault();
        tableHeaderMenu.style.left = e.clientX + 'px';
        tableHeaderMenu.style.top = e.clientY + 'px';
        // Update sort active state
        tableHeaderMenu.querySelectorAll('.sort-context-menu-item').forEach(item => {
          item.classList.toggle('active', item.dataset.sort === currentSort);
        });
        updateMenuToggles();
        tableHeaderMenu.classList.add('show');
      }
    });

    // Left-click on ID header toggles sort
    document.addEventListener('click', (e) => {
      const idHeader = e.target.closest('#colHeaderId');
      if (idHeader) {
        currentSort = currentSort === 'newest' ? 'oldest' : 'newest';
        renderList();
        applyColumnVisibility();
      }
      // Close menu on any click outside
      if (!e.target.closest('.sort-context-menu')) {
        tableHeaderMenu.classList.remove('show');
      }
    });

    // Sort selection & Reset button
    tableHeaderMenu.addEventListener('click', (e) => {
      const resetBtn = e.target.closest('#resetColWidthsBtn');
      if (resetBtn) {
        customColSizes = { ...DEFAULT_COL_SIZES };
        colOrder = [...DEFAULT_COL_ORDER];
        visibleCols = { ...defaultCols };
        try {
          localStorage.removeItem('jyutping_col_sizes');
          localStorage.removeItem('jyutping_col_order');
          localStorage.removeItem('jyutping_visible_cols');
        } catch(err) {}
        renderList();
        applyColumnVisibility();
        tableHeaderMenu.classList.remove('show');
        return;
      }

      const sortItem = e.target.closest('.sort-context-menu-item');
      if (sortItem && sortItem.dataset.sort) {
        currentSort = sortItem.dataset.sort;
        renderList();
        applyColumnVisibility();
        tableHeaderMenu.classList.remove('show');
      }
    });

    // Column visibility toggle
    tableHeaderMenu.addEventListener('change', (e) => {
      const toggle = e.target.closest('.sort-context-menu-toggle');
      if (toggle) {
        const col = toggle.dataset.col;
        visibleCols[col] = e.target.checked;
        localStorage.setItem('jyutping_visible_cols', JSON.stringify(visibleCols));
        applyColumnVisibility();
      }
    });
  }

  // Search (wordbook list filtering + dictionary dropdown)
  const dictSearchDropdown = document.getElementById('dictSearchDropdown');
  let dictSearchTimer = null;
  let dictActiveIndex = -1;
  let dictResults = [];
  let searchMode = 'wordbook'; // 'wordbook' or 'dict'
  try {
    const savedMode = localStorage.getItem('jyutping_search_mode');
    if (savedMode === 'dict' || savedMode === 'wordbook') {
      searchMode = savedMode;
    }
  } catch(e) {}

  function updateSearchModeUI() {
    if (searchModeToggle) {
      searchModeToggle.querySelectorAll('.search-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === searchMode);
      });
    }
    if (searchInput) {
      if (searchMode === 'wordbook') {
        searchInput.placeholder = t('wordbookSearchPlaceholder') || '搜索生詞...';
      } else {
        const dictMap = {
          'zh-HK': '搜索詞典...',
          'zh-TW': '搜索詞典...',
          'zh-CN': '搜索词典...',
          'en': 'Search dictionary...',
          'ja': '辞書を検索...',
          'ko': '사전 검색...'
        };
        searchInput.placeholder = dictMap[currentLang] || t('dictSearchFallback') || '搜索詞典...';
      }
    }
  }

  // Search mode toggle
  const searchModeToggle = document.getElementById('searchModeToggle');
  if (searchModeToggle) {
    updateSearchModeUI();

    searchModeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.search-mode-btn');
      if (!btn || btn.classList.contains('active')) return;

      // Switch mode & persist
      searchMode = btn.dataset.mode;
      try {
        localStorage.setItem('jyutping_search_mode', searchMode);
      } catch(err) {}
      updateSearchModeUI();

      // Clear and re-trigger search with current query
      const query = searchInput.value.trim();
      if (searchMode === 'wordbook') {
        hideDictDropdown();
        searchQuery = query;
        renderList();
      } else {
        // In dict mode, restore the full word list
        searchQuery = '';
        renderList();
        // Trigger dict search if there's text
        if (query.length >= 1) {
          buildDictSearchIndex();
          const results = searchDictionary(query);
          renderDictDropdown(results, query);
        }
      }

      searchInput.focus();
    });
  }

  // Build a flat search index from dictionary for faster lookup
  let dictSearchIndex = null;

  function buildDictSearchIndex() {
    if (!dictionary || dictSearchIndex) return;
    dictSearchIndex = [];
    for (const key of Object.keys(dictionary)) {
      const entry = dictionary[key];
      dictSearchIndex.push({
        key,
        traditional: entry.traditional || '',
        simplified: entry.simplified || '',
        jyutping: (entry.jyutping || '').toLowerCase(),
        pinyin: (entry.pinyin || '').toLowerCase(),
        english: (entry.english || []).join(' ').toLowerCase(),
        entry
      });
    }
  }

  function searchDictionary(query) {
    query = query.trim();
    if (!dictSearchIndex || !query || query.length < 1) return [];

    // For Chinese queries, strip everything that isn't a CJK character
    // e.g. "香 港" / "香-港" / "香·港" → "香港"
    const hasChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(query);
    if (hasChinese) {
      query = query.replace(/[^\u4e00-\u9fff\u3400-\u4dbf]/g, '');
    }

    const q = query.toLowerCase();
    const results = [];
    const savedChars = new Set(wordbook.map(w => w.character));
    const seenTraditional = new Set(); // Deduplicate entries with same traditional form
    const MAX_RESULTS = 30;

    // Detect query type
    const isLatin = /^[a-zA-Z0-9\s]+$/.test(query);
    const isChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(query);
    // Toneless mode: query has letters but no digits (e.g. 'hoeng gong')
    const hasTones = /\d/.test(query);
    const stripTones = (s) => s.replace(/[0-9]/g, '');
    const qNoTone = hasTones ? q : stripTones(q);

    // Pass 1: Exact matches first (e.g. '香港' before '香港仔', 'hoeng1 gong2' exact)
    for (let i = 0; i < dictSearchIndex.length && results.length < MAX_RESULTS; i++) {
      const item = dictSearchIndex[i];
      if (seenTraditional.has(item.traditional)) continue;
      let isExact = false;
      if (isChinese && (item.traditional === query || item.simplified === query)) {
        isExact = true;
      } else if (isLatin) {
        if (hasTones && (item.jyutping === q || item.pinyin === q)) {
          isExact = true;
        } else if (!hasTones && (stripTones(item.jyutping) === qNoTone || stripTones(item.pinyin) === qNoTone)) {
          isExact = true;
        }
      }
      if (isExact) {
        seenTraditional.add(item.traditional);
        results.push({ ...item, matchType: isChinese ? 'char-exact' : 'jyutping-exact', isSaved: savedChars.has(item.traditional) });
      }
    }

    // Pass 2: Partial / prefix matches
    for (let i = 0; i < dictSearchIndex.length && results.length < MAX_RESULTS; i++) {
      const item = dictSearchIndex[i];
      if (seenTraditional.has(item.traditional)) continue;

      let matched = false;
      let matchType = '';

      if (isChinese) {
        if (item.traditional.includes(query) || item.simplified.includes(query)) {
          matched = true;
          matchType = 'char';
        }
      } else if (isLatin) {
        // Compare with or without tones
        const itemJp = hasTones ? item.jyutping : stripTones(item.jyutping);
        const itemPy = hasTones ? item.pinyin : stripTones(item.pinyin);
        const cmpQ = hasTones ? q : qNoTone;

        if (itemJp.startsWith(cmpQ) || itemJp === cmpQ) {
          matched = true;
          matchType = 'jyutping-exact';
        } else if (itemPy.startsWith(cmpQ) || itemPy === cmpQ) {
          matched = true;
          matchType = 'pinyin-exact';
        } else if (itemJp.includes(cmpQ)) {
          matched = true;
          matchType = 'jyutping';
        } else if (itemPy.includes(cmpQ)) {
          matched = true;
          matchType = 'pinyin';
        } else if (item.english.includes(q)) {
          matched = true;
          matchType = 'english';
        }
      } else {
        if (item.traditional.includes(query) || item.simplified.includes(query)) {
          matched = true;
          matchType = 'char';
        } else if (item.jyutping.includes(q)) {
          matched = true;
          matchType = 'jyutping';
        }
      }

      if (matched) {
        seenTraditional.add(item.traditional);
        results.push({
          ...item,
          matchType,
          isSaved: savedChars.has(item.traditional)
        });
      }
    }

    results.sort((a, b) => {
      // Exact character match first
      if (a.matchType === 'char-exact' && b.matchType !== 'char-exact') return -1;
      if (a.matchType !== 'char-exact' && b.matchType === 'char-exact') return 1;
      if (a.matchType === 'char' && b.matchType !== 'char') return -1;
      if (a.matchType !== 'char' && b.matchType === 'char') return 1;
      if (a.matchType.includes('exact') && !b.matchType.includes('exact')) return -1;
      if (!a.matchType.includes('exact') && b.matchType.includes('exact')) return 1;
      return a.traditional.length - b.traditional.length;
    });

    return results;
  }

  function renderDictDropdown(results, query) {
    if (!results || results.length === 0) {
      if (query && query.length >= 1) {
        const emptyMsg = t('dictSearchEmpty') || '未在詞典中找到匹配結果';
        dictSearchDropdown.innerHTML = `<div class="dict-dropdown-empty">${emptyMsg}</div>`;
        dictSearchDropdown.classList.add('show');
      } else {
        dictSearchDropdown.classList.remove('show');
      }
      dictResults = [];
      dictActiveIndex = -1;
      return;
    }

    dictResults = results;
    dictActiveIndex = -1;

    let html = `<div class="dict-dropdown-header">
      <span>${t('dictSearchFallback') || '📖 詞典搜索'}</span>
      <span class="dict-count">${results.length} 個結果</span>
    </div>`;

    results.forEach((item, idx) => {
      const def = (item.entry.english || []).filter(d => !d.startsWith('[粵]')).slice(0, 2).join('; ') || '';
      const truncDef = def.length > 60 ? def.slice(0, 57) + '…' : def;
      const savedStar = item.isSaved ? '<span style="color:#D4AF37;font-size:20px;margin-left:5px;line-height:0;vertical-align:-1px;">★</span>' : '';

      html += `<div class="dict-dropdown-item" data-idx="${idx}" data-word="${item.key}">
        <span class="dict-item-char">${item.traditional}</span>
        <div class="dict-item-info">
          <div class="dict-item-jyutping"><span>${item.entry.jyutping || ''}</span>${savedStar}</div>
          <div class="dict-item-def">${truncDef}</div>
        </div>
      </div>`;
    });

    dictSearchDropdown.innerHTML = html;
    dictSearchDropdown.classList.add('show');
  }

  function hideDictDropdown() {
    dictSearchDropdown.classList.remove('show');
    dictResults = [];
    dictActiveIndex = -1;
  }

  function selectDictItem(index) {
    if (index < 0 || index >= dictResults.length) return;
    const item = dictResults[index];

    // Activate detail mode if not active
    if (!isDetailMode) {
      const detailModeToggleBtn = document.getElementById('detailModeToggleBtn');
      if (detailModeToggleBtn) detailModeToggleBtn.click();
    }

    renderDetailPanel(item.key);

    // Highlight in list if exists
    document.querySelectorAll('.table-row').forEach(r => {
      r.classList.remove('active-row');
      const charEl = r.querySelector('.word-character');
      if (charEl && charEl.dataset.word === item.key) {
        r.classList.add('active-row');
        r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    hideDictDropdown();
    searchInput.blur();
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();

    if (searchMode === 'wordbook') {
      // Wordbook mode: filter list, no dropdown
      searchQuery = query;
      renderList();
      hideDictDropdown();
    } else {
      // Dict mode: show dropdown, don't filter list
      searchQuery = '';
      renderList();
      clearTimeout(dictSearchTimer);
      if (!query || query.length < 1) {
        hideDictDropdown();
        return;
      }
      dictSearchTimer = setTimeout(() => {
        buildDictSearchIndex();
        const results = searchDictionary(query);
        renderDictDropdown(results, query);
      }, 150);
    }
  });

  // Keyboard navigation for dropdown
  searchInput.addEventListener('keydown', (e) => {
    if (searchMode !== 'dict') return;
    if (!dictSearchDropdown.classList.contains('show') || dictResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      dictActiveIndex = Math.min(dictActiveIndex + 1, dictResults.length - 1);
      updateDictActiveItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      dictActiveIndex = Math.max(dictActiveIndex - 1, 0);
      updateDictActiveItem();
    } else if (e.key === 'Enter' && dictActiveIndex >= 0) {
      e.preventDefault();
      selectDictItem(dictActiveIndex);
    } else if (e.key === 'Escape') {
      hideDictDropdown();
    }
  });

  function updateDictActiveItem() {
    dictSearchDropdown.querySelectorAll('.dict-dropdown-item').forEach((el, i) => {
      el.classList.toggle('active', i === dictActiveIndex);
      if (i === dictActiveIndex) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // Click handler for dropdown items
  dictSearchDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dict-dropdown-item');
    if (item) {
      const idx = parseInt(item.dataset.idx);
      selectDictItem(idx);
    }
  });

  // Prevent dropdown from closing when clicking inside it
  dictSearchDropdown.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      hideDictDropdown();
    }
  });

  // Reopen dropdown when refocusing search input with existing query
  searchInput.addEventListener('focus', () => {
    if (searchMode !== 'dict') return;
    const query = searchInput.value.trim();
    if (query && query.length >= 1 && dictResults.length === 0) {
      buildDictSearchIndex();
      const results = searchDictionary(query);
      renderDictDropdown(results, query);
    } else if (dictResults.length > 0) {
      dictSearchDropdown.classList.add('show');
    }
  });


  // Export dropdown
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    exportMenu.classList.remove('show');
  });

  exportMenu.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const format = btn.dataset.format;
    if (format) {
      await doExport(format);
      exportMenu.classList.remove('show');
    }
  });

  warningExportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    doExport('json');
  });

  // ==================== Multi-Engine TTS ====================
  const EDGE_TTS_DEFAULT_URL = 'http://114.55.243.162:8090';
  let speakingBtn = null;
  let speakingTimer = null;
  let currentAudio = null;
  let currentTtsRequestId = 0;

  function startSpeaking(btn) {
    if (speakingBtn) {
      speakingBtn.classList.remove('speaking');
      const parentCell = speakingBtn.closest('.excel-cell');
      if (parentCell) parentCell.querySelectorAll('.word-character, .jyutping-text').forEach(el => el.classList.remove('speaking'));
      const parentToolbar = speakingBtn.closest('.ai-selection-toolbar, .ai-hover-phonetic-pill');
      if (parentToolbar) parentToolbar.classList.remove('speaking');
    }
    if (speakingTimer) clearTimeout(speakingTimer);
    speakingBtn = btn;
    if (btn) {
      btn.classList.add('speaking');
      const parentCell = btn.closest('.excel-cell');
      if (parentCell) parentCell.querySelectorAll('.word-character, .jyutping-text').forEach(el => el.classList.add('speaking'));
      const parentToolbar = btn.closest('.ai-selection-toolbar, .ai-hover-phonetic-pill');
      if (parentToolbar) parentToolbar.classList.add('speaking');
    }
    speakingTimer = setTimeout(stopSpeaking, 8000);
  }

  function stopSpeaking() {
    if (speakingBtn) {
      speakingBtn.classList.remove('speaking');
      const parentCell = speakingBtn.closest('.excel-cell');
      if (parentCell) parentCell.querySelectorAll('.word-character, .jyutping-text').forEach(el => el.classList.remove('speaking'));
      const parentToolbar = speakingBtn.closest('.ai-selection-toolbar, .ai-hover-phonetic-pill');
      if (parentToolbar) parentToolbar.classList.remove('speaking');
    }
    speakingBtn = null;
    if (speakingTimer) { clearTimeout(speakingTimer); speakingTimer = null; }
  }

  function playTts(text, ttsBtn) {
    if (!text) return;
    const reqId = ++currentTtsRequestId;

    // Immediately stop any currently playing speech or audio
    try {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      if (chrome.tts && typeof chrome.tts.stop === 'function') chrome.tts.stop();
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
      }
    } catch(e) {}

    startSpeaking(ttsBtn);

    chrome.storage.sync.get([
      'ttsEngine', 'edgeTtsMode', 'edgeTtsUrl', 'azureTtsMode', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'ttsRate'
    ], async (result) => {
      if (reqId !== currentTtsRequestId) return; // Superseded by a newer request

      const engine = result.ttsEngine || 'edgeTts';
      const rate = result.ttsRate || 0.9;

      if (engine === 'webSpeech') {
        if (reqId !== currentTtsRequestId) return;
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-HK';
        utterance.rate = rate;
        utterance.onend = () => { if (reqId === currentTtsRequestId) stopSpeaking(); };
        utterance.onerror = () => { if (reqId === currentTtsRequestId) stopSpeaking(); };
        const cantoneseVoice = speechSynthesis.getVoices().find(v => v.lang.startsWith('zh-HK'));
        if (cantoneseVoice) utterance.voice = cantoneseVoice;
        speechSynthesis.speak(utterance);
      } else if (engine === 'chromeTts') {
        if (reqId !== currentTtsRequestId) return;
        if (chrome.tts) {
          chrome.tts.speak(text, {
            lang: 'zh-HK', rate: rate,
            onEvent: (e) => {
              if (reqId === currentTtsRequestId && (e.type === 'end' || e.type === 'error')) {
                stopSpeaking();
              }
            }
          });
        } else {
          stopSpeaking();
        }
      } else if (engine === 'edgeTts') {
        try {
          const baseUrl = (result.edgeTtsMode === 'custom' ? result.edgeTtsUrl : EDGE_TTS_DEFAULT_URL).replace(/\/$/, '');
          const resp = await fetch(baseUrl + '/v1/audio/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: text, voice: 'zh-HK-HiuMaanNeural', model: 'tts-1', speed: rate })
          });
          if (reqId !== currentTtsRequestId) return; // Discard if new click happened while fetching
          if (!resp.ok) throw new Error('Edge TTS error: ' + resp.status);
          const blob = await resp.blob();
          if (reqId !== currentTtsRequestId) return;

          const audio = new Audio(URL.createObjectURL(blob));
          currentAudio = audio;
          audio.onended = () => {
            if (reqId === currentTtsRequestId) {
              URL.revokeObjectURL(audio.src);
              currentAudio = null;
              stopSpeaking();
            }
          };
          audio.onerror = () => {
            if (reqId === currentTtsRequestId) {
              currentAudio = null;
              stopSpeaking();
            }
          };
          audio.play();
        } catch (e) {
          if (reqId !== currentTtsRequestId) return;
          console.warn('[Wordbook] Edge TTS failed, falling back to Chrome TTS / WebSpeech:', e);
          if (chrome.tts) {
            chrome.tts.speak(text, {
              lang: 'zh-HK', rate: rate,
              onEvent: (e) => {
                if (reqId === currentTtsRequestId && (e.type === 'end' || e.type === 'error')) stopSpeaking();
              }
            });
          } else if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-HK';
            utterance.rate = rate;
            utterance.onend = () => { if (reqId === currentTtsRequestId) stopSpeaking(); };
            utterance.onerror = () => { if (reqId === currentTtsRequestId) stopSpeaking(); };
            const cantoneseVoice = speechSynthesis.getVoices().find(v => v.lang.startsWith('zh-HK'));
            if (cantoneseVoice) utterance.voice = cantoneseVoice;
            speechSynthesis.speak(utterance);
          } else {
            stopSpeaking();
          }
        }
      } else if (engine === 'bertVits2') {
        try {
          const resp = await fetch('http://127.0.0.1:5000/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, speed: rate })
          });
          if (reqId !== currentTtsRequestId) return;
          if (!resp.ok) throw new Error('BertVits2 error: ' + resp.status);
          const blob = await resp.blob();
          if (reqId !== currentTtsRequestId) return;

          const audio = new Audio(URL.createObjectURL(blob));
          currentAudio = audio;
          audio.onended = () => {
            if (reqId === currentTtsRequestId) {
              URL.revokeObjectURL(audio.src);
              currentAudio = null;
              stopSpeaking();
            }
          };
          audio.onerror = () => {
            if (reqId === currentTtsRequestId) {
              currentAudio = null;
              stopSpeaking();
            }
          };
          audio.play();
        } catch (e) {
          if (reqId !== currentTtsRequestId) return;
          console.warn('[Wordbook] BertVits2 failed, falling back to Chrome TTS / WebSpeech:', e);
          if (chrome.tts) {
            chrome.tts.speak(text, {
              lang: 'zh-HK', rate: rate,
              onEvent: (e) => {
                if (reqId === currentTtsRequestId && (e.type === 'end' || e.type === 'error')) stopSpeaking();
              }
            });
          } else if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-HK';
            utterance.rate = rate;
            utterance.onend = () => { if (reqId === currentTtsRequestId) stopSpeaking(); };
            utterance.onerror = () => { if (reqId === currentTtsRequestId) stopSpeaking(); };
            speechSynthesis.speak(utterance);
          } else {
            stopSpeaking();
          }
        }
      } else if (engine === 'azureTts') {
        const action = result.azureTtsMode === 'custom' ? 'azureTtsSpeak' : 'azureTtsProxySpeak';
        const msg = { action, text, rate, azureVoice: result.azureTtsVoice || 'zh-HK-HiuMaanNeural' };
        if (result.azureTtsMode === 'custom') {
          msg.azureKey = result.azureTtsKey;
          msg.azureRegion = result.azureTtsRegion;
        }
        chrome.runtime.sendMessage(msg, (response) => {
          if (reqId !== currentTtsRequestId) return;
          if (response && response.audioData) {
            const audio = new Audio(response.audioData);
            currentAudio = audio;
            audio.onended = () => {
              if (reqId === currentTtsRequestId) {
                currentAudio = null;
                stopSpeaking();
              }
            };
            audio.onerror = () => {
              if (reqId === currentTtsRequestId) {
                currentAudio = null;
                stopSpeaking();
              }
            };
            audio.play().catch(() => {
              if (reqId === currentTtsRequestId) stopSpeaking();
            });
          } else {
            if (chrome.tts) {
              chrome.tts.speak(text, {
                lang: 'zh-HK', rate: rate,
                onEvent: (e) => {
                  if (reqId === currentTtsRequestId && (e.type === 'end' || e.type === 'error')) stopSpeaking();
                }
              });
            } else {
              stopSpeaking();
            }
          }
        });
      }
    });
  }

  // ==================== Event Handlers ====================

  // Word card events (delegated)
  wordListEl.addEventListener('click', async (e) => {
    // Single restore from trash
    const restoreSingleBtn = e.target.closest('.restore-single-btn');
    if (restoreSingleBtn && restoreSingleBtn.dataset.id) {
      e.stopPropagation();
      const id = restoreSingleBtn.dataset.id;
      const target = wordbook.find(w => w.id === id);
      if (target && target.deletedAt) {
        delete target.deletedAt;
        selectedIds.delete(id);
        await saveWordbook(wordbook);
        renderList();
        updateStats();
        updateStorage();
      }
      return;
    }

    // Single permanent delete from trash
    const delSinglePermBtn = e.target.closest('.delete-single-perm-btn');
    if (delSinglePermBtn && delSinglePermBtn.dataset.id) {
      e.stopPropagation();
      const id = delSinglePermBtn.dataset.id;
      const confirmMsg = t('wordbookDeletePermanentConfirm') || '確定要永久刪除選中的生詞嗎？此操作無法撤銷。';
      if (!confirm(confirmMsg)) return;
      wordbook = wordbook.filter(w => w.id !== id);
      selectedIds.delete(id);
      await saveWordbook(wordbook);
      renderList();
      updateStats();
      updateStorage();
      return;
    }

    // Row click selection for detail panel (only in Detail Mode)
    const row = e.target.closest('.table-row');
    if (isDetailMode && row && !e.target.closest('.bulk-actions') && !e.target.closest('.word-card-checkbox') && !e.target.closest('.word-character') && !e.target.closest('.jyutping-text') && !e.target.closest('.trash-action-btn')) {
      const charEl = row.querySelector('.word-character');
      if (charEl) {
        const character = charEl.dataset.word;
        // Toggle: clicking the same active row deselects it
        if (row.classList.contains('active-row')) {
          row.classList.remove('active-row');
          showGenericAiPanel();
          return;
        }
        document.querySelectorAll('.table-row').forEach(r => r.classList.remove('active-row'));
        row.classList.add('active-row');
        renderDetailPanel(character);
      }
    }

    // Character or Jyutping click → TTS
    const ttsTarget = e.target.closest('.word-character') || e.target.closest('.jyutping-text');
    if (ttsTarget) {
      e.stopPropagation();
      playTts(ttsTarget.dataset.word, ttsTarget);
      return;
    }

    // Checkbox
    const checkbox = e.target.closest('.word-card-checkbox');
    if (checkbox && checkbox.dataset.id) {
      const id = checkbox.dataset.id;
      if (checkbox.checked) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }
      updateSelectionUI();
      return;
    }
  });

  // Detect truncated / overflowing text on hover for Excel-like expansion (only for overflowing cells)
  wordListEl.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.excel-cell');
    if (cell) {
      const textEl = cell.querySelector('.excel-cell-text');
      if (textEl && textEl.scrollWidth > textEl.clientWidth + 1) {
        cell.classList.add('is-overflowing');
      } else {
        cell.classList.remove('is-overflowing');
      }
    }
  });

  // Select all
  selectAllCheckbox.addEventListener('change', () => {
    if (selectAllCheckbox.checked) {
      filteredWords.forEach(w => selectedIds.add(w.id));
    } else {
      filteredWords.forEach(w => selectedIds.delete(w.id));
    }
    // Re-render to update checkboxes
    renderList();
  });

  // View Switcher (All vs Trash)
  function switchView(view) {
    if (currentView === view) return;
    currentView = view;
    selectedIds.clear();

    if (trashBanner) {
      trashBanner.style.display = currentView === 'trash' ? 'flex' : 'none';
    }
    if (bulkBtnsAll) {
      bulkBtnsAll.style.display = currentView === 'all' ? 'flex' : 'none';
    }
    if (bulkBtnsTrash) {
      bulkBtnsTrash.style.display = currentView === 'trash' ? 'flex' : 'none';
    }

    renderList();
  }

  if (trashToggleBtn) trashToggleBtn.addEventListener('click', () => switchView('trash'));
  if (btnBackToAll) btnBackToAll.addEventListener('click', () => switchView('all'));

  // Bulk delete (Normal mode: soft delete to trash)
  bulkDeleteBtn.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    const msg = (t('wordbookDeleteConfirm') || '確定要刪除選中的 {n} 個詞嗎？').replace('{n}', selectedIds.size);
    if (!confirm(msg)) return;

    const now = Date.now();
    wordbook.forEach(w => {
      if (selectedIds.has(w.id)) {
        w.deletedAt = now;
      }
    });
    selectedIds.clear();
    await saveWordbook(wordbook);
    renderList();
    updateStats();
    updateStorage();
  });

  // Bulk restore (Trash mode: restore selected)
  if (bulkRestoreBtn) {
    bulkRestoreBtn.addEventListener('click', async () => {
      if (selectedIds.size === 0) return;
      wordbook.forEach(w => {
        if (selectedIds.has(w.id) && w.deletedAt) {
          delete w.deletedAt;
        }
      });
      selectedIds.clear();
      await saveWordbook(wordbook);
      renderList();
      updateStats();
      updateStorage();
    });
  }

  // Bulk permanent delete (Trash mode: permanently delete selected)
  if (bulkDeletePermanentBtn) {
    bulkDeletePermanentBtn.addEventListener('click', async () => {
      if (selectedIds.size === 0) return;
      const msg = t('wordbookDeletePermanentConfirm') || '確定要永久刪除選中的生詞嗎？此操作無法撤銷。';
      if (!confirm(msg)) return;

      wordbook = wordbook.filter(w => !selectedIds.has(w.id));
      selectedIds.clear();
      await saveWordbook(wordbook);
      renderList();
      updateStats();
      updateStorage();
    });
  }

  // Restore All (Trash mode banner action)
  if (restoreAllBtn) {
    restoreAllBtn.addEventListener('click', async () => {
      const trashItems = wordbook.filter(w => !!w.deletedAt);
      if (trashItems.length === 0) return;
      const msg = t('wordbookRestoreAllConfirm') || '確定要還原廢紙簍中的所有生詞嗎？';
      if (!confirm(msg)) return;

      wordbook.forEach(w => {
        if (w.deletedAt) delete w.deletedAt;
      });
      selectedIds.clear();
      await saveWordbook(wordbook);
      renderList();
      updateStats();
      updateStorage();
    });
  }

  // Empty Trash (Trash mode banner action)
  if (emptyTrashBtn) {
    emptyTrashBtn.addEventListener('click', async () => {
      const trashItems = wordbook.filter(w => !!w.deletedAt);
      if (trashItems.length === 0) return;
      const msg = t('wordbookEmptyTrashConfirm') || '確定要清空廢紙簍嗎？這將會永久刪除所有已刪除的生詞，無法復原。';
      if (!confirm(msg)) return;

      wordbook = wordbook.filter(w => !w.deletedAt);
      selectedIds.clear();
      await saveWordbook(wordbook);
      renderList();
      updateStats();
      updateStorage();
    });
  }

  // ==================== Export ====================

  async function doExport(format) {
    const allWb = await getWordbook();
    const wb = allWb.filter(w => !w.deletedAt);

    let content, mimeType, ext;

    switch (format) {
      case 'json':
        content = JSON.stringify(wb, null, 2);
        mimeType = 'application/json';
        ext = 'json';
        break;

      case 'csv': {
        const header = '漢字,粵拼,Yale,英文釋義,添加日期,來源\n';
        const rows = wb.map(w =>
          `"${w.character}","${w.jyutping}","${w.yale || ''}","${(w.english || []).join('; ')}","${new Date(w.timestamp).toLocaleDateString()}","${w.sourceUrl || ''}"`
        ).join('\n');
        content = '\uFEFF' + header + rows;
        mimeType = 'text/csv;charset=utf-8';
        ext = 'csv';
        break;
      }

      case 'markdown': {
        const mdHeader = '| 漢字 | 粵拼 | 英文 | 日期 |\n|------|------|------|------|\n';
        const mdRows = wb.map(w =>
          `| ${w.character} | ${w.jyutping} | ${(w.english || []).join('; ')} | ${new Date(w.timestamp).toLocaleDateString()} |`
        ).join('\n');
        content = `# 我的粵語生詞本\n\n共 ${wb.length} 詞\n\n${mdHeader}${mdRows}\n`;
        mimeType = 'text/markdown';
        ext = 'md';
        break;
      }

      case 'txt':
        content = wb.map(w =>
          `${w.character}\t${w.jyutping}\t${(w.english || []).join('; ')}`
        ).join('\n');
        mimeType = 'text/plain';
        ext = 'txt';
        break;

      default:
        return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wordbook_${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==================== Import ====================

  let pendingImportData = null;

  importBtn.addEventListener('click', () => {
    importModal.classList.add('show');
    document.body.classList.add('modal-open');
    exportMenu.classList.remove('show');
    resetImportUI();
  });

  importCancelBtn.addEventListener('click', () => {
    importModal.classList.remove('show');
    document.body.classList.remove('modal-open');
    resetImportUI();
  });

  importModal.addEventListener('click', (e) => {
    if (e.target === importModal) {
      importModal.classList.remove('show');
      document.body.classList.remove('modal-open');
      resetImportUI();
    }
  });

  chooseFileLink.addEventListener('click', (e) => {
    e.preventDefault();
    importFileInput.click();
  });

  dropZone.addEventListener('click', () => {
    importFileInput.click();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processImportFile(file);
  });

  importFileInput.addEventListener('change', () => {
    if (importFileInput.files[0]) {
      processImportFile(importFileInput.files[0]);
    }
  });

  function resetImportUI() {
    pendingImportData = null;
    importPreview.style.display = 'none';
    importPreview.innerHTML = '';
    importConfirmBtn.style.display = 'none';
    importFileInput.value = '';
    dropZone.style.display = 'block';
  }

  async function processImportFile(file) {
    const text = await file.text();
    let data;

    try {
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('JSON must be an array');
      } else if (file.name.endsWith('.csv')) {
        data = parseCSV(text);
      } else {
        throw new Error('Unsupported file format');
      }
    } catch (err) {
      importPreview.innerHTML = `<span style="color: #ef4444">❌ ${err.message}</span>`;
      importPreview.style.display = 'block';
      return;
    }

    // Preview
    const existingChars = new Set(wordbook.map(w => w.character));
    let newCount = 0, skipCount = 0;
    data.forEach(item => {
      if (existingChars.has(item.character)) skipCount++;
      else newCount++;
    });

    pendingImportData = data;
    dropZone.style.display = 'none';
    importPreview.innerHTML = `
      <p>📄 <strong>${file.name}</strong></p>
      <p>總詞數：${data.length}</p>
      <p>新增：<strong>${newCount}</strong> | 重複（跳過）：${skipCount}</p>
    `;
    importPreview.style.display = 'block';
    importConfirmBtn.style.display = 'inline-flex';
  }

  importConfirmBtn.addEventListener('click', async () => {
    if (!pendingImportData) return;

    const existingChars = new Set(wordbook.map(w => w.character));
    let added = 0, skipped = 0;

    for (const item of pendingImportData) {
      if (!item.character || existingChars.has(item.character)) {
        skipped++;
        continue;
      }

      wordbook.unshift({
        id: 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
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
      });
      existingChars.add(item.character);
      added++;
    }

    await saveWordbook(wordbook);
    importModal.classList.remove('show');
    resetImportUI();
    renderList();
    updateStats();
    updateStorage();

    alert(t('wordbookImportSuccess').replace('{added}', added).replace('{skipped}', skipped));
  });

  function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    // Auto-detect header
    const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

    return lines.slice(1).map(line => {
      const cols = line.match(/(".*?"|[^",]+|(?<=,)(?=,))/g) || [];
      const clean = cols.map(c => c.replace(/^"|"$/g, '').trim());

      const charIdx = header.findIndex(h => /漢字|character|字/i.test(h));
      const jpIdx = header.findIndex(h => /粵拼|jyutping/i.test(h));
      const yaleIdx = header.findIndex(h => /yale/i.test(h));
      const enIdx = header.findIndex(h => /英文|english|釋義|definition/i.test(h));

      return {
        character: clean[charIdx !== -1 ? charIdx : 0] || '',
        jyutping: clean[jpIdx !== -1 ? jpIdx : 1] || '',
        yale: clean[yaleIdx !== -1 ? yaleIdx : 2] || '',
        english: (clean[enIdx !== -1 ? enIdx : 3] || '').split(';').map(s => s.trim()).filter(Boolean)
      };
    }).filter(item => item.character);
  }

  // ==================== Detail Panel Rendering ====================

  function renderAiResponseBubble(container, replyText, elapsed, onRetry, question, targetWord) {
    if (!container) return;
    const copyLabel = t('aiActionCopy') || '複製內容';
    const copiedLabel = t('aiActionCopied') || '已複製';
    const retryLabel = t('aiActionRegenerate') || '重新生成';
    const feedbackLabel = t('aiActionFeedback') || '反饋與建議';

    const bubble = document.createElement('div');
    bubble.className = 'ai-response-bubble';
    bubble.innerHTML = `
      <div class="ai-response-meta">
        <span class="ai-badge">AI</span>
        <span class="ai-timing">思考了 ${elapsed}s</span>
      </div>
      <div class="ai-response-content">${renderMarkdown(replyText)}</div>
      <div class="ai-response-actions">
        <button class="ai-action-btn ai-copy-btn" title="${copyLabel}" aria-label="${copyLabel}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        ${onRetry ? `
        <button class="ai-action-btn ai-retry-btn" title="${retryLabel}" aria-label="${retryLabel}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
        ` : ''}
        <div class="ai-action-spacer"></div>
        <button class="ai-action-btn ai-feedback-btn" title="${feedbackLabel}" aria-label="${feedbackLabel}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <line x1="9" y1="9" x2="15" y2="9"></line>
            <line x1="9" y1="13" x2="13" y2="13"></line>
          </svg>
        </button>
      </div>
    `;

    // Copy event handler
    const copyBtn = bubble.querySelector('.ai-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(replyText);
          copyBtn.classList.add('is-copied');
          copyBtn.title = copiedLabel;
          copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          setTimeout(() => {
            copyBtn.classList.remove('is-copied');
            copyBtn.title = copyLabel;
            copyBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            `;
          }, 2000);
        } catch (err) {
          console.error('Failed to copy AI reply:', err);
        }
      });
    }

    // Retry event handler
    const retryBtn = bubble.querySelector('.ai-retry-btn');
    if (retryBtn && typeof onRetry === 'function') {
      retryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        onRetry();
      });
    }

    // Feedback event handler (Open In-app Email Feedback Modal)
    const feedbackBtn = bubble.querySelector('.ai-feedback-btn');
    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openAiFeedbackModal(question, replyText, targetWord);
      });
    }

    container.innerHTML = '';
    container.appendChild(bubble);
  }

  function showGenericAiPanel() {
    const detailPane = document.getElementById('detailPane');
    if (!detailPane) return;
    detailPane.style.display = 'flex';
    delete detailPane.dataset.activeWord;

    detailPane.innerHTML = `
      <div class="detail-scroll-body" id="detailScrollBody">
        <div class="detail-empty-state" style="flex: 1;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 8px;">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <p style="font-size: 13px; margin: 0;">${t('wordbookEmptyDetail1') || '點擊左側單詞查看詳情'}</p>
          <p style="font-size: 11px; margin: 4px 0 0; opacity: 0.6;">${t('wordbookEmptyDetail2') || '或直接在下方提問'}</p>
        </div>
        <div class="ai-response-area" id="aiResponseArea"></div>
      </div>
      <div class="ai-chat-section" id="aiChatSection">
        <div class="ai-chat-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          ${t('wordbookAiChat') || 'AI 問答'}

          <button class="ai-settings-btn" id="openAiSettingsBtn" title="${t('wordbookAiSettingsTitle') || 'AI 設定'}" style="margin-left: auto; background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 4px; opacity: 0.6; transition: opacity 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
        <div class="ai-input-row">
          <input class="ai-input" id="aiChatInput" type="text" placeholder="${t('wordbookAiInputPlaceholderGeneric') || '問任何關於粵語的問題...'}" />
          <button class="ai-send-btn" id="aiSendBtn" title="發送">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    `;

    // Bind generic AI chat
    
    const aiSettingsBtn = document.getElementById('openAiSettingsBtn');
    if (aiSettingsBtn) {
      aiSettingsBtn.addEventListener('click', openAiSettingsModal);
    }

    const aiChatSection = document.getElementById('aiChatSection');
    const aiChatInput = document.getElementById('aiChatInput');
    const aiSendBtn = document.getElementById('aiSendBtn');
    const aiResponseArea = document.getElementById('aiResponseArea');

    if (!aiChatSection) return;

    chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel'], (settings) => {
      const { aiBaseUrl, aiApiKey, aiModel } = settings;
      if (!aiBaseUrl || !aiApiKey || !aiModel) {
        aiChatSection.querySelector('.ai-input-row').style.display = 'none';
        aiResponseArea.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">尚未配置 AI API，<a id="aiGoToSettings" style="color: var(--primary); cursor: pointer; text-decoration: none;">前往設定</a></div>`;
        const goBtn = document.getElementById('aiGoToSettings');
        if (goBtn) goBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openOptionsPage' }));
        return;
      }
    });

    let aiChatHistory = [];
    let aiIsLoading = false;

    const sendGenericQuestion = (question) => {
      if (!question.trim() || aiIsLoading) return;
      aiIsLoading = true;
      aiSendBtn.disabled = true;
      aiChatInput.disabled = true;
      const startTime = performance.now();

      aiResponseArea.innerHTML = `
        <div class="ai-typing-indicator">
          <div class="ai-typing-dot"></div>
          <div class="ai-typing-dot"></div>
          <div class="ai-typing-dot"></div>
        </div>
      `;
      setTimeout(() => {
        aiResponseArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);

      chrome.runtime.sendMessage({
        action: 'aiChatQuery',
        word: '',
        sentence: '',
        originalTranslation: '',
        question: question,
        history: aiChatHistory,
        systemPrompt: globalAiCustomSystemPrompt
      }, (response) => {
        aiIsLoading = false;
        aiSendBtn.disabled = false;
        aiChatInput.disabled = false;
        aiChatInput.focus();
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

        if (response && response.success) {
          aiChatHistory.push({ role: 'user', content: question });
          aiChatHistory.push({ role: 'assistant', content: response.reply });
          renderAiResponseBubble(aiResponseArea, response.reply, elapsed, () => sendGenericQuestion(question), question, '');
        } else {
          const errMsg = response?.error || '請求失敗';
          aiResponseArea.innerHTML = `<div class="ai-response-bubble"><div class="ai-response-meta"><span class="ai-badge">AI</span><span class="ai-timing">${elapsed}s</span></div><div class="ai-response-content" style="color: var(--text-muted);">${escapeHtml(errMsg)}</div></div>`;
        }
        setTimeout(() => {
          aiResponseArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      });
    };

    aiSendBtn.addEventListener('click', () => {
      sendGenericQuestion(aiChatInput.value);
      aiChatInput.value = '';
    });

    aiChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        sendGenericQuestion(aiChatInput.value);
        aiChatInput.value = '';
      }
    });
  }

  function renderDetailPanel(character) {
    const detailPane = document.getElementById('detailPane');
    if (!detailPane) return;
    
    detailPane.style.display = 'flex';
    detailPane.dataset.activeWord = character;

    if (!dictionary || !dictionary[character]) {
      detailPane.innerHTML = `
        <div class="dict-not-found">
          <p>${(t('dictSearchNoDetail') || '詞典中未找到 <strong>$1</strong> 的詳細釋義。').replace('$1', character)}</p>
        </div>
      `;
      return;
    }

    const entry = dictionary[character];
    const pronunciation = entry.jyutping || '';
    const isSaved = wordbook.some(w => w.character === character);
    
    // Header
    let html = `
      <div class="detail-scroll-body" id="detailScrollBody">
        <div id="cantonese-popup-dict" style="position: static; width: 100%; filter: none; margin: 0; padding: 0; background: transparent;">
          <div class="popup-main" style="width: 100%; min-width: auto; padding: 0; position: relative;">
          <!-- Action Buttons -->
          <div class="detail-actions-wrapper" id="detailActionsWrapper">
            <div class="detail-report-btn" id="detailReportBtn" title="報告錯誤">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 3px;">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
              <span>報告</span>
            </div>
            <div class="detail-bookmark-btn" id="detailBookmarkBtn" title="${isSaved ? '從生詞本移除' : '加入生詞本'}">
              <svg width="14" height="14" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                ${isSaved
                  ? '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#D4AF37" stroke="#D4AF37" stroke-width="1.5"></polygon>'
                  : '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" stroke-width="1.5"></polygon>'
                }
              </svg>
            </div>
          </div>
          <div class="word-section" style="cursor: pointer; border-bottom: none; padding-bottom: 0;" id="detailWordSection">
            <span class="word-text" style="font-size: 28px;">${entry.traditional}</span>
            ${entry.simplified !== entry.traditional ? `<span class="word-simplified" style="font-size: 18px;">${entry.simplified}</span>` : ''}
          </div>
    `;

    if (pronunciation) {
      html += `
        <div class="pronunciation-section" style="margin-top: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--popup-divider-strong); padding-bottom: 12px;">
          <span class="pronunciation-label">粵拼:</span>
          <span class="pronunciation-text" id="detailPronunciationText" style="cursor: pointer; font-size: 15px;">${pronunciation}</span>
          <button class="tts-speaker-btn" id="detailSpeakerBtn" title="播放發音" aria-label="播放發音">
            <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </button>
        </div>
      `;
    }

    // Definitions
    if (entry.english && entry.english.length > 0) {
      const badgeTitle = t('badgeClickToTranslate') || '點擊翻譯此釋義';
      const defItems = entry.english.slice(0, 10).map((def, idx) => {
        let className = 'def-item';
        let innerHtml = '';

        if (def.startsWith('[粵]')) {
          className += ' def-yue';
          const rawDefText = def.slice(3).trim();
          innerHtml = `<span class="badge-yue" data-text="${rawDefText.replace(/"/g, '&quot;')}" title="${badgeTitle}" role="button">粵<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></span><span class="def-content-text">${rawDefText}</span>`;
        } else {
          innerHtml = `<span>${def}</span>`;
        }
        
        let exampleHtml = '';
        if (entry.examples && entry.examples[idx] && entry.examples[idx].length > 0) {
          const exList = entry.examples[idx].map(ex => `
            <div class="example-item" style="margin-bottom: 6px; cursor: text;">
              <div style="color: var(--text-primary); font-size: 15px; display: flex; align-items: center;">
                <span>${ex.yue}</span>
                <button class="tts-speaker-btn example-tts-btn" data-text="${ex.yue.replace(/"/g, '&quot;')}" title="播放發音" aria-label="播放發音" style="margin-left: 6px; transform: scale(0.85); transform-origin: left center; cursor: pointer; border: none; background: transparent;">
                  <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                  </svg>
                </button>
              </div>
              <div style="color: var(--text-muted); font-size: 13px; margin-top: 2px;">${ex.eng}</div>
            </div>
          `).join('');
          
          exampleHtml = `
            <div class="def-examples" style="display: none; margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--primary);">
              ${exList}
            </div>
          `;
          
          // Make the definition clickable to expand examples
          return `
            <div class="${className} has-inline-examples" style="position: relative;">
              <div class="def-text" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <div>${innerHtml}</div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; flex-shrink: 0; margin-left: 8px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              ${exampleHtml}
            </div>
          `;
        }
        
        return `<div class="${className}" style="display: flex; flex-direction: column;"><div>${innerHtml}</div></div>`;
      }).join('');
      
      html += `
        <div class="definition-section">
          ${defItems}
        </div>
      `;
    }
    
    // Related Words
    const refLines = [];
    if (entry.sims && entry.sims.length > 0) {
      const simLinks = entry.sims.map(w => `<span class="see-also-link" data-word="${w}">${w}</span>`).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">近義：</span>${simLinks}</div>`);
    }
    if (entry.ants && entry.ants.length > 0) {
      const antLinks = entry.ants.map(w => `<span class="see-also-link" data-word="${w}">${w}</span>`).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">反義：</span>${antLinks}</div>`);
    }
    if (entry.see_also && entry.see_also.length > 0) {
      const seeLinks = entry.see_also.map(w => `<span class="see-also-link" data-word="${w}">${w}</span>`).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">異體：</span>${seeLinks}</div>`);
    }
    
    if (refLines.length > 0) {
      html += `<div class="see-also-section" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--popup-divider-strong);">${refLines.join('')}</div>`;
    }

    // Report Form (hidden by default)
    html += `
      <div class="detail-report-form" id="detailReportForm" style="display: none;">
        <div class="detail-report-header">
          <span>報告錯誤</span>
          <span class="detail-report-close" id="detailReportClose">✕</span>
        </div>
        <div class="detail-report-preview">
          <div><strong>詞語：</strong><span id="detailReportWord">${character}</span></div>
        </div>
        <textarea id="detailReportTextarea" class="detail-report-textarea" placeholder="請描述具體的錯誤（例如讀音不正確、釋義有誤等）..."></textarea>
        <div class="detail-report-actions">
          <button class="btn" id="detailReportCancelBtn">取消</button>
          <button class="btn btn-primary" id="detailReportSendBtn">發送報告</button>
        </div>
      </div>
    `;

    // Close popup-main and cantonese-popup-dict first
    html += `
        </div>
      </div>
    `;

    // AI Response Area — placed inside the scroll body below dictionary content
    html += `
        <div class="ai-response-area" id="aiResponseArea"></div>
      </div>
    `;

    // Fixed AI Chat Controls at Bottom
    html += `
      <div class="ai-chat-section" id="aiChatSection">
        <div class="ai-chat-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          ${t('wordbookAiChat') || 'AI 問答'}

          <button class="ai-settings-btn" id="openAiSettingsBtn" title="${t('wordbookAiSettingsTitle') || 'AI 設定'}" style="margin-left: auto; background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 4px; opacity: 0.6; transition: opacity 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
        <div class="ai-quick-questions" id="aiQuickQuestions" ${globalAiQuickActions.some(a => a.active) ? '' : 'style="display: none;"'}>
          ${globalAiQuickActions.filter(a => a.active).map(a => {
            const label = a.isDefault ? t(a.labelKey) : a.label;
            const prompt = a.isDefault ? t(a.promptKey) : a.prompt;
            return `<button class="ai-quick-btn" data-q="${prompt}">${label}</button>`;
          }).join('')}
        </div>
        <div class="ai-input-row">
          <input class="ai-input" id="aiChatInput" type="text" placeholder="${(t('wordbookAiInputPlaceholder') || '問關於「$1」的問題...').replace('$1', character)}" data-word="${character}" />
          <button class="ai-send-btn" id="aiSendBtn" title="發送">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    `;

    detailPane.innerHTML = html;

    const aiSettingsBtn = document.getElementById('openAiSettingsBtn');
    if (aiSettingsBtn) {
      aiSettingsBtn.addEventListener('click', openAiSettingsModal);
    }

    // Bind TTS
    const triggerTTS = () => playTts(entry.traditional, document.getElementById('detailSpeakerBtn'));
    const wordSec = document.getElementById('detailWordSection');
    const pronText = document.getElementById('detailPronunciationText');
    const speakBtn = document.getElementById('detailSpeakerBtn');
    
    if (wordSec) wordSec.addEventListener('click', triggerTTS);
    if (pronText) pronText.addEventListener('click', triggerTTS);
    if (speakBtn) speakBtn.addEventListener('click', triggerTTS);
    
    // Bind Example Toggles
    detailPane.querySelectorAll('.has-inline-examples .def-text').forEach(defText => {
      defText.addEventListener('click', (e) => {
        const parent = e.currentTarget.closest('.has-inline-examples');
        const examplesDiv = parent ? parent.querySelector('.def-examples') : null;
        if (!examplesDiv) return;
        const icon = e.currentTarget.querySelector('svg');
        if (examplesDiv.style.display === 'none') {
          examplesDiv.style.display = 'block';
          icon.style.transform = 'rotate(180deg)';
        } else {
          examplesDiv.style.display = 'none';
          icon.style.transform = '';
        }
      });
    });

    // 高可用釋義翻譯請求函數（Background + Client Direct Fallback）
    async function requestYueDefTranslation(text, targetLang, engine) {
      // 1. 優先嘗試發送給後台 Service Worker（帶 4 秒超時保障）
      try {
        const bgPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Background timeout')), 4000);
          chrome.runtime.sendMessage({
            action: 'translateYueDef',
            text: text,
            targetLang: targetLang,
            engine: engine
          }, (resp) => {
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          });
        });
        const bgResp = await bgPromise;
        if (bgResp && bgResp.success && bgResp.translation) {
          return bgResp.translation;
        }
      } catch (bgErr) {
        console.warn('[Wordbook] Background translation failed/timed out, trying direct client fetch:', bgErr);
      }

      // 2. 前端直連 Google GTX 免費翻譯通道
      try {
        let googleTo = 'zh-CN';
        if (targetLang === 'en') googleTo = 'en';
        else if (targetLang === 'ja') googleTo = 'ja';
        else if (targetLang === 'ko') googleTo = 'ko';
        else if (targetLang === 'zh-Hant' || targetLang === 'zh-TW' || targetLang === 'zh-HK') googleTo = 'zh-TW';

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${googleTo}&dt=t&q=${encodeURIComponent(text)}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data[0] && Array.isArray(data[0])) {
            const directRes = data[0].map(item => item[0]).filter(Boolean).join('');
            if (directRes) return directRes;
          }
        }
      } catch (directErr) {
        console.warn('[Wordbook] Direct Google GTX failed:', directErr);
      }

      // 3. 前端直連 MyMemory 免費翻譯通道
      try {
        let target = targetLang || 'zh-CN';
        if (target === 'zh-Hans') target = 'zh-CN';
        else if (target === 'zh-Hant' || target === 'zh-HK') target = 'zh-TW';
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-HK|${target}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.responseData && data.responseData.translatedText) return data.responseData.translatedText;
        }
      } catch (myMemErr) {
        console.warn('[Wordbook] Direct MyMemory failed:', myMemErr);
      }

      throw new Error('All translation channels failed');
    }

    // 獲取翻譯目標語言對應的標籤文字（如：普、書、英、日、韓）
    function getTargetLangLabel(targetLang) {
      switch (targetLang) {
        case 'zh-Hans':
        case 'zh-CN':
          return '普';
        case 'zh-Hant':
        case 'zh-TW':
        case 'zh-HK':
          return '書';
        case 'en':
          return '英';
        case 'ja':
          return '日';
        case 'ko':
          return '韓';
        default:
          return '譯';
      }
    }

    // Bind [粵] Badge Click-to-Translate
    async function translateWordbookBadge(badgeEl, containerEl) {
      const text = badgeEl.dataset.text;
      if (!text) return;

      const targetLang = autoTranslateYueDefsTargetLang || 'zh-Hans';
      const engine = autoTranslateYueDefsEngine || 'google';
      const mode = yueDefDisplayMode || 'expand';
      const cacheKey = `${engine}_${targetLang}_${text}`;
      const cached = yueDefTranslationCache.get(cacheKey);
      const langLabel = getTargetLangLabel(targetLang);

      const yueIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
      const toggleIconSvg = `<svg class="trans-toggle-icon" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>`;

      if (mode === 'replace') {
        // Mode B: 原位替換
        const textSpan = containerEl.querySelector('.def-content-text');
        if (!textSpan) return;

        // 如果目前已經是替換後的譯文狀態，再次點擊則切換回粵語原文
        if (containerEl.dataset.isReplaced === 'true') {
          containerEl.dataset.isReplaced = 'false';
          badgeEl.className = 'badge-yue';
          badgeEl.innerHTML = `粵${yueIconSvg}`;
          badgeEl.title = t('badgeClickToTranslate') || '點擊翻譯此釋義';
          textSpan.textContent = text;
          return;
        }

        // 切換為譯文狀態
        if (cached) {
          containerEl.dataset.isReplaced = 'true';
          badgeEl.className = 'badge-trans-lang badge-clickable';
          badgeEl.innerHTML = `${langLabel}${toggleIconSvg}`;
          badgeEl.title = t('badgeClickToRestore') || '點擊切換回粵語原文';
          textSpan.textContent = cached;
          return;
        }

        // 異步請求翻譯
        const originalBadgeHtml = badgeEl.innerHTML;
        const originalBadgeClass = badgeEl.className;
        badgeEl.classList.add('loading');
        textSpan.textContent = t('badgeTranslating') || '翻譯中...';

        try {
          const translation = await requestYueDefTranslation(text, targetLang, engine);
          badgeEl.classList.remove('loading');
          if (translation) {
            yueDefTranslationCache.set(cacheKey, translation);
            containerEl.dataset.isReplaced = 'true';
            badgeEl.className = 'badge-trans-lang badge-clickable';
            badgeEl.innerHTML = `${langLabel}${toggleIconSvg}`;
            badgeEl.title = t('badgeClickToRestore') || '點擊切換回粵語原文';
            textSpan.textContent = translation;
          } else {
            badgeEl.className = originalBadgeClass;
            badgeEl.innerHTML = originalBadgeHtml;
            textSpan.textContent = text;
          }
        } catch (e) {
          badgeEl.classList.remove('loading');
          badgeEl.className = originalBadgeClass;
          badgeEl.innerHTML = originalBadgeHtml;
          textSpan.textContent = text;
        }
      } else {
        // Mode A: 下方展開
        let transEl = containerEl.querySelector('.yue-def-translation');
        if (transEl) {
          transEl.style.display = (transEl.style.display === 'none') ? 'flex' : 'none';
          return;
        }

        const langBadgeHtml = `<span class="badge-trans-lang">${langLabel}</span>`;
        transEl = document.createElement('div');
        transEl.className = 'yue-def-translation';
        const defTextEl = containerEl.querySelector('.def-text');
        if (defTextEl) {
          defTextEl.insertAdjacentElement('afterend', transEl);
        } else {
          containerEl.appendChild(transEl);
        }

        if (cached) {
          transEl.innerHTML = `${langBadgeHtml}<span>${cached}</span>`;
          return;
        }

        const translatingText = t('badgeTranslating') || '翻譯中...';
        transEl.classList.add('loading');
        transEl.innerHTML = `${langBadgeHtml}<span>${translatingText}</span>`;

        try {
          const translation = await requestYueDefTranslation(text, targetLang, engine);
          transEl.classList.remove('loading');
          if (translation) {
            yueDefTranslationCache.set(cacheKey, translation);
            transEl.innerHTML = `${langBadgeHtml}<span>${translation}</span>`;
          } else {
            transEl.innerHTML = `${langBadgeHtml}<span style="color: var(--text-muted); opacity: 0.7;">${t('badgeTranslationError') || '翻譯失敗'}</span>`;
          }
        } catch (e) {
          transEl.classList.remove('loading');
          transEl.innerHTML = `${langBadgeHtml}<span style="color: var(--text-muted); opacity: 0.7;">${t('badgeTranslationError') || '翻譯失敗'}</span>`;
        }
      }
    }

    detailPane.querySelectorAll('.badge-yue').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const parentDef = badge.closest('.def-item');
        if (parentDef) {
          translateWordbookBadge(badge, parentDef);
        }
      });
    });

    if (enableAutoTranslateYueDefs) {
      detailPane.querySelectorAll('.badge-yue').forEach(badge => {
        const parentDef = badge.closest('.def-item');
        if (parentDef) {
          translateWordbookBadge(badge, parentDef);
        }
      });
    }

    // Bind Example TTS
    detailPane.querySelectorAll('.example-tts-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playTts(btn.dataset.text, btn);
      });
    });

    // Bind See Also Links
    detailPane.querySelectorAll('.see-also-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const word = link.dataset.word;
        if (dictionary[word]) {
          renderDetailPanel(word);
          // Highlight in list if exists
          document.querySelectorAll('.table-row').forEach(r => {
            r.classList.remove('active-row');
            const charEl = r.querySelector('.word-character');
            if (charEl && charEl.dataset.word === word) {
              r.classList.add('active-row');
              r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          });
        }
      });
    });

    // Bind Bookmark Button
    const bookmarkBtn = document.getElementById('detailBookmarkBtn');
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Bounce animation
        bookmarkBtn.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
        bookmarkBtn.style.transform = 'scale(1.3)';
        setTimeout(() => { bookmarkBtn.style.transform = 'scale(1)'; }, 200);

        const isSavedNow = wordbook.some(w => w.character === character);
        if (isSavedNow) {
          // Remove from wordbook
          wordbook = wordbook.filter(w => w.character !== character);
          await saveWordbook(wordbook);
          renderList();
          updateStats();
          updateStorage();
          // Update button state
          const svg = bookmarkBtn.querySelector('svg');
          svg.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" stroke-width="1.5"></polygon>';
          bookmarkBtn.title = '加入生詞本';
        } else {
          // Add to wordbook
          const newWord = {
            id: 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            character: character,
            simplified: entry.simplified || character,
            jyutping: entry.jyutping || '',
            yale: entry.yale || '',
            english: entry.english || [],
            timestamp: Date.now(),
            sourceUrl: '',
            sourceTitle: '',
            tags: [],
            notes: ''
          };
          wordbook.unshift(newWord);
          await saveWordbook(wordbook);
          renderList();
          updateStats();
          updateStorage();
          // Update button state
          const svg = bookmarkBtn.querySelector('svg');
          svg.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#D4AF37" stroke="#D4AF37" stroke-width="1.5"></polygon>';
          bookmarkBtn.title = '從生詞本移除';
        }
      });
    }

    // Bind Report Button
    const reportBtn = document.getElementById('detailReportBtn');
    const reportForm = document.getElementById('detailReportForm');
    const reportClose = document.getElementById('detailReportClose');
    const reportCancel = document.getElementById('detailReportCancelBtn');
    const reportSend = document.getElementById('detailReportSendBtn');

    if (reportBtn && reportForm) {
      reportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        reportForm.style.display = 'block';
      });

      const closeReport = () => {
        reportForm.style.display = 'none';
        const textarea = document.getElementById('detailReportTextarea');
        if (textarea) textarea.value = '';
      };

      if (reportClose) reportClose.addEventListener('click', closeReport);
      if (reportCancel) reportCancel.addEventListener('click', closeReport);

      if (reportSend) {
        reportSend.addEventListener('click', async (e) => {
          e.stopPropagation();
          const originalText = reportSend.textContent;
          reportSend.textContent = '發送中...';
          reportSend.style.opacity = '0.8';
          reportSend.style.pointerEvents = 'none';

          const userDesc = document.getElementById('detailReportTextarea').value;
          const subject = `[Jyutping Extension] 錯誤報告: ${character}`;
          const message = `【單詞】：${character}\n【來源】：生詞本詞典面板\n\n【錯誤描述】：\n${userDesc || '未提供具體描述'}`;

          try {
            const response = await fetch('https://api.web3forms.com/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({
                access_key: 'd19a0594-b64b-4593-b0e1-baf1cbeb6a4c',
                subject,
                from_name: 'Jyutping Extension',
                message
              })
            });
            const result = await response.json();
            if (response.status === 200) {
              reportSend.textContent = '✓ 報告已送出';
              reportSend.style.background = '#4caf50';
              reportSend.style.borderColor = '#4caf50';
            } else {
              reportSend.textContent = '❌ 發送失敗';
              reportSend.style.background = '#f44336';
              reportSend.style.borderColor = '#f44336';
              console.error('Email API Error:', result);
            }
          } catch (error) {
            reportSend.textContent = '❌ 網絡錯誤';
            reportSend.style.background = '#f44336';
            reportSend.style.borderColor = '#f44336';
            console.error('Network Error:', error);
          }

          setTimeout(() => {
            reportSend.textContent = originalText;
            reportSend.style.background = '';
            reportSend.style.borderColor = '';
            reportSend.style.opacity = '1';
            reportSend.style.pointerEvents = 'auto';
            closeReport();
          }, 1500);
        });
      }
    }

    // ==================== AI Chat Section Binding ====================
    const aiChatSection = document.getElementById('aiChatSection');
    const aiChatInput = document.getElementById('aiChatInput');
    const aiSendBtn = document.getElementById('aiSendBtn');
    const aiResponseArea = document.getElementById('aiResponseArea');
    const aiQuickQuestions = document.getElementById('aiQuickQuestions');

    if (aiChatSection) {
      // Check if AI is configured
      chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel'], (settings) => {
        const { aiBaseUrl, aiApiKey, aiModel } = settings;
        if (!aiBaseUrl || !aiApiKey || !aiModel) {
          // Show subtle hint at bottom
          aiChatSection.querySelector('.ai-quick-questions').style.display = 'none';
          aiChatSection.querySelector('.ai-input-row').style.display = 'none';
          aiResponseArea.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">尚未配置 AI API，<a id="aiGoToSettings" style="color: var(--primary); cursor: pointer; text-decoration: none;">前往設定</a></div>`;
          const goBtn = document.getElementById('aiGoToSettings');
          if (goBtn) {
            goBtn.addEventListener('click', () => {
              chrome.runtime.sendMessage({ action: 'openOptionsPage' });
            });
          }
          return;
        }
      });

      let aiChatHistory = [];
      let aiIsLoading = false;

      const sendAiQuestion = (question) => {
        if (!question.trim() || aiIsLoading) return;
        aiIsLoading = true;
        aiSendBtn.disabled = true;
        aiChatInput.disabled = true;

        const startTime = performance.now();

        // Show typing indicator
        aiResponseArea.innerHTML = `
          <div class="ai-typing-indicator">
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
          </div>
        `;
        setTimeout(() => {
          aiResponseArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);

        // Build context from dictionary entry
        const definitions = (entry.english || [])
          .filter(d => d)
          .map(d => typeof d === 'string' ? d : '')
          .filter(Boolean)
          .join('; ');

        chrome.runtime.sendMessage({
          action: 'aiChatQuery',
          word: character,
          sentence: `${character}（${pronunciation}）：${definitions}`,
          originalTranslation: definitions,
          question: question,
          history: aiChatHistory,
          systemPrompt: globalAiCustomSystemPrompt
        }, (response) => {
          aiIsLoading = false;
          aiSendBtn.disabled = false;
          aiChatInput.disabled = false;
          aiChatInput.focus();

          const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

          if (response && response.success) {
            // Add to conversation history
            aiChatHistory.push({ role: 'user', content: question });
            aiChatHistory.push({ role: 'assistant', content: response.reply });
            const targetWordStr = character ? `${character}${pronunciation ? ` (${pronunciation})` : ''}` : '';
            renderAiResponseBubble(aiResponseArea, response.reply, elapsed, () => sendAiQuestion(question), question, targetWordStr);
          } else {
            const errMsg = response?.error || '請求失敗';
            aiResponseArea.innerHTML = `<div class="ai-response-bubble"><div class="ai-response-meta"><span class="ai-badge">AI</span><span class="ai-timing">${elapsed}s</span></div><div class="ai-response-content" style="color: var(--text-muted);">${escapeHtml(errMsg)}</div></div>`;
          }
          setTimeout(() => {
            aiResponseArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 50);
        });
      };

      // Bind send button
      if (aiSendBtn) {
        aiSendBtn.addEventListener('click', () => {
          sendAiQuestion(aiChatInput.value);
          aiChatInput.value = '';
        });
      }

      // Bind Enter key
      if (aiChatInput) {
        aiChatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            sendAiQuestion(aiChatInput.value);
            aiChatInput.value = '';
          }
        });
      }

      // Bind quick question buttons
      if (aiQuickQuestions) {
        aiQuickQuestions.querySelectorAll('.ai-quick-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const q = btn.dataset.q;
            aiChatInput.value = q;
            sendAiQuestion(q);
            aiChatInput.value = '';
          });
        });
      }
    }
  }

  // ==================== Storage Change Listener ====================

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[WORDBOOK_KEY]) {
      wordbook = changes[WORDBOOK_KEY].newValue || [];
      renderList();
      updateStats();
      updateStorage();
    }
  });

  // ==================== Init ====================

  async function init() {
    initTheme();

    // Detect language
    chrome.storage.local.get(['extensionLang'], (res) => {
      if (res.extensionLang) currentLang = res.extensionLang;
      applyI18n();
    });

    // Load wordbook
    wordbook = await getWordbook();
    
    // Load dictionary for the detail panel
    try {
      const url = chrome.runtime.getURL('dictionary.json');
      const res = await fetch(url);
      dictionary = await res.json();
    } catch (e) {
      console.error('Failed to load dictionary.json', e);
      dictionary = {};
    }

    // Detail Mode Toggle
    const detailModeToggleBtn = document.getElementById('detailModeToggleBtn');
    if (detailModeToggleBtn) {
      document.body.classList.toggle('detail-mode-active', isDetailMode);
      if (isDetailMode) {
        detailModeToggleBtn.classList.add('btn-primary', 'active');
        showGenericAiPanel();
      } else {
        detailModeToggleBtn.classList.remove('btn-primary', 'active');
      }

      detailModeToggleBtn.addEventListener('click', () => {
        isDetailMode = !isDetailMode;
        localStorage.setItem('jyutping_detail_mode', isDetailMode);
        document.body.classList.toggle('detail-mode-active', isDetailMode);
        
        if (isDetailMode) {
          detailModeToggleBtn.classList.add('btn-primary', 'active');
          showGenericAiPanel();
        } else {
          detailModeToggleBtn.classList.remove('btn-primary', 'active');
          // Remove active rows if disabled
          document.querySelectorAll('.table-row').forEach(r => r.classList.remove('active-row'));
          
          // Reset panel state and let CSS handle visibility
          const detailPane = document.getElementById('detailPane');
          if (detailPane) {
            detailPane.style.display = '';
            detailPane.innerHTML = '';
          }
        }
        renderList();
      });
    }

    renderList();
    updateStats();
    updateStorage();
  }

  init();

// ==================== AI Settings Modal Logic ====================
  const aiSettingsModal = document.getElementById('aiSettingsModal');
  const closeAiSettingsBtn = document.getElementById('closeAiSettingsBtn');
  const aiQuickActionsListModal = document.getElementById('aiQuickActionsListModal');
  const addAiQuickActionBtnModal = document.getElementById('addAiQuickActionBtnModal');
  const restoreAiQuickActionsBtnModal = document.getElementById('restoreAiQuickActionsBtnModal');
  const contextMenuEnginesListModal = document.getElementById('contextMenuEnginesListModal');
  const addContextMenuEngineBtnModal = document.getElementById('addContextMenuEngineBtnModal');
  const restoreContextMenuEnginesBtnModal = document.getElementById('restoreContextMenuEnginesBtnModal');
  const aiModalTabs = document.getElementById('aiModalTabs');
  const aiCustomPromptInputModal = document.getElementById('aiCustomPromptInputModal');
  const restoreAiPromptBtnModal = document.getElementById('restoreAiPromptBtnModal');
  const aiPromptSavedHint = document.getElementById('aiPromptSavedHint');

  let modalAiQuickActions = [];
  let modalContextMenuEngines = [];

  function openAiSettingsModal(initialTab) {
    if (!aiSettingsModal) return;
    
    // Clone states for editing
    modalAiQuickActions = JSON.parse(JSON.stringify(globalAiQuickActions));
    modalContextMenuEngines = JSON.parse(JSON.stringify(globalContextMenuEngines));
    
    // Populate prompt textarea
    if (aiCustomPromptInputModal) {
      aiCustomPromptInputModal.value = globalAiCustomSystemPrompt || '';
      if (!aiCustomPromptInputModal.value) {
        aiCustomPromptInputModal.placeholder = DEFAULT_AI_SYSTEM_PROMPT;
      }
    }

    const activeTabName = (typeof initialTab === 'string' && initialTab) ? initialTab : 'quick-actions';
    if (aiModalTabs) {
      aiModalTabs.querySelectorAll('.ai-modal-tab-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === activeTabName);
      });
      const tabPaneQuickActions = document.getElementById('tabPaneQuickActions');
      const tabPaneCustomPrompt = document.getElementById('tabPaneCustomPrompt');
      const tabPaneInteraction = document.getElementById('tabPaneInteraction');
      const tabPaneContextMenu = document.getElementById('tabPaneContextMenu');
      if (tabPaneQuickActions) tabPaneQuickActions.classList.toggle('active', activeTabName === 'quick-actions');
      if (tabPaneCustomPrompt) tabPaneCustomPrompt.classList.toggle('active', activeTabName === 'custom-prompt');
      if (tabPaneInteraction) tabPaneInteraction.classList.toggle('active', activeTabName === 'interaction');
      if (tabPaneContextMenu) tabPaneContextMenu.classList.toggle('active', activeTabName === 'context-menu');
    }

    const aiHoverPronunciationToggle = document.getElementById('aiHoverPronunciationToggle');
    if (aiHoverPronunciationToggle) {
      aiHoverPronunciationToggle.checked = aiHoverPronunciationEnabled;
    }

    renderAiSettingsList();
    renderContextMenuEnginesListModal();
    aiSettingsModal.classList.add('show');
    document.body.classList.add('modal-open');
  }

  function closeAiSettingsModal() {
    if (!aiSettingsModal) return;
    aiSettingsModal.classList.remove('show');
    document.body.classList.remove('modal-open');
    
    globalAiQuickActions = modalAiQuickActions;
    globalContextMenuEngines = modalContextMenuEngines;
    
    if (aiCustomPromptInputModal) {
      globalAiCustomSystemPrompt = aiCustomPromptInputModal.value.trim();
    }

    chrome.storage.local.set({ 
      aiQuickActions: globalAiQuickActions,
      aiCustomSystemPrompt: globalAiCustomSystemPrompt,
      customContextMenuEngines: globalContextMenuEngines
    });
  
  // Re-render the quick actions bar if we are on a word detail view
  const detailPane = document.getElementById('detailPane');
  if (detailPane && detailPane.dataset.activeWord) {
    const aiQuickQuestions = document.getElementById('aiQuickQuestions');
    if (aiQuickQuestions) {
      const activeActions = globalAiQuickActions.filter(a => a.active);
      if (activeActions.length === 0) {
        aiQuickQuestions.style.display = 'none';
      } else {
        aiQuickQuestions.style.display = 'flex';
        aiQuickQuestions.innerHTML = activeActions.map(a => {
          const label = a.isDefault ? t(a.labelKey) : a.label;
          const prompt = a.isDefault ? t(a.promptKey) : a.prompt;
          return `<button class="ai-quick-btn" data-q="${prompt}">${label}</button>`;
        }).join('');
        
        // Re-bind listeners for the new buttons
        aiQuickQuestions.querySelectorAll('.ai-quick-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const query = btn.getAttribute('data-q');
            const aiChatInput = document.getElementById('aiChatInput');
            if (aiChatInput) {
              aiChatInput.value = query;
              const aiSendBtn = document.getElementById('aiSendBtn');
              if (aiSendBtn) aiSendBtn.click();
            }
          });
        });
      }
    }
  }
}

if (closeAiSettingsBtn) {
  closeAiSettingsBtn.addEventListener('click', closeAiSettingsModal);
}
if (aiSettingsModal) {
  aiSettingsModal.addEventListener('click', (e) => {
    if (e.target === aiSettingsModal) closeAiSettingsModal();
  });
}

// ==================== AI Feedback Modal Logic (Web3Forms Email) ====================
const aiFeedbackModal = document.getElementById('aiFeedbackModal');
const closeAiFeedbackBtn = document.getElementById('closeAiFeedbackBtn');
const cancelAiFeedbackBtn = document.getElementById('cancelAiFeedbackBtn');
const aiFeedbackForm = document.getElementById('aiFeedbackForm');
const submitAiFeedbackBtn = document.getElementById('submitAiFeedbackBtn');
const aiFeedbackResult = document.getElementById('aiFeedbackResult');
const aiFeedbackContextPreview = document.getElementById('aiFeedbackContextPreview');
const aiFeedbackContextHidden = document.getElementById('aiFeedbackContextHidden');
const aiFeedbackSubject = document.getElementById('aiFeedbackSubject');
const aiFeedbackMessage = document.getElementById('aiFeedbackMessage');

function openAiFeedbackModal(question, replyText, targetWord) {
  if (!aiFeedbackModal) return;
  const detailPane = document.getElementById('detailPane');
  const wordDisplay = targetWord || (detailPane?.dataset?.activeWord ? detailPane.dataset.activeWord : '');
  const contextStr = `${wordDisplay ? `【關聯單詞】\n${wordDisplay}\n\n` : ''}【提問內容】\n${question || '（自訂問答）'}\n\n【AI 回答】\n${replyText}`;
  if (aiFeedbackContextPreview) {
    let html = '';
    if (wordDisplay) {
      html += `
        <div class="ai-fb-ctx-row">
          <span class="ai-fb-tag ai-fb-tag-word">詞</span>
          <span class="ai-fb-text ai-fb-word-text">${escapeHtml(wordDisplay)}</span>
        </div>
      `;
    }
    html += `
      <div class="ai-fb-ctx-row">
        <span class="ai-fb-tag">問</span>
        <span class="ai-fb-text">${escapeHtml(question || '（自訂問答）')}</span>
      </div>
      <div class="ai-fb-ctx-row">
        <span class="ai-fb-tag ai-fb-tag-ai">AI</span>
        <span class="ai-fb-text">${escapeHtml(replyText.length > 220 ? replyText.slice(0, 220) + '...' : replyText)}</span>
      </div>
    `;
    aiFeedbackContextPreview.innerHTML = html;
  }
  if (aiFeedbackContextHidden) aiFeedbackContextHidden.value = contextStr;
  if (aiFeedbackSubject) aiFeedbackSubject.value = `【粵拼插件 AI 反饋】${wordDisplay ? `[${wordDisplay}] ` : ''}${(question || '').slice(0, 25)}`;
  if (aiFeedbackMessage) aiFeedbackMessage.value = '';
  if (aiFeedbackResult) {
    aiFeedbackResult.className = 'ai-fb-result';
    aiFeedbackResult.innerHTML = '';
    aiFeedbackResult.style.display = 'none';
  }
  if (submitAiFeedbackBtn) {
    submitAiFeedbackBtn.disabled = false;
    submitAiFeedbackBtn.style.opacity = '1';
  }
  aiFeedbackModal.classList.add('show');
  document.body.classList.add('modal-open');
  if (aiFeedbackMessage) {
    setTimeout(() => aiFeedbackMessage.focus(), 50);
  }
}

function closeAiFeedbackModal() {
  if (!aiFeedbackModal) return;
  aiFeedbackModal.classList.remove('show');
  document.body.classList.remove('modal-open');
}

if (closeAiFeedbackBtn) closeAiFeedbackBtn.addEventListener('click', closeAiFeedbackModal);
if (cancelAiFeedbackBtn) cancelAiFeedbackBtn.addEventListener('click', closeAiFeedbackModal);
if (aiFeedbackModal) {
  aiFeedbackModal.addEventListener('click', (e) => {
    if (e.target === aiFeedbackModal) closeAiFeedbackModal();
  });
}

if (aiFeedbackForm) {
  aiFeedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(aiFeedbackForm);
    const originalHTML = submitAiFeedbackBtn.innerHTML;

    submitAiFeedbackBtn.innerHTML = `<span>發送中...</span>`;
    submitAiFeedbackBtn.disabled = true;
    submitAiFeedbackBtn.style.opacity = '0.7';
    if (aiFeedbackResult) {
      aiFeedbackResult.className = 'ai-fb-result';
      aiFeedbackResult.style.display = 'none';
    }

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        aiFeedbackResult.className = 'ai-fb-result is-success';
        aiFeedbackResult.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>發送成功！感謝您的反饋</span>
        `;
        aiFeedbackResult.style.display = 'inline-flex';
        aiFeedbackForm.reset();
        setTimeout(() => {
          closeAiFeedbackModal();
        }, 1600);
      } else {
        aiFeedbackResult.className = 'ai-fb-result is-error';
        aiFeedbackResult.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>${escapeHtml(data.message || '發送失敗，請稍後再試')}</span>
        `;
        aiFeedbackResult.style.display = 'inline-flex';
      }
    } catch (err) {
      aiFeedbackResult.className = 'ai-fb-result is-error';
      aiFeedbackResult.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>發送失敗，請檢查網絡連接</span>
      `;
      aiFeedbackResult.style.display = 'inline-flex';
    } finally {
      submitAiFeedbackBtn.innerHTML = originalHTML;
      submitAiFeedbackBtn.disabled = false;
      submitAiFeedbackBtn.style.opacity = '1';
    }
  });
}

// Helper to locate scrollable element within modal
function findModalScrollableParent(el, rootModal) {
  let current = el;
  while (current && current !== rootModal && current !== document.body) {
    if (current.id === 'aiQuickActionsListModal' || current.id === 'contextMenuEnginesListModal' || current.classList.contains('ai-prompt-textarea')) {
      return current;
    }
    const style = window.getComputedStyle(current);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

// Prevent wheel scrolling inside modal from bubbling / chaining to the background page
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('wheel', (e) => {
    const modal = overlay.querySelector('.modal');
    if (!modal) return;
    if (e.target === overlay) {
      e.preventDefault();
      return;
    }
    const scrollable = findModalScrollableParent(e.target, modal);
    if (scrollable) {
      const { scrollTop, scrollHeight, clientHeight } = scrollable;
      const atTop = scrollTop <= 0 && e.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
      if (atTop || atBottom) {
        e.preventDefault();
      }
    } else {
      e.preventDefault();
    }
  }, { passive: false });
});

// Tab Switching
if (aiModalTabs) {
  aiModalTabs.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.ai-modal-tab-btn');
    if (!tabBtn) return;
    const targetTab = tabBtn.dataset.tab;
    aiModalTabs.querySelectorAll('.ai-modal-tab-btn').forEach(b => b.classList.toggle('active', b === tabBtn));
    
    const tabPaneQuickActions = document.getElementById('tabPaneQuickActions');
    const tabPaneCustomPrompt = document.getElementById('tabPaneCustomPrompt');
    const tabPaneInteraction = document.getElementById('tabPaneInteraction');
    const tabPaneContextMenu = document.getElementById('tabPaneContextMenu');
    if (tabPaneQuickActions) tabPaneQuickActions.classList.toggle('active', targetTab === 'quick-actions');
    if (tabPaneCustomPrompt) tabPaneCustomPrompt.classList.toggle('active', targetTab === 'custom-prompt');
    if (tabPaneInteraction) tabPaneInteraction.classList.toggle('active', targetTab === 'interaction');
    if (tabPaneContextMenu) tabPaneContextMenu.classList.toggle('active', targetTab === 'context-menu');
  });
}

// Save prompt helper
function savePromptState(val) {
  globalAiCustomSystemPrompt = val.trim();
  chrome.storage.local.set({ aiCustomSystemPrompt: globalAiCustomSystemPrompt });
  if (aiPromptSavedHint) {
    aiPromptSavedHint.style.opacity = '1';
    clearTimeout(aiPromptSavedHint._timer);
    aiPromptSavedHint._timer = setTimeout(() => {
      aiPromptSavedHint.style.opacity = '0';
    }, 1500);
  }
}

// Prompt Textarea input auto-save
if (aiCustomPromptInputModal) {
  aiCustomPromptInputModal.addEventListener('input', () => {
    savePromptState(aiCustomPromptInputModal.value);
  });
}

// Variable Tags Insertion
document.querySelectorAll('.ai-prompt-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const varText = tag.dataset.tag;
    if (aiCustomPromptInputModal && varText) {
      const start = aiCustomPromptInputModal.selectionStart || 0;
      const end = aiCustomPromptInputModal.selectionEnd || 0;
      const val = aiCustomPromptInputModal.value;
      aiCustomPromptInputModal.value = val.substring(0, start) + varText + val.substring(end);
      aiCustomPromptInputModal.focus();
      aiCustomPromptInputModal.selectionStart = aiCustomPromptInputModal.selectionEnd = start + varText.length;
      savePromptState(aiCustomPromptInputModal.value);
    }
  });
});

// Restore Default Prompt
if (restoreAiPromptBtnModal) {
  restoreAiPromptBtnModal.addEventListener('click', () => {
    const confirmMsg = t('wordbookConfirmRestorePrompt') || '確定要恢復預設 Prompt 嗎？這將會清除您自訂的系統提示詞。';
    if (confirm(confirmMsg)) {
      if (aiCustomPromptInputModal) {
        aiCustomPromptInputModal.value = DEFAULT_AI_SYSTEM_PROMPT;
        savePromptState(DEFAULT_AI_SYSTEM_PROMPT);
      }
    }
  });
}

function renderAiSettingsList() {
  if (!aiQuickActionsListModal) return;
  aiQuickActionsListModal.innerHTML = '';
  
  modalAiQuickActions.forEach((action, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'ai-action-card';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = action.active;
    checkbox.className = 'ai-action-checkbox';
    checkbox.title = '啟用/停用此指令';
    checkbox.addEventListener('change', () => {
      action.active = checkbox.checked;
    });

    const contentDiv = document.createElement('div');
    contentDiv.className = 'ai-action-fields';

    let labelText = action.isDefault ? (t(action.labelKey) || action.labelKey) : (action.label || '');
    let promptText = action.isDefault ? (t(action.promptKey) || action.promptKey) : (action.prompt || '');

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = labelText;
    labelInput.className = 'ai-action-input ai-action-input-name';
    labelInput.placeholder = t('wordbookAiActionNamePlaceholder') || '指令名稱 (如: 造句)';

    const promptInput = document.createElement('input');
    promptInput.type = 'text';
    promptInput.value = promptText;
    promptInput.className = 'ai-action-input ai-action-input-prompt';
    promptInput.placeholder = t('wordbookAiActionPromptPlaceholder') || 'AI 提示詞 (如: 用這個詞造句...)';

    labelInput.addEventListener('change', () => {
      action.label = labelInput.value;
      action.isDefault = false;
      delete action.labelKey;
      delete action.promptKey;
    });
    promptInput.addEventListener('change', () => {
      action.prompt = promptInput.value;
      action.isDefault = false;
      delete action.labelKey;
      delete action.promptKey;
    });

    contentDiv.appendChild(labelInput);
    contentDiv.appendChild(promptInput);

    itemDiv.appendChild(checkbox);
    itemDiv.appendChild(contentDiv);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ai-action-del-btn';
    deleteBtn.title = '刪除此指令';
    deleteBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    deleteBtn.addEventListener('click', () => {
      modalAiQuickActions.splice(index, 1);
      renderAiSettingsList();
    });
    itemDiv.appendChild(deleteBtn);

    aiQuickActionsListModal.appendChild(itemDiv);
  });
}

if (addAiQuickActionBtnModal) {
  addAiQuickActionBtnModal.addEventListener('click', () => {
    modalAiQuickActions.push({
      id: 'custom_' + Date.now(),
      isDefault: false,
      label: '',
      prompt: '',
      active: true
    });
    renderAiSettingsList();

    if (aiQuickActionsListModal) {
      setTimeout(() => {
        aiQuickActionsListModal.scrollTo({
          top: aiQuickActionsListModal.scrollHeight,
          behavior: 'smooth'
        });
        const lastCard = aiQuickActionsListModal.lastElementChild;
        if (lastCard) {
          const nameInput = lastCard.querySelector('.ai-action-input-name');
          if (nameInput) nameInput.focus();
        }
      }, 30);
    }
  });
}

if (restoreAiQuickActionsBtnModal) {
  restoreAiQuickActionsBtnModal.addEventListener('click', () => {
    if (confirm(chrome.i18n.getMessage('optConfirmRestore') || '確定要恢復預設指令嗎？這將會清除您添加的自訂指令。')) {
      const defaultAiQuickActions = [
        { id: 'default1', isDefault: true, labelKey: 'wordbookAiAction1', promptKey: 'wordbookAiQuery1', active: true },
        { id: 'default2', isDefault: true, labelKey: 'wordbookAiAction2', promptKey: 'wordbookAiQuery2', active: true },
        { id: 'default3', isDefault: true, labelKey: 'wordbookAiAction3', promptKey: 'wordbookAiQuery3', active: true },
        { id: 'default4', isDefault: true, labelKey: 'wordbookAiAction4', promptKey: 'wordbookAiQuery4', active: true }
      ];
      modalAiQuickActions = JSON.parse(JSON.stringify(defaultAiQuickActions));
      renderAiSettingsList();
    }
  });
}

function renderContextMenuEnginesListModal() {
  if (!contextMenuEnginesListModal) return;
  contextMenuEnginesListModal.innerHTML = '';

  modalContextMenuEngines.forEach((engine, index) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'cm-engine-card';

    const topRow = document.createElement('div');
    topRow.className = 'cm-engine-row-top';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!engine.active;
    checkbox.className = 'ai-action-checkbox';
    checkbox.title = '啟用/停用此搜尋源';
    checkbox.addEventListener('change', () => {
      engine.active = checkbox.checked;
    });

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = engine.name || '';
    nameInput.className = 'cm-engine-input cm-engine-input-name';
    nameInput.placeholder = t('wordbookEngineNamePlaceholder') || '搜尋源名稱 (如: Wiki 粵語詞典)';
    nameInput.addEventListener('change', () => {
      engine.name = nameInput.value.trim();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'ai-action-del-btn';
    delBtn.title = '刪除此搜尋源';
    delBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    delBtn.addEventListener('click', () => {
      modalContextMenuEngines.splice(index, 1);
      renderContextMenuEnginesListModal();
    });

    topRow.appendChild(checkbox);
    topRow.appendChild(nameInput);
    topRow.appendChild(delBtn);

    const bottomRow = document.createElement('div');
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = engine.url || '';
    urlInput.className = 'cm-engine-input cm-engine-input-url';
    urlInput.placeholder = t('wordbookEngineUrlPlaceholder') || '搜尋 URL 範本 (如: https://.../{word})';
    urlInput.addEventListener('change', () => {
      engine.url = urlInput.value.trim();
    });
    bottomRow.appendChild(urlInput);

    cardDiv.appendChild(topRow);
    cardDiv.appendChild(bottomRow);

    contextMenuEnginesListModal.appendChild(cardDiv);
  });
}

if (addContextMenuEngineBtnModal) {
  addContextMenuEngineBtnModal.addEventListener('click', () => {
    modalContextMenuEngines.push({
      id: 'custom_' + Date.now(),
      name: '',
      url: 'https://',
      active: true,
      icon: 'globe'
    });
    renderContextMenuEnginesListModal();
    if (contextMenuEnginesListModal) {
      setTimeout(() => {
        contextMenuEnginesListModal.scrollTo({
          top: contextMenuEnginesListModal.scrollHeight,
          behavior: 'smooth'
        });
        const lastCard = contextMenuEnginesListModal.lastElementChild;
        if (lastCard) {
          const nameInput = lastCard.querySelector('.cm-engine-input-name');
          if (nameInput) nameInput.focus();
        }
      }, 30);
    }
  });
}

if (restoreContextMenuEnginesBtnModal) {
  restoreContextMenuEnginesBtnModal.addEventListener('click', () => {
    if (confirm((t('wordbookRestoreSearchEngines') || '恢復預設搜尋源') + '？')) {
      modalContextMenuEngines = JSON.parse(JSON.stringify(DEFAULT_CONTEXT_MENU_ENGINES));
      renderContextMenuEnginesListModal();
    }
  });
}

// ==================== Custom Right-Click Context Menu Logic ====================
const customContextMenu = document.getElementById('customContextMenu');
const contextMenuWordDisplay = document.getElementById('contextMenuWordDisplay');
const contextMenuList = document.getElementById('contextMenuList');
const contextMenuSettingsBtn = document.getElementById('contextMenuSettingsBtn');

let currentContextMenuWord = '';

function getEngineIconSVG(iconType) {
  switch (iconType) {
    case 'wiki':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
    case 'book':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
    case 'sheep':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
    case 'x':
      return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
    default:
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  }
}

function showCustomContextMenu(x, y, wordStr) {
  if (!customContextMenu || !wordStr) return;
  currentContextMenuWord = wordStr.trim();
  if (!currentContextMenuWord) return;

  if (contextMenuWordDisplay) {
    contextMenuWordDisplay.textContent = `${t('wordbookSearchPrefix') || '搜尋'}「${currentContextMenuWord}」`;
  }

  const activeEngines = (globalContextMenuEngines || DEFAULT_CONTEXT_MENU_ENGINES).filter(e => e.active);
  if (contextMenuList) {
    if (activeEngines.length === 0) {
      contextMenuList.innerHTML = `<div style="padding: 8px 12px; font-size: 12px; color: var(--text-muted); text-align: center;">尚未啟用搜尋源</div>`;
    } else {
      contextMenuList.innerHTML = activeEngines.map((engine) => {
        const iconHtml = getEngineIconSVG(engine.icon || 'globe');
        return `
          <button class="context-menu-item" data-id="${engine.id}">
            <div class="context-menu-item-left">
              <span class="context-menu-item-icon">${iconHtml}</span>
              <span class="context-menu-item-name">${escapeHtml(engine.name || '搜尋')}</span>
            </div>
            <svg class="context-menu-item-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
          </button>
        `;
      }).join('');

      contextMenuList.querySelectorAll('.context-menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const engineId = btn.dataset.id;
          const engine = activeEngines.find(e => e.id === engineId);
          if (engine && engine.url) {
            const searchUrl = engine.url.replace(/\{word\}/gi, encodeURIComponent(currentContextMenuWord));
            window.open(searchUrl, '_blank');
          }
          hideCustomContextMenu();
        });
      });
    }
  }

  customContextMenu.style.display = 'flex';
  customContextMenu.style.visibility = 'hidden';
  customContextMenu.style.left = '0px';
  customContextMenu.style.top = '0px';

  requestAnimationFrame(() => {
    const menuRect = customContextMenu.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let posX = x;
    let posY = y;

    if (posX + menuRect.width > winW - 12) {
      posX = Math.max(12, winW - menuRect.width - 12);
    }
    if (posY + menuRect.height > winH - 12) {
      posY = Math.max(12, posY - menuRect.height);
    }

    customContextMenu.style.left = `${posX}px`;
    customContextMenu.style.top = `${posY}px`;
    customContextMenu.style.visibility = 'visible';
  });
}

function hideCustomContextMenu() {
  if (customContextMenu) {
    customContextMenu.style.display = 'none';
  }
}

document.addEventListener('click', (e) => {
  if (customContextMenu && customContextMenu.style.display !== 'none') {
    if (!customContextMenu.contains(e.target)) {
      hideCustomContextMenu();
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideCustomContextMenu();
  }
});

if (contextMenuSettingsBtn) {
  contextMenuSettingsBtn.addEventListener('click', () => {
    hideCustomContextMenu();
    openAiSettingsModal('context-menu');
  });
}

// Right-click listener on word rows in table
if (wordListEl) {
  wordListEl.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.table-row.word-card');
    if (!row) return;
    const wordId = row.dataset.id;
    const targetWord = wordbook.find(w => w.id === wordId);
    const wordText = targetWord ? targetWord.character : (row.querySelector('.col-char .word-text')?.textContent || '');
    if (wordText) {
      e.preventDefault();
      showCustomContextMenu(e.clientX, e.clientY, wordText);
    }
  });
}

// Right-click listener on detail pane title if opened
const detailPaneElement = document.getElementById('detailPane');
if (detailPaneElement) {
  detailPaneElement.addEventListener('contextmenu', (e) => {
    const wordHeader = e.target.closest('.word-section, .dict-character-title, .dict-jyutping-title');
    if (wordHeader) {
      const activeWord = detailPaneElement.dataset.activeWord;
      if (activeWord) {
        e.preventDefault();
        showCustomContextMenu(e.clientX, e.clientY, activeWord);
      }
    }
  });
}

  // ==================== AI 劃詞懸浮發音工具條 ====================

  // ==================== AI 回答框劃詞朗讀與光標懸停音標吸附 ====================

  let jyutpingLookupMap = null;

  function buildJyutpingLookupMap() {
    if (jyutpingLookupMap || !dictionary) return;
    jyutpingLookupMap = new Map();
    for (const key of Object.keys(dictionary)) {
      const entry = dictionary[key];
      if (entry && entry.jyutping) {
        if (entry.traditional) jyutpingLookupMap.set(entry.traditional, entry.jyutping);
        if (entry.simplified) jyutpingLookupMap.set(entry.simplified, entry.jyutping);
        jyutpingLookupMap.set(key, entry.jyutping);
      }
    }
  }

  function findBestWordAtPoint(clientX, clientY) {
    if (!dictionary) return null;

    let range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(clientX, clientY);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(clientX, clientY);
      if (pos && pos.offsetNode) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
      }
    }

    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

    const textNode = range.startContainer;
    const parentEl = textNode.parentElement;
    if (!parentEl || !parentEl.closest('.ai-response-content')) return null;
    if (parentEl.closest('.ai-response-actions, .ai-response-meta, button, .ai-chat-header, .ai-input-row')) return null;

    const text = textNode.textContent;
    if (!text) return null;

    const offset = range.startOffset;
    let charIdx = offset;
    if (charIdx >= text.length || !/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text[charIdx])) {
      if (charIdx > 0 && /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text[charIdx - 1])) {
        charIdx = charIdx - 1;
      } else {
        return null;
      }
    }

    buildJyutpingLookupMap();

    let bestMatch = null;
    const maxLen = 6;
    const startMin = Math.max(0, charIdx - maxLen + 1);
    const startMax = charIdx;

    for (let s = startMin; s <= startMax; s++) {
      for (let len = maxLen; len >= 1; len--) {
        const e = s + len;
        if (e <= charIdx) continue;
        if (e > text.length) continue;

        const sub = text.substring(s, e);
        if (jyutpingLookupMap && jyutpingLookupMap.has(sub)) {
          if (!bestMatch || sub.length > bestMatch.word.length) {
            bestMatch = {
              word: sub,
              jyutping: jyutpingLookupMap.get(sub),
              startOffset: s,
              endOffset: e,
              textNode: textNode
            };
          }
        }
      }
    }

    if (!bestMatch) {
      const singleChar = text[charIdx];
      if (jyutpingLookupMap && jyutpingLookupMap.has(singleChar)) {
        bestMatch = {
          word: singleChar,
          jyutping: jyutpingLookupMap.get(singleChar),
          startOffset: charIdx,
          endOffset: charIdx + 1,
          textNode: textNode
        };
      }
    }

    return bestMatch;
  }

  function initAiSelectionAndHover() {
    const aiHoverPronunciationToggle = document.getElementById('aiHoverPronunciationToggle');
    if (aiHoverPronunciationToggle) {
      aiHoverPronunciationToggle.addEventListener('change', () => {
        aiHoverPronunciationEnabled = aiHoverPronunciationToggle.checked;
        chrome.storage.local.set({ aiHoverPronunciationEnabled });
        if (!aiHoverPronunciationEnabled) {
          hideHoverSnap();
          hideSelectionToolbar();
        }
      });
    }

    // 1. 拖動劃選朗讀工具條 (Drag Selection Toolbar)
    let selectionToolbarEl = document.getElementById('aiSelectionToolbar');
    if (!selectionToolbarEl) {
      selectionToolbarEl = document.createElement('div');
      selectionToolbarEl.id = 'aiSelectionToolbar';
      selectionToolbarEl.className = 'ai-selection-toolbar';
      selectionToolbarEl.innerHTML = `
        <button class="ai-selection-tts-btn" aria-label="朗讀選中文本">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
          <span>朗讀</span>
        </button>
      `;
      document.body.appendChild(selectionToolbarEl);
    }

    const selectionTtsBtn = selectionToolbarEl.querySelector('.ai-selection-tts-btn');
    let currentSelectedText = '';

    function hideSelectionToolbar() {
      selectionToolbarEl.classList.remove('is-visible');
      currentSelectedText = '';
    }

    selectionTtsBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    selectionTtsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentSelectedText) {
        playTts(currentSelectedText, selectionTtsBtn);
      }
    });

    // 2. 光標懸停吸附高亮框與音標窗 (Hover Snap Highlight & Phonetic Pill)
    let hoverHighlightEl = document.getElementById('aiWordHighlightOverlay');
    if (!hoverHighlightEl) {
      hoverHighlightEl = document.createElement('div');
      hoverHighlightEl.id = 'aiWordHighlightOverlay';
      hoverHighlightEl.className = 'ai-word-hover-highlight';
      document.body.appendChild(hoverHighlightEl);
    }

    let hoverPillEl = document.getElementById('aiHoverPhoneticPill');
    if (!hoverPillEl) {
      hoverPillEl = document.createElement('div');
      hoverPillEl.id = 'aiHoverPhoneticPill';
      hoverPillEl.className = 'ai-hover-phonetic-pill';
      hoverPillEl.innerHTML = `
        <button class="ai-selection-tts-btn" aria-label="點擊發音">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
          <span></span>
        </button>
      `;
      document.body.appendChild(hoverPillEl);
    }

    const hoverPillBtn = hoverPillEl.querySelector('.ai-selection-tts-btn');
    const hoverPillSpan = hoverPillEl.querySelector('.ai-selection-tts-btn span');
    let currentHoverWord = '';

    function hideHoverSnap() {
      hoverHighlightEl.style.display = 'none';
      hoverPillEl.classList.remove('is-visible');
      currentHoverWord = '';
    }

    function triggerHoverTts(e) {
      e.preventDefault();
      e.stopPropagation();
      if (currentHoverWord) {
        playTts(currentHoverWord, hoverPillBtn);
      }
    }

    hoverHighlightEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    hoverHighlightEl.addEventListener('click', triggerHoverTts);

    hoverPillBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    hoverPillBtn.addEventListener('click', triggerHoverTts);

    // 處理劃詞選區 (Drag Selection Handler)
    function handleSelection() {
      if (!aiHoverPronunciationEnabled) {
        hideSelectionToolbar();
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        hideSelectionToolbar();
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText || !/[\u4e00-\u9fa5a-zA-Z0-9]/.test(selectedText)) {
        hideSelectionToolbar();
        return;
      }

      // Check if selection is strictly within AI response content (exclude system buttons and meta)
      const anchorNode = selection.anchorNode;
      const focusNode = selection.focusNode;
      const anchorEl = anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
      const focusEl = focusNode?.nodeType === Node.ELEMENT_NODE ? focusNode : focusNode?.parentElement;

      if (anchorEl?.closest('.ai-response-actions, .ai-response-meta, button, .ai-chat-header, .ai-input-row') ||
          focusEl?.closest('.ai-response-actions, .ai-response-meta, button, .ai-chat-header, .ai-input-row')) {
        hideSelectionToolbar();
        return;
      }

      const insideAiContent = (anchorEl && anchorEl.closest('.ai-response-content')) &&
                              (focusEl && focusEl.closest('.ai-response-content'));

      if (!insideAiContent) {
        hideSelectionToolbar();
        return;
      }

      // 隱藏懸停吸附框，展示拖選朗讀欄
      hideHoverSnap();
      currentSelectedText = selectedText;

      const textSpan = selectionTtsBtn.querySelector('span');
      if (textSpan) {
        textSpan.textContent = t('wordbookSpeak') || '朗讀';
      }

      const range = selection.getRangeAt(0);
      const clientRects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
      if (clientRects.length === 0) {
        hideSelectionToolbar();
        return;
      }

      const targetRect = clientRects[clientRects.length - 1];

      let top = Math.max(10, targetRect.top);
      let left = Math.max(50, Math.min(window.innerWidth - 50, targetRect.left + targetRect.width / 2));

      let isFlipped = false;
      if (top < 45) {
        top = targetRect.bottom;
        isFlipped = true;
      }

      selectionToolbarEl.classList.toggle('is-flipped', isFlipped);
      selectionToolbarEl.style.top = `${top}px`;
      selectionToolbarEl.style.left = `${left}px`;
      selectionToolbarEl.classList.add('is-visible');
    }

    // 處理光標懸停吸附 (Hover Word Snap Handler)
    let hoverThrottleTimer = null;
    let isSelecting = false;

    document.addEventListener('mousedown', (e) => {
      if (e.target === hoverHighlightEl || hoverPillEl.contains(e.target) || selectionToolbarEl.contains(e.target)) {
        return;
      }
      isSelecting = true;
      hideHoverSnap();
    });

    document.addEventListener('mouseup', () => {
      isSelecting = false;
      setTimeout(handleSelection, 15);
    });

    document.addEventListener('mousemove', (e) => {
      if (!aiHoverPronunciationEnabled) {
        hideHoverSnap();
        return;
      }

      if (isSelecting) return;

      // 如果有手動選區，不觸發懸停
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;

      if (hoverThrottleTimer) return;
      hoverThrottleTimer = setTimeout(() => {
        hoverThrottleTimer = null;
      }, 35);

      // 檢查是否在 AI 回答區域內
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target) return;

      // 如果鼠標就在當前高亮框或音標窗上，保持顯示
      if (target === hoverHighlightEl || hoverPillEl.contains(target)) {
        return;
      }

      // 排除系統按鈕/元信息區域 (例如底欄複製按鈕、頂欄思考時間)，這些區域絕不觸發懸停
      if (target.closest('.ai-response-actions, .ai-response-meta, button, .ai-chat-header, .ai-input-row')) {
        hideHoverSnap();
        return;
      }

      const aiContentArea = target.closest('.ai-response-content');
      if (!aiContentArea) {
        hideHoverSnap();
        return;
      }

      const best = findBestWordAtPoint(e.clientX, e.clientY);
      if (!best || !best.jyutping) {
        hideHoverSnap();
        return;
      }

      // 計算匹配詞的精準幾何位置
      try {
        const wordRange = document.createRange();
        wordRange.setStart(best.textNode, best.startOffset);
        wordRange.setEnd(best.textNode, best.endOffset);
        const rect = wordRange.getBoundingClientRect();

        if (rect.width <= 0 || rect.height <= 0) {
          hideHoverSnap();
          return;
        }

        currentHoverWord = best.word;

        // 1. 定位高亮吸附框
        hoverHighlightEl.style.top = `${rect.top}px`;
        hoverHighlightEl.style.left = `${rect.left}px`;
        hoverHighlightEl.style.width = `${rect.width}px`;
        hoverHighlightEl.style.height = `${rect.height}px`;
        hoverHighlightEl.style.display = 'block';

        // 2. 定位音標懸浮窗
        hoverPillSpan.textContent = best.jyutping;

        let top = Math.max(10, rect.top);
        let left = Math.max(50, Math.min(window.innerWidth - 50, rect.left + rect.width / 2));

        let isFlipped = false;
        if (top < 45) {
          top = rect.bottom;
          isFlipped = true;
        }

        hoverPillEl.classList.toggle('is-flipped', isFlipped);
        hoverPillEl.style.top = `${top}px`;
        hoverPillEl.style.left = `${left}px`;
        hoverPillEl.classList.add('is-visible');
      } catch (err) {
        hideHoverSnap();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
        setTimeout(handleSelection, 15);
      }
    });

    document.addEventListener('scroll', () => {
      hideHoverSnap();
      hideSelectionToolbar();
    }, true);
  }

  // Initialize AI selection and hover word snap
  initAiSelectionAndHover();

})();
