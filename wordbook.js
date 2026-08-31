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
  let isAutoPronounce = localStorage.getItem('jyutping_auto_pronounce') === 'true';
  let autoTtsTimer = null;
  let aiHoverPronunciationEnabled = true;
  const wordAiHistoryMap = {};
  chrome.storage.local.get({ aiHoverPronunciationEnabled: true }, (res) => {
    aiHoverPronunciationEnabled = res.aiHoverPronunciationEnabled !== false;
  });

  function triggerAutoPronounce(wordText, ttsTargetEl) {
    if (!isAutoPronounce || !wordText) return;
    if (autoTtsTimer) clearTimeout(autoTtsTimer);
    autoTtsTimer = setTimeout(() => {
      playTts(wordText, ttsTargetEl);
    }, 120);
  }

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

        // 確保歷史詞條都有 folderId 屬性，隔離不同資料夾的數據
        let hasMissingFolderId = false;
        purged.forEach(w => {
          if (!w.folderId) {
            w.folderId = 'default';
            hasMissingFolderId = true;
          }
        });

        if (hasExpired || hasMissingFolderId) {
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
      wordbookSearchPrefix: '搜尋',
      spellingQuizBtn: '拼寫練習',
      spellingQuizTitle: '拼寫練習',
      spellingQuizBack: '返回生詞本',
      spellingQuizSkip: '跳過',
      spellingQuizConfirm: '確認',
      spellingQuizHint: '提示',
      spellingQuizShowHint: '顯示提示',
      spellingQuizCorrect: '正確！',
      spellingQuizWrong: '正確答案是',
      spellingQuizNext: '下一題',
      spellingQuizComplete: '練習完成！',
      spellingQuizAccuracy: '正確率',
      spellingQuizTime: '用時',
      spellingQuizRetry: '再來一輪',
      spellingQuizRetryWrong: '只練錯題',
      spellingQuizNoWords: '可用題目不足',
      spellingQuizNoWordsDetail: '請先收藏更多含例句的生詞（至少需要 3 個）',
      spellingQuizInputPlaceholder: '在此輸入答案…',
      spellingQuizProgress: '$1 / $2',
      spellingQuizResultCorrect: '答對',
      spellingQuizResultWrong: '答錯',
      spellingQuizResultSkipped: '跳過',
      spellingQuizSeconds: '秒',
      spellingQuizReviewTitle: '題目回顧',
      wordbookNote: '筆記',
      wordbookAddNote: '添加筆記',
      wordbookEditNote: '編輯筆記',
      wordbookDeleteNote: '刪除筆記',
      wordbookNoteTitle: '自定義筆記',
      wordbookNotePlaceholder: '在此記錄記憶技巧、生活例句或筆記備註...',
      wordbookNoteSave: '保存筆記',
      wordbookNoteCancel: '取消',
      wordbookNoteDeleteConfirm: '確定要刪除此筆記嗎？',
      wordbookNoteShortcutHint: 'Cmd/Ctrl + Enter 保存',
      wordbookAiEditingPlaceholder: '正在使用 AI 進行編輯...',
      wordbookAiGenerateSelected: 'AI 筆記',
      wordbookAiAddNotes: 'AI 添加筆記',
      wordbookAiTooltipDesc: '先勾選需要編寫筆記的詞條，然後點擊按鈕由 AI 批量生成。',
      wordbookSelectUnannotated: '點擊選中所有未添加筆記的詞條',
      wordbookAllHaveNotes: '當前列表中的所有詞條均已添加筆記！',
      wordbookAiBulkConfirm: '確定要使用 AI 為選中的 {n} 個詞條生成筆記釋義嗎？',
      wordbookAiBulkTooltip: '為選中的 {n} 個詞條生成 AI 筆記',
      wordbookAiBulkDisabledTooltip: '請先勾選詞條',
      wordbookTabShortcuts: '快捷鍵與朗讀',
      wordbookShortcutsDesc: '生詞表鍵盤快捷鍵一覽及自訂生詞切換時的發音行為。',
      shortcutNextWord: '切換至下一個生詞',
      shortcutPrevWord: '切換至上一個生詞',
      shortcutPronounceActive: '手動朗讀當前選中生詞',
      shortcutCloseModal: '關閉當前彈窗或右鍵選單',
      settingAutoPronounceTitle: '切換生詞時自動朗讀',
      settingAutoPronounceDesc: '使用 ↑ / ↓ 方向鍵切換生詞時，自動播放該生詞的粵語發音。',
      settingsCategoryWordbook: '生詞表設定',
      settingsCategoryAi: 'AI 助手設定',
      wordbookSettingsModalTitle: '設定',
      wordbookAiTabCustomPromptDesc: '自訂 AI 隨身問答的系統提示詞（System Prompt），此 Prompt 會引導 AI 在解答所有問題時的人設與回答風格。',
      wordbookAiCustomPromptPlaceholder: '輸入自訂全域系統提示詞...',
      wordbookAiTabNotePrompt: '筆記 Prompt',
      wordbookAiTabNotePromptDesc: '自訂生詞本中 AI 編輯或批量生成筆記時的提示詞（Prompt），引導 AI 生成符合您個人習慣的筆記釋義。',
      wordbookAiNotePromptPlaceholder: '輸入自訂 AI 筆記提示詞...',
      wordbookTagPronunciation: '發音',
      wordbookTagDefinitions: '詞典釋義',
      wordbookAiInsertVariable: '插入變量：',
      wordbookTagTargetLang: '目標語言',
      wordbookTagWord: '選中詞',
      wordbookClickToInsert: '點擊插入',
      wordbookRestoreDefaultPrompt: '恢復預設 Prompt',
      wordbookPromptSaved: '✓ 已保存',
      wordbookRestoreDefaultActions: '恢復預設指令',
      wordbookRestoreDefaultEngines: '恢復預設搜尋源',
      engineWiki: 'Wiki 粵語詞典',
      engineWordsHk: 'Words.hk 粵典',
      engineSheik: '羊羊粵語詞典',
      engineTwitter: 'X (Twitter) 搜尋',
      engineGoogle: 'Google 粵語搜尋',
      dictLabelJyutping: '粵拼:',
      dictLabelYale: '耶魯:',
      dictLabelSims: '近義：',
      dictLabelAnts: '反義：',
      dictLabelVariants: '異體：',
      dictBtnReport: '報告',
      dictReportTitle: '報告錯誤',
      dictReportWord: '詞語：',
      dictReportPlaceholder: '請描述具體的錯誤（例如讀音不正確、釋義有誤等）...',
      dictReportSend: '發送報告',
      dictReportSending: '發送中...',
      dictReportSent: '報告已送出',
      dictReportFailed: '發送失敗',
      dictBookmarkAdd: '加入生詞本',
      dictBookmarkRemove: '從生詞本移除',
      wordbookSelectItem: '點擊選中',
      wordbookDeselectItem: '點擊取消選中'
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
      wordbookSearchPrefix: '搜索',
      spellingQuizBtn: '拼写练习',
      spellingQuizTitle: '拼写练习',
      spellingQuizBack: '返回生词本',
      spellingQuizSkip: '跳过',
      spellingQuizConfirm: '确认',
      spellingQuizHint: '提示',
      spellingQuizShowHint: '显示提示',
      spellingQuizCorrect: '正确！',
      spellingQuizWrong: '正确答案是',
      spellingQuizNext: '下一题',
      spellingQuizComplete: '练习完成！',
      spellingQuizAccuracy: '正确率',
      spellingQuizTime: '用时',
      spellingQuizRetry: '再来一轮',
      spellingQuizRetryWrong: '只练错题',
      spellingQuizNoWords: '可用题目不足',
      spellingQuizNoWordsDetail: '请先收藏更多含例句的生词（至少需要 3 个）',
      spellingQuizInputPlaceholder: '在此输入答案…',
      spellingQuizProgress: '$1 / $2',
      spellingQuizResultCorrect: '答对',
      spellingQuizResultWrong: '答错',
      spellingQuizResultSkipped: '跳过',
      spellingQuizSeconds: '秒',
      spellingQuizReviewTitle: '题目回顾',
      wordbookNote: '笔记',
      wordbookAddNote: '添加笔记',
      wordbookEditNote: '编辑笔记',
      wordbookDeleteNote: '删除笔记',
      wordbookNoteTitle: '自定义笔记',
      wordbookNotePlaceholder: '在此记录记忆技巧、生活例句或笔记备注...',
      wordbookNoteSave: '保存笔记',
      wordbookNoteCancel: '取消',
      wordbookNoteDeleteConfirm: '确定要删除此笔记吗？',
      wordbookNoteShortcutHint: 'Cmd/Ctrl + Enter 保存',
      wordbookAiEditingPlaceholder: '正在使用 AI 进行编辑...',
      wordbookAiGenerateSelected: 'AI 笔记',
      wordbookAiAddNotes: 'AI 添加笔记',
      wordbookAiTooltipDesc: '先勾选需要编写笔记的词条，然后点击按钮由 AI 批量生成。',
      wordbookSelectUnannotated: '点击选中所有未添加笔记的词条',
      wordbookAllHaveNotes: '当前列表中的所有词条均已添加笔记！',
      wordbookAiBulkConfirm: '确定要使用 AI 为选中的 {n} 个词条生成笔记释义吗？',
      wordbookAiBulkTooltip: '为选中的 {n} 个词条生成 AI 笔记',
      wordbookAiBulkDisabledTooltip: '请先勾选词条',
      wordbookTabShortcuts: '快捷键与朗读',
      wordbookShortcutsDesc: '生词表键盘快捷键一览及自定义生词切换时的发音行为。',
      shortcutNextWord: '切换至下一个生词',
      shortcutPrevWord: '切换至上一个生词',
      shortcutPronounceActive: '手动朗读当前选中生词',
      shortcutCloseModal: '关闭当前弹窗或右键菜单',
      settingAutoPronounceTitle: '切换生词时自动朗读',
      settingAutoPronounceDesc: '使用 ↑ / ↓ 方向键切换生词时，自动播放该生词的粤语发音。',
      settingsCategoryWordbook: '生词表设置',
      settingsCategoryAi: 'AI 助手设置',
      wordbookSettingsModalTitle: '设置',
      wordbookAiTabCustomPromptDesc: '自定义 AI 随身问答的系统提示词（System Prompt），此 Prompt 会引导 AI 在解答所有问题时的人设与回答风格。',
      wordbookAiCustomPromptPlaceholder: '输入自定义全局系统提示词...',
      wordbookAiTabNotePrompt: '笔记 Prompt',
      wordbookAiTabNotePromptDesc: '自定义生词本中 AI 编纂或批量生成笔记时的提示词（Prompt），引导 AI 生成符合您个人习惯的笔记释义。',
      wordbookAiNotePromptPlaceholder: '输入自定义 AI 笔记提示词...',
      wordbookTagPronunciation: '发音',
      wordbookTagDefinitions: '词典释义',
      wordbookAiInsertVariable: '插入变量：',
      wordbookTagTargetLang: '目标语言',
      wordbookTagWord: '选中词',
      wordbookClickToInsert: '点击插入',
      wordbookRestoreDefaultPrompt: '恢复预设 Prompt',
      wordbookPromptSaved: '✓ 已保存',
      wordbookRestoreDefaultActions: '恢复默认指令',
      wordbookRestoreDefaultEngines: '恢复默认搜索源',
      engineWiki: 'Wiki 粤语词典',
      engineWordsHk: 'Words.hk 粤典',
      engineSheik: '羊羊粤语词典',
      engineTwitter: 'X (Twitter) 搜索',
      engineGoogle: 'Google 粤语搜索',
      dictLabelJyutping: '粤拼:',
      dictLabelYale: '耶鲁:',
      dictLabelSims: '近义：',
      dictLabelAnts: '反义：',
      dictLabelVariants: '异体：',
      dictBtnReport: '报告',
      dictReportTitle: '报告错误',
      dictReportWord: '词语：',
      dictReportPlaceholder: '请描述具体的错误（例如读音不正确、释义有误等）...',
      dictReportSend: '发送报告',
      dictReportSending: '发送中...',
      dictReportSent: '报告已送出',
      dictReportFailed: '发送失败',
      dictBookmarkAdd: '加入生词本',
      dictBookmarkRemove: '从生词本移除',
      wordbookSelectItem: '点击选中',
      wordbookDeselectItem: '點擊取消選中',
      folderAll: '全部生詞',
      folderDefault: '生詞本',
      folderNew: '新建資料夾',
      folderEdit: '編輯資料夾',
      folderDelete: '刪除資料夾',
      folderSetDefault: '設為預設生詞本',
      folderDefaultBadge: '預設',
      folderMoveTo: '移動至資料夾',
      folderMoveHere: '移動選中的 $1 個生詞至此',
      folderMovedSuccess: '已移動 $1 個生詞至「$2」',
      folderNameLabel: '資料夾名稱',
      folderNamePlaceholder: '請輸入資料夾名稱（如：日常口語、餐飲）…',
      folderColorLabel: '標籤顏色',
      folderDeleteConfirmTitle: '刪除資料夾',
      folderDeleteConfirmDesc: '資料夾「$1」內含有 $2 個生詞，請選擇處理方式：',
      folderDeleteMoveOption: '保留生詞（移至預設資料夾）',
      folderDeleteMoveOptionDesc: '生詞不會丟失，自動移至預設資料夾中。',
      folderDeletePurgeOption: '同時將資料夾內的生詞移至廢紙簍',
      folderDeletePurgeOptionDesc: '生詞將移入廢紙簍，可在 30 天內還原。',
      folderDeleteEmptyConfirm: '確定要刪除資料夾「$1」嗎？',
      folderSetDefaultDesc: '新收藏的生詞將自動存入此生詞本。',
      folderBelongsTo: '所屬資料夾',
      folderDeleted: '已刪除資料夾「$1」'
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
      wordbookSearchPrefix: 'Search',
      spellingQuizBtn: 'Spelling Quiz',
      spellingQuizTitle: 'Spelling Quiz',
      spellingQuizBack: 'Back to Wordbook',
      spellingQuizSkip: 'Skip',
      spellingQuizConfirm: 'Confirm',
      spellingQuizHint: 'Hint',
      spellingQuizShowHint: 'Show Hint',
      spellingQuizCorrect: 'Correct!',
      spellingQuizWrong: 'The correct answer is',
      spellingQuizNext: 'Next',
      spellingQuizComplete: 'Quiz Complete!',
      spellingQuizAccuracy: 'Accuracy',
      spellingQuizTime: 'Time',
      spellingQuizRetry: 'Try Again',
      spellingQuizRetryWrong: 'Retry Wrong Only',
      spellingQuizNoWords: 'Not Enough Words',
      spellingQuizNoWordsDetail: 'Please save more words with example sentences (at least 3)',
      spellingQuizInputPlaceholder: 'Type your answer…',
      spellingQuizProgress: '$1 / $2',
      spellingQuizResultCorrect: 'Correct',
      spellingQuizResultWrong: 'Wrong',
      spellingQuizResultSkipped: 'Skipped',
      spellingQuizSeconds: 's',
      spellingQuizReviewTitle: 'Review',
      wordbookNote: 'Note',
      wordbookAddNote: 'Add Note',
      wordbookEditNote: 'Edit Note',
      wordbookDeleteNote: 'Delete Note',
      wordbookNoteTitle: 'Custom Note',
      wordbookNotePlaceholder: 'Write your memory tips, example sentences, or notes here...',
      wordbookNoteSave: 'Save Note',
      wordbookNoteCancel: 'Cancel',
      wordbookNoteDeleteConfirm: 'Are you sure you want to delete this note?',
      wordbookNoteShortcutHint: 'Cmd/Ctrl + Enter to save',
      wordbookAiEditingPlaceholder: 'Editing with AI...',
      wordbookAiGenerateSelected: 'AI Note',
      wordbookAiAddNotes: 'AI Add Notes',
      wordbookAiTooltipDesc: 'Select words first, then click to generate notes with AI in bulk.',
      wordbookSelectUnannotated: 'Click to select all words without notes',
      wordbookAllHaveNotes: 'All words in the current list already have notes!',
      wordbookAiBulkConfirm: 'Generate AI notes for {n} selected words?',
      wordbookAiBulkTooltip: 'Generate AI notes for {n} selected words',
      wordbookAiBulkDisabledTooltip: 'Please select words first',
      wordbookTabShortcuts: 'Shortcuts & Audio',
      wordbookShortcutsDesc: 'Overview of keyboard shortcuts and customization of audio pronunciation on navigation.',
      shortcutNextWord: 'Navigate to next word',
      shortcutPrevWord: 'Navigate to previous word',
      shortcutPronounceActive: 'Pronounce active word manually',
      shortcutCloseModal: 'Close modal or context menu',
      settingAutoPronounceTitle: 'Auto-pronounce on navigation',
      settingAutoPronounceDesc: 'Automatically play Cantonese pronunciation when navigating words via ↑ / ↓ arrow keys.',
      settingsCategoryWordbook: 'Word Book',
      settingsCategoryAi: 'AI Assistant',
      wordbookSettingsModalTitle: 'Settings',
      wordbookAiTabCustomPromptDesc: 'Customize the system prompt for AI Q&A to guide the persona and answering style.',
      wordbookAiCustomPromptPlaceholder: 'Enter custom global system prompt...',
      wordbookAiTabNotePrompt: 'Note Prompt',
      wordbookAiTabNotePromptDesc: 'Customize the AI prompt for generating wordbook notes, guiding the AI to produce definitions tailored to your style.',
      wordbookAiNotePromptPlaceholder: 'Enter custom AI note prompt...',
      wordbookTagPronunciation: 'Pronunciation',
      wordbookTagDefinitions: 'Definitions',
      wordbookAiInsertVariable: 'Insert Variable:',
      wordbookTagTargetLang: 'Target Language',
      wordbookTagWord: 'Selected Word',
      wordbookClickToInsert: 'Click to insert',
      wordbookRestoreDefaultPrompt: 'Restore Default Prompt',
      wordbookPromptSaved: '✓ Saved',
      wordbookRestoreDefaultActions: 'Restore Default Actions',
      wordbookRestoreDefaultEngines: 'Restore Default Search Engines',
      engineWiki: 'Wiktionary Cantonese',
      engineWordsHk: 'Words.hk Cantonese Dict',
      engineSheik: 'Sheik Cantonese Dict',
      engineTwitter: 'Search on X (Twitter)',
      engineGoogle: 'Google Cantonese Search',
      dictLabelJyutping: 'Jyutping:',
      dictLabelYale: 'Yale:',
      dictLabelSims: 'Synonyms: ',
      dictLabelAnts: 'Antonyms: ',
      dictLabelVariants: 'Variants: ',
      dictBtnReport: 'Report',
      dictReportTitle: 'Report Issue',
      dictReportWord: 'Word: ',
      dictReportPlaceholder: 'Please describe the issue (e.g. incorrect pronunciation, definition error)...',
      dictReportSend: 'Send Report',
      dictReportSending: 'Sending...',
      dictReportSent: 'Report Sent',
      dictReportFailed: 'Failed to send',
      dictBookmarkAdd: 'Add to Word Book',
      dictBookmarkRemove: 'Remove from Word Book',
      wordbookSelectItem: 'Click to select',
      wordbookDeselectItem: 'Click to deselect',
      folderAll: 'All Words',
      folderDefault: 'Wordbook',
      folderNew: 'New Folder',
      folderEdit: 'Edit Folder',
      folderDelete: 'Delete Folder',
      folderSetDefault: 'Set as Default Wordbook',
      folderDefaultBadge: 'Default',
      folderMoveTo: 'Move to Folder',
      folderMoveHere: 'Move $1 selected words here',
      folderMovedSuccess: 'Moved $1 words to "$2"',
      folderNameLabel: 'Folder Name',
      folderNamePlaceholder: 'Enter folder name (e.g. Daily, Food)...',
      folderColorLabel: 'Label Color',
      folderDeleteConfirmTitle: 'Delete Folder',
      folderDeleteConfirmDesc: 'Folder "$1" contains $2 words. Please choose an action:',
      folderDeleteMoveOption: 'Keep words (move to default folder)',
      folderDeleteMoveOptionDesc: 'Words will not be lost and will be moved to the default folder.',
      folderDeletePurgeOption: 'Move words to trash',
      folderDeletePurgeOptionDesc: 'Words will be moved to trash and can be restored within 30 days.',
      folderDeleteEmptyConfirm: 'Are you sure you want to delete folder "$1"?',
      folderSetDefaultDesc: 'Newly saved words will automatically go into this wordbook.',
      folderBelongsTo: 'Folder',
      folderDeleted: 'Folder "$1" deleted'
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
      wordbookSearchPrefix: '検索',
      spellingQuizBtn: 'スペル練習',
      spellingQuizTitle: 'スペル練習',
      spellingQuizBack: '単語帳に戻る',
      spellingQuizSkip: 'スキップ',
      spellingQuizConfirm: '確認',
      spellingQuizHint: 'ヒント',
      spellingQuizShowHint: 'ヒントを表示',
      spellingQuizCorrect: '正解！',
      spellingQuizWrong: '正解は',
      spellingQuizNext: '次へ',
      spellingQuizComplete: '練習完了！',
      spellingQuizAccuracy: '正解率',
      spellingQuizTime: '所要時間',
      spellingQuizRetry: 'もう一回',
      spellingQuizRetryWrong: '間違いだけ再挑戦',
      spellingQuizNoWords: '問題が不足しています',
      spellingQuizNoWordsDetail: '例文付きの単語をもっと保存してください（最低3つ必要）',
      spellingQuizInputPlaceholder: '答えを入力…',
      spellingQuizProgress: '$1 / $2',
      spellingQuizResultCorrect: '正解',
      spellingQuizResultWrong: '不正解',
      spellingQuizResultSkipped: 'スキップ',
      spellingQuizSeconds: '秒',
      spellingQuizReviewTitle: '振り返り',
      wordbookNote: 'ノート',
      wordbookAddNote: 'ノートを追加',
      wordbookEditNote: 'ノートを編集',
      wordbookDeleteNote: 'ノートを削除',
      wordbookNoteTitle: 'カスタムノート',
      wordbookNotePlaceholder: '記憶のヒント、例文、メモをここに記入...',
      wordbookNoteSave: '保存',
      wordbookNoteCancel: 'キャンセル',
      wordbookNoteDeleteConfirm: 'このノートを削除してもよろしいですか？',
      wordbookNoteShortcutHint: 'Cmd/Ctrl + Enter で保存',
      wordbookAiEditingPlaceholder: 'AI で編集中...',
      wordbookAiGenerateSelected: 'AI ノート',
      wordbookAiAddNotes: 'AI ノート追加',
      wordbookAiTooltipDesc: 'ノートを作成したい単語を選択し、クリックすると AI が一括作成します。',
      wordbookSelectUnannotated: 'ノート未作成の単語をすべて選択',
      wordbookAllHaveNotes: '現在のリスト内のすべての単語にノートが作成済みです！',
      wordbookAiBulkConfirm: '選択した {n} 個の単語に AI でノートを作成しますか？',
      wordbookAiBulkTooltip: '選択した {n} 個の単語に AI でノートを作成',
      wordbookAiBulkDisabledTooltip: '単語を選択してください',
      wordbookTabShortcuts: 'ショートカットと音声',
      wordbookShortcutsDesc: '単語帳のキーボードショートカット一覧と単語切り替え時の発音設定。',
      shortcutNextWord: '次の単語に切り替え',
      shortcutPrevWord: '前の単語に切り替え',
      shortcutPronounceActive: '選択中の単語を手動で読み上げ',
      shortcutCloseModal: 'モーダルまたはメニューを閉じる',
      settingAutoPronounceTitle: '単語切り替え時に自動読み上げ',
      settingAutoPronounceDesc: '↑ / ↓ 方向キーで単語を切り替える際、広東語の発音を自動再生します。',
      settingsCategoryWordbook: '単語帳設定',
      settingsCategoryAi: 'AI 設定',
      wordbookSettingsModalTitle: '設定',
      wordbookAiTabCustomPromptDesc: 'AI アシスタントのシステムプロンプトをカスタマイズし、回答のペルソナやスタイルを設定します。',
      wordbookAiCustomPromptPlaceholder: 'カスタムグローバルシステムプロンプトを入力...',
      wordbookAiTabNotePrompt: 'ノート Prompt',
      wordbookAiTabNotePromptDesc: '単語帳で AI によるノート作成や一括生成時のプロンプト（Prompt）をカスタマイズし、好みの解説を作成します。',
      wordbookAiNotePromptPlaceholder: 'カスタム AI ノートプロンプトを入力...',
      wordbookTagPronunciation: '発音',
      wordbookTagDefinitions: '辞書釈義',
      wordbookAiInsertVariable: '変数を挿入：',
      wordbookTagTargetLang: '対象言語',
      wordbookTagWord: '選択単語',
      wordbookClickToInsert: 'クリックして挿入',
      wordbookRestoreDefaultPrompt: 'デフォルトの Prompt に戻す',
      wordbookPromptSaved: '✓ 保存しました',
      wordbookRestoreDefaultActions: 'デフォルトのアクションに戻す',
      wordbookRestoreDefaultEngines: 'デフォルトの検索エンジンに戻す',
      engineWiki: 'Wiktionary 広東語',
      engineWordsHk: 'Words.hk 広東語辞典',
      engineSheik: 'Sheik 広東語辞典',
      engineTwitter: 'X (Twitter) で検索',
      engineGoogle: 'Google 広東語検索',
      dictLabelJyutping: 'Jyutping:',
      dictLabelYale: 'Yale:',
      dictLabelSims: '類義語：',
      dictLabelAnts: '対義語：',
      dictLabelVariants: '異体字：',
      dictBtnReport: '報告',
      dictReportTitle: 'エラーを報告',
      dictReportWord: '単語：',
      dictReportPlaceholder: '具体的なエラー（発音の間違い、解説の誤りなど）を入力してください...',
      dictReportSend: '報告を送信',
      dictReportSending: '送信中...',
      dictReportSent: '報告を送信しました',
      dictReportFailed: '送信に失敗しました',
      dictBookmarkAdd: '単語帳に追加',
      dictBookmarkRemove: '単語帳から削除',
      wordbookSelectItem: 'クリックして選択',
      wordbookDeselectItem: 'クリックして選択解除',
      folderAll: 'すべての単語',
      folderDefault: '単語帳',
      folderNew: '新規フォルダ',
      folderEdit: 'フォルダを編集',
      folderDelete: 'フォルダを削除',
      folderSetDefault: 'デフォルト単語帳に設定',
      folderDefaultBadge: 'デフォルト',
      folderMoveTo: 'フォルダへ移動',
      folderMoveHere: '選択した $1 個の単語をここに移動',
      folderMovedSuccess: '$1 個の単語を「$2」に移動しました',
      folderNameLabel: 'フォルダ名',
      folderNamePlaceholder: 'フォルダ名を入力（例：日常会話、グルメなど）…',
      folderColorLabel: 'ラベル色',
      folderDeleteConfirmTitle: 'フォルダの削除',
      folderDeleteConfirmDesc: 'フォルダ「$1」には $2 個の単語が含まれています：',
      folderDeleteMoveOption: '単語を保持（デフォルトフォルダに移動）',
      folderDeleteMoveOptionDesc: '単語は保持され、デフォルトフォルダに自動移動します。',
      folderDeletePurgeOption: '単語をごみ箱に移動',
      folderDeletePurgeOptionDesc: '単語はごみ箱に移動し、30日以内であれば復元できます。',
      folderDeleteEmptyConfirm: 'フォルダ「$1」を削除してもよろしいですか？',
      folderSetDefaultDesc: '新しく保存された単語は自動的にこの単語帳に入ります。',
      folderBelongsTo: '所属フォルダ',
      folderDeleted: 'フォルダ「$1」を削除しました'
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
      wordbookSearchPrefix: '검색',
      spellingQuizBtn: '맞춤법 연습',
      spellingQuizTitle: '맞춤법 연습',
      spellingQuizBack: '단어장으로 돌아가기',
      spellingQuizSkip: '건너뛰기',
      spellingQuizConfirm: '확인',
      spellingQuizHint: '힌트',
      spellingQuizShowHint: '힌트 보기',
      spellingQuizCorrect: '정답!',
      spellingQuizWrong: '정답은',
      spellingQuizNext: '다음',
      spellingQuizComplete: '연습 완료!',
      spellingQuizAccuracy: '정답률',
      spellingQuizTime: '소요 시간',
      spellingQuizRetry: '다시 하기',
      spellingQuizRetryWrong: '틀린 것만 다시',
      spellingQuizNoWords: '문제가 부족합니다',
      spellingQuizNoWordsDetail: '예문이 있는 단어를 더 저장해 주세요 (최소 3개 필요)',
      spellingQuizInputPlaceholder: '답을 입력하세요…',
      spellingQuizProgress: '$1 / $2',
      spellingQuizResultCorrect: '정답',
      spellingQuizResultWrong: '오답',
      spellingQuizResultSkipped: '건너뜀',
      spellingQuizSeconds: '초',
      spellingQuizReviewTitle: '문제 리뷰',
      wordbookNote: '메모',
      wordbookAddNote: '메모 추가',
      wordbookEditNote: '메모 편집',
      wordbookDeleteNote: '메모 삭제',
      wordbookNoteTitle: '사용자 메모',
      wordbookNotePlaceholder: '기억 팁, 예문 또는 메모를 여기에 작성하세요...',
      wordbookNoteSave: '저장',
      wordbookNoteCancel: '취소',
      wordbookNoteDeleteConfirm: '이 메모를 삭제하시겠습니까?',
      wordbookNoteShortcutHint: 'Cmd/Ctrl + Enter 로 저장',
      wordbookAiEditingPlaceholder: 'AI로 편집 중...',
      wordbookAiGenerateSelected: 'AI 메모',
      wordbookAiAddNotes: 'AI 메모 추가',
      wordbookAiTooltipDesc: '메모를 작성할 단어를 선택한 후 클릭하면 AI가 일괄 생성합니다.',
      wordbookSelectUnannotated: '메모가 없는 모든 단어 선택',
      wordbookAllHaveNotes: '현재 목록의 모든 단어에 이미 메모가 작성되어 있습니다!',
      wordbookAiBulkConfirm: '선택한 {n}개 단어에 AI 메모를 생성하시겠습니까?',
      wordbookAiBulkTooltip: '선택한 {n}개 단어에 AI 메모 생성',
      wordbookAiBulkDisabledTooltip: '단어를 먼저 선택하세요',
      wordbookTabShortcuts: '단축키 및 발음',
      wordbookShortcutsDesc: '단어장 키보드 단축키 안내 및 단어 전환 시 발음 설정.',
      shortcutNextWord: '다음 단어로 이동',
      shortcutPrevWord: '이전 단어로 이동',
      shortcutPronounceActive: '현재 선택된 단어 수동 발음',
      shortcutCloseModal: '팝업 또는 메뉴 닫기',
      settingAutoPronounceTitle: '단어 이동 시 자동 발음',
      settingAutoPronounceDesc: '↑ / ↓ 방향키로 단어를 전환할 때 광둥어 발음을 자동으로 재생합니다.',
      settingsCategoryWordbook: '단어장 설정',
      settingsCategoryAi: 'AI 설정',
      wordbookSettingsModalTitle: '설정',
      wordbookAiTabCustomPromptDesc: 'AI 질의응답을 위한 시스템 프롬프트를 사용자 정의하여 답변 스타일과 페르소나를 설정합니다。',
      wordbookAiTabNotePrompt: '메모 Prompt',
      wordbookAiTabNotePromptDesc: '단어장에서 AI로 메모를 생성하거나 일괄 작성할 때 사용할 프롬프트(Prompt)를 맞춤 설정합니다.',
      wordbookAiNotePromptPlaceholder: '사용자 지정 AI 메모 프롬프트 입력...',
      wordbookTagPronunciation: '발음',
      wordbookTagDefinitions: '사전 뜻',
      wordbookAiInsertVariable: '변수 삽입:',
      wordbookTagTargetLang: '대상 언어',
      wordbookTagWord: '선택된 단어',
      wordbookClickToInsert: '클릭하여 삽입',
      wordbookRestoreDefaultPrompt: '기본 Prompt 복원',
      wordbookPromptSaved: '✓ 저장됨',
      wordbookRestoreDefaultActions: '기본 작업 복원',
      wordbookRestoreDefaultEngines: '기본 검색 엔진 복원',
      engineWiki: '위키낱말사전 광둥어',
      engineWordsHk: 'Words.hk 광둥어 사전',
      engineSheik: 'Sheik 광둥어 사전',
      engineTwitter: 'X (Twitter) 검색',
      engineGoogle: 'Google 광둥어 검색',
      dictLabelJyutping: 'Jyutping:',
      dictLabelYale: 'Yale:',
      dictLabelSims: '유의어: ',
      dictLabelAnts: '반의어: ',
      dictLabelVariants: '이체자: ',
      dictBtnReport: '신고',
      dictReportTitle: '오류 신고',
      dictReportWord: '단어: ',
      dictReportPlaceholder: '구체적인 오류(발음 오류, 뜻 오류 등)를 입력해 주세요...',
      dictReportSend: '신고 보내기',
      dictReportSending: '보내는 중...',
      dictReportSent: '신고가 제출되었습니다',
      dictReportFailed: '제출 실패',
      dictBookmarkAdd: '단어장에 추가',
      dictBookmarkRemove: '단어장에서 제거',
      wordbookSelectItem: '클릭하여 선택',
      wordbookDeselectItem: '클릭하여 선택 해제',
      folderAll: '전체 단어',
      folderDefault: '단어장',
      folderNew: '새 폴더',
      folderEdit: '폴더 편집',
      folderDelete: '폴더 삭제',
      folderSetDefault: '기본 단어장으로 설정',
      folderDefaultBadge: '기본',
      folderMoveTo: '폴더로 이동',
      folderMoveHere: '선택한 단어 $1개를 여기로 이동',
      folderMovedSuccess: '$1개의 단어를 \'$2\'(으)로 이동했습니다',
      folderNameLabel: '폴더 이름',
      folderNamePlaceholder: '폴더 이름을 입력하세요 (예: 일상 회화, 음식 등)…',
      folderColorLabel: '라벨 색상',
      folderDeleteConfirmTitle: '폴더 삭제',
      folderDeleteConfirmDesc: '\'$1\' 폴더에 단어 $2개가 포함되어 있습니다：',
      folderDeleteMoveOption: '단어 유지 (기본 폴더로 이동)',
      folderDeleteMoveOptionDesc: '단어가 삭제되지 않고 기본 폴더로 자동 이동됩니다.',
      folderDeletePurgeOption: '단어를 휴지통으로 이동',
      folderDeletePurgeOptionDesc: '단어가 휴지통으로 이동하며 30일 이내에 복원할 수 있습니다.',
      folderDeleteEmptyConfirm: '\'$1\' 폴더를 삭제하시겠습니까?',
      folderSetDefaultDesc: '새로 저장된 단어는 자동으로 이 단어장에 들어갑니다.',
      folderBelongsTo: '소속 폴더',
      folderDeleted: '\'$1\' 폴더를 삭제했습니다'
    }
  };

  let currentLang = 'zh-HK';

  function normalizeLang(lang) {
    if (!lang) return 'zh-HK';
    if (lang === 'zh-CN' || lang === 'zh_CN' || lang === 'zh-Hans' || lang === 'zh_Hans') return 'zh-CN';
    if (lang === 'zh-TW' || lang === 'zh_TW' || lang === 'zh-HK' || lang === 'zh_HK' || lang === 'zh-Hant' || lang === 'zh_Hant') return 'zh-HK';
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('ko')) return 'ko';
    return 'zh-HK';
  }

  function getDefaultSystemPrompt(lang) {
    const l = normalizeLang(lang || currentLang);
    if (l === 'zh-CN') {
      return '你是一个粤语语言专家。请用{targetLang}回答用户关于选中字词或句子的疑问，解答要简明扼要、准确可靠。';
    }
    if (l === 'en') {
      return 'You are an expert in Cantonese linguistics. Please answer the user\'s questions about the selected words or sentences in {targetLang}. Provide concise, accurate, and reliable explanations.';
    }
    if (l === 'ja') {
      return 'あなたは広東語の専門家です。選択された単語や文章に関する質問に{targetLang}で回答してください。簡潔で正確、信頼できる解説を提供してください。';
    }
    if (l === 'ko') {
      return '당신은 광둥어 언어 전문가입니다. 선택한 단어나 문장에 대한 사용자의 질문에 {targetLang}로 답변해 주세요. 간결하고 정확하며 신뢰할 수 있는 설명을 제공해 주세요.';
    }
    return '你是一個粵語語言專家。請用{targetLang}回答用戶關於選中字詞或句子的疑問，解答要簡明扼要、準確可靠。';
  }

  function getDefaultNotePrompt(lang) {
    const l = normalizeLang(lang || currentLang);
    if (l === 'zh-CN') {
      return '请用{targetLang}为粤语词条「{word}」提供精简清晰的释义或备忘笔记（15字以内）。若包含多个不同释义，请用分号「；」隔开。只输出文字本身，不要有引号或额外说明。';
    }
    if (l === 'en') {
      return 'Please provide a concise definition or memory note (within 15 words) in {targetLang} for the Cantonese term "{word}". If there are multiple distinct meanings, separate them with a semicolon ";". Output only the plain text without quotes or extra explanations.';
    }
    if (l === 'ja') {
      return '広東語の語彙「{word}」について、{targetLang}で簡潔明瞭な意味や暗記メモ（15文字以内）を提供してください。複数の異なる意味がある場合はセミコロン「；」で区切ってください。引用符や余計な説明は含めず、本文のみを出力してください。';
    }
    if (l === 'ko') {
      return '광둥어 어휘 "{word}"에 대해 {targetLang}로 간결하고 명확한 뜻이나 암기 메모(15자 이내)를 작성해 주세요. 여러 가지 다른 의미가 있는 경우 세미콜론(;)으로 구분해 주세요. 따옴표나 추가 설명 없이 본문만 출력해 주세요.';
    }
    return '請用{targetLang}為粵語詞條「{word}」提供精簡清晰的釋義或備忘筆記（15字以內）。若包含多個不同釋義，請用分號「；」隔開。只輸出文字本身，不要有引號或額外說明。';
  }

  const ALL_DEFAULT_SYSTEM_PROMPTS = [
    '你是一個粵語語言專家。請用{targetLang}回答用戶關於選中字詞或句子的疑問，解答要簡明扼要、準確可靠。',
    '你是一个粤语语言专家。请用{targetLang}回答用户关于选中字词或句子的疑问，解答要简明扼要、准确可靠。',
    'You are an expert in Cantonese linguistics. Please answer the user\'s questions about the selected words or sentences in {targetLang}. Provide concise, accurate, and reliable explanations.',
    'あなたは広東語の専門家です。選択された単語や文章に関する質問に{targetLang}で回答してください。簡潔で正確、信頼できる解説を提供してください。',
    '당신은 광둥어 언어 전문가입니다. 선택한 단어나 문장에 대한 사용자의 질문에 {targetLang}로 답변해 주세요. 간결하고 정확하며 신뢰할 수 있는 설명을 제공해 주세요.'
  ];

  const ALL_DEFAULT_NOTE_PROMPTS = [
    '請用{targetLang}為粵語詞條「{word}」提供一句精簡清晰的釋義或備忘筆記（15字以內），適合放在生詞本中快速記憶。只輸出文字本身，不要有引號或額外說明。',
    '请用{targetLang}为粤语词条「{word}」提供一句精简清晰的释义或备忘笔记（15字以内），适合放在生词本中快速记忆。只输出文字本身，不要有引号或额外说明。',
    'Please provide a concise definition or note in {targetLang} for the Cantonese word "{word}" (under 15 words) for quick vocabulary memorization. Output only the note text without quotes or explanations.',
    '広東語の単語「{word}」について、単語帳での暗記に適した簡潔でわかりやすいノートまたは解説を{targetLang}で短く作成してください。引用符や説明を含めず、本文のみ出力してください。',
    '광둥어 단어 "{word}"에 대해 단어장에서 빠르게 암기할 수 있도록 간결하고 명확한 메모를 {targetLang}로 작성해 주세요. 따옴표나 추가 설명 없이 내용만 출력하세요.',
    '請用{targetLang}為粵語詞條「{word}」提供精簡清晰的釋義或備忘筆記（15字以內）。若包含多個不同釋義，請用分號「；」隔開。只輸出文字本身，不要有引號或額外說明。',
    '请用{targetLang}为粤语词条「{word}」提供精简清晰的释义或备忘笔记（15字以内）。若包含多个不同释义，请用分号「；」隔开。只输出文字本身，不要有引号或额外说明。',
    'Please provide a concise definition or memory note (within 15 words) in {targetLang} for the Cantonese term "{word}". If there are multiple distinct meanings, separate them with a semicolon ";". Output only the plain text without quotes or extra explanations.',
    '広東語の語彙「{word}」について、{targetLang}で簡潔明瞭な意味や暗記メモ（15文字以内）を提供してください。複数の異なる意味がある場合はセミコロン「；」で区切ってください。引用符や余計な説明は含めず、本文のみを出力してください。',
    '광둥어 어휘 "{word}"에 대해 {targetLang}로 간결하고 명확한 뜻이나 암기 메모(15자 이내)를 작성해 주세요. 여러 가지 다른 의미가 있는 경우 세미콜론(;)으로 구분해 주세요. 따옴표나 추가 설명 없이 본문만 출력해 주세요.'
  ];

  function isDefaultSystemPrompt(prompt) {
    if (!prompt || !prompt.trim()) return true;
    return ALL_DEFAULT_SYSTEM_PROMPTS.some(p => p.trim() === prompt.trim());
  }

  function isDefaultNotePrompt(prompt) {
    if (!prompt || !prompt.trim()) return true;
    return ALL_DEFAULT_NOTE_PROMPTS.some(p => p.trim() === prompt.trim());
  }

  function getEffectiveSystemPrompt(lang) {
    if (!globalAiCustomSystemPrompt || isDefaultSystemPrompt(globalAiCustomSystemPrompt)) {
      return getDefaultSystemPrompt(lang || currentLang);
    }
    return globalAiCustomSystemPrompt;
  }

  function getEffectiveNotePrompt(lang) {
    if (!globalAiCustomNotePrompt || isDefaultNotePrompt(globalAiCustomNotePrompt)) {
      return getDefaultNotePrompt(lang || currentLang);
    }
    return globalAiCustomNotePrompt;
  }

  function resolveNotePrompt(template, word, pronunciation, definitions, targetLang) {
    const rawTemplate = (template && !isDefaultNotePrompt(template))
      ? template.trim()
      : getDefaultNotePrompt(currentLang);
    return rawTemplate
      .replace(/\{targetLang\}/g, targetLang || '繁體中文')
      .replace(/\{word\}/g, word || '')
      .replace(/\{pronunciation\}/g, pronunciation || '')
      .replace(/\{definitions\}/g, definitions || '');
  }

  const DEFAULT_AI_SYSTEM_PROMPT = '你是一個粵語語言專家。請用{targetLang}回答用戶關於選中字詞或句子的疑問，解答要簡明扼要、準確可靠。';
  const DEFAULT_AI_NOTE_PROMPT = '請用{targetLang}為粵語詞條「{word}」提供精簡清晰的釋義或備忘筆記（15字以內）。若包含多個不同釋義，請用分號「；」隔開。只輸出文字本身，不要有引號或額外說明。';

  const AI_PROMPT_PRESETS = {
    expert: '你是一個粵語語言專家。請用{targetLang}回答用戶關於選中字詞或句子的疑問，解答要簡明扼要、準確可靠。',
    examples: '你是一個熱情耐心的粵語老師。請用{targetLang}深入解答，並針對日常口語生活場景提供 2-3 個道地的粵語對話例句和繁體字解釋。',
    etymology: '你是一個語言學家。請從粵語語法結構、九聲六調、中古漢語詞源演變等學術維度進行深入剖析，並用{targetLang}清晰解答。',
    concise: '請以極簡扼要的方式回答，直接給出最核心的粵語發音、用法要點，不要冗長客套。'
  };

  let globalEnableAiQuickActions = true;
  let globalAiCustomSystemPrompt = '';
  let globalAiCustomNotePrompt = '';
  let globalAiQuickActions = [
    { id: 'default1', isDefault: true, labelKey: 'wordbookAiAction1', promptKey: 'wordbookAiQuery1', active: true },
    { id: 'default2', isDefault: true, labelKey: 'wordbookAiAction2', promptKey: 'wordbookAiQuery2', active: true },
    { id: 'default3', isDefault: true, labelKey: 'wordbookAiAction3', promptKey: 'wordbookAiQuery3', active: true },
    { id: 'default4', isDefault: true, labelKey: 'wordbookAiAction4', promptKey: 'wordbookAiQuery4', active: true }
  ];

  const DEFAULT_CONTEXT_MENU_ENGINES = [
    { id: 'wiki', isDefault: true, nameKey: 'engineWiki', name: '', url: 'https://zh.wiktionary.org/wiki/{word}', active: true, icon: 'wiki' },
    { id: 'wordshk', isDefault: true, nameKey: 'engineWordsHk', name: '', url: 'https://words.hk/zidian/v2/search?q={word}', active: true, icon: 'book' },
    { id: 'sheik', isDefault: true, nameKey: 'engineSheik', name: '', url: 'https://shyyp.net/search?q={word}', active: true, icon: 'sheep' },
    { id: 'twitter', isDefault: true, nameKey: 'engineTwitter', name: '', url: 'https://x.com/search?q="{word}"', active: true, icon: 'x' },
    { id: 'google', isDefault: true, nameKey: 'engineGoogle', name: '', url: 'https://www.google.com/search?q={word}+粵語', active: false, icon: 'globe' }
  ];

  const DEFAULT_ENGINE_IDS = ['wiki', 'wordshk', 'sheik', 'twitter', 'google'];
  const DEFAULT_ENGINE_NAME_KEYS = {
    wiki: 'engineWiki',
    wordshk: 'engineWordsHk',
    sheik: 'engineSheik',
    twitter: 'engineTwitter',
    google: 'engineGoogle'
  };

  const ALL_DEFAULT_ENGINE_NAMES = {
    wiki: ['Wiki 粵語詞典', 'Wiki 粤语词典', 'Wiktionary Cantonese', 'Wiktionary 広東語', '위키낱말사전 광둥어'],
    wordshk: ['Words.hk 粵典', 'Words.hk 粤典', 'Words.hk Cantonese Dict', 'Words.hk 広東語辞典', 'Words.hk 광둥어 사전'],
    sheik: ['羊羊粵語詞典', '羊羊粤语词典', 'Sheik Cantonese Dict', 'Sheik 広東語辞典', 'Sheik 광둥어 사전'],
    twitter: ['X (Twitter) 搜尋', 'X (Twitter) 搜索', 'Search on X (Twitter)', 'X (Twitter) で検索', 'X (Twitter) 검색'],
    google: ['Google 粵語搜尋', 'Google 粤语搜索', 'Google Cantonese Search', 'Google 広東語検索', 'Google 광둥어 검색']
  };

  function isDefaultEngineName(id, name) {
    if (!id || !name) return false;
    const defaults = ALL_DEFAULT_ENGINE_NAMES[id];
    if (!defaults) return false;
    return defaults.includes(name.trim());
  }

  function getEngineDisplayName(engine) {
    if (!engine) return '';
    if (engine.isDefault || (!engine.customName && DEFAULT_ENGINE_IDS.includes(engine.id))) {
      if (!engine.name || isDefaultEngineName(engine.id, engine.name)) {
        const key = DEFAULT_ENGINE_NAME_KEYS[engine.id];
        if (key) return t(key) || engine.name;
      }
    }
    return engine.name || '';
  }

  let globalContextMenuEngines = JSON.parse(JSON.stringify(DEFAULT_CONTEXT_MENU_ENGINES));

  chrome.storage.local.get(['enableAiQuickActions', 'aiQuickActions', 'aiCustomSystemPrompt', 'aiNotePrompt', 'customContextMenuEngines'], (result) => {
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
    if (result.aiNotePrompt !== undefined) {
      globalAiCustomNotePrompt = result.aiNotePrompt || '';
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
    if (changes.aiNotePrompt) {
      globalAiCustomNotePrompt = changes.aiNotePrompt.newValue || '';
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
    if (typeof updateSpellingQuizBtn === 'function') {
      updateSpellingQuizBtn();
    }
  }

  // ==================== State ====================

  const WORDBOOK_FOLDERS_KEY = 'wordbook_folders';
  const WORDBOOK_DEFAULT_FOLDER_KEY = 'wordbook_default_folder_id';
  const FOLDER_COLORS = ['default', '#2563EB', '#0891B2', '#059669', '#D97706', '#7C3AED', '#DB2777', '#475569'];

  let folders = [];
  let defaultFolderId = 'default';
  let currentFolderId = 'default';
  let editingFolderId = null;
  let deletingFolderId = null;
  let activeCtxFolderId = null;
  let selectedFolderColor = 'default';
  let overflowFoldersList = [];

  let wordbook = [];
  let filteredWords = [];
  let selectedIds = new Set();
  let currentSort = 'newest';
  let searchQuery = '';
  let currentView = 'all'; // 'all' | 'trash'

  async function getFolders() {
    return new Promise((resolve) => {
      chrome.storage.local.get([WORDBOOK_FOLDERS_KEY, WORDBOOK_DEFAULT_FOLDER_KEY], (res) => {
        let list = res[WORDBOOK_FOLDERS_KEY];
        let defId = res[WORDBOOK_DEFAULT_FOLDER_KEY] || 'default';
        if (!Array.isArray(list) || list.length === 0) {
          list = [{
            id: 'default',
            name: '生詞本',
            nameI18nKey: 'folderDefault',
            color: 'default',
            createdAt: 0,
            isDefault: true
          }];
          chrome.storage.local.set({
            [WORDBOOK_FOLDERS_KEY]: list,
            [WORDBOOK_DEFAULT_FOLDER_KEY]: 'default'
          });
        }
        let hasDef = false;
        list.forEach(f => {
          if (f.id === defId) {
            f.isDefault = true;
            hasDef = true;
          } else {
            f.isDefault = false;
          }
        });
        if (!hasDef && list.length > 0) {
          list[0].isDefault = true;
          defId = list[0].id;
          chrome.storage.local.set({ [WORDBOOK_DEFAULT_FOLDER_KEY]: defId });
        }
        folders = list;
        defaultFolderId = defId;
        resolve(folders);
      });
    });
  }

  async function saveFolders(newFolders) {
    folders = newFolders;
    return new Promise((resolve) => {
      chrome.storage.local.set({ [WORDBOOK_FOLDERS_KEY]: newFolders }, () => resolve(true));
    });
  }

  async function setDefaultFolderId(folderId) {
    const target = folders.find(f => f.id === folderId);
    if (!target) return false;
    folders.forEach(f => { f.isDefault = (f.id === folderId); });
    defaultFolderId = folderId;
    await saveFolders(folders);
    await new Promise(resolve => {
      chrome.storage.local.set({ [WORDBOOK_DEFAULT_FOLDER_KEY]: folderId }, resolve);
    });
    renderFolderTabs();
    renderList();
    return true;
  }

  async function createFolder(name, color = 'default', isDef = false) {
    if (!name || !name.trim()) return null;
    const newFolder = {
      id: 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      color: color,
      createdAt: Date.now(),
      isDefault: isDef
    };
    folders.push(newFolder);
    if (isDef) {
      folders.forEach(f => { f.isDefault = (f.id === newFolder.id); });
      defaultFolderId = newFolder.id;
      await chrome.storage.local.set({ [WORDBOOK_DEFAULT_FOLDER_KEY]: newFolder.id });
    }
    await saveFolders(folders);
    return newFolder;
  }

  async function updateFolder(id, updates) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return false;
    if (updates.name && updates.name.trim()) folder.name = updates.name.trim();
    if (updates.color) folder.color = updates.color;
    if (updates.isDefault) {
      folders.forEach(f => { f.isDefault = (f.id === id); });
      defaultFolderId = id;
      await chrome.storage.local.set({ [WORDBOOK_DEFAULT_FOLDER_KEY]: id });
    }
    await saveFolders(folders);
    return true;
  }

  async function deleteFolder(id, moveToDefault = true) {
    if (id === 'default') return false;
    let nextDef = defaultFolderId;
    if (id === defaultFolderId) {
      nextDef = 'default';
      defaultFolderId = 'default';
      await chrome.storage.local.set({ [WORDBOOK_DEFAULT_FOLDER_KEY]: 'default' });
    }
    folders = folders.filter(f => f.id !== id);
    folders.forEach(f => { f.isDefault = (f.id === defaultFolderId); });
    await saveFolders(folders);

    if (currentFolderId === id) {
      currentFolderId = 'default';
    }

    let modified = false;
    const now = Date.now();
    for (const w of wordbook) {
      if ((w.folderId || 'default') === id) {
        if (moveToDefault) {
          w.folderId = nextDef;
        } else {
          w.deletedAt = now;
        }
        modified = true;
      }
    }
    if (modified) {
      await saveWordbook(wordbook);
    }
    return true;
  }

  async function moveWordsToFolder(wordIds, targetFolderId) {
    const idSet = new Set(wordIds);
    let count = 0;
    for (const w of wordbook) {
      if (idSet.has(w.id)) {
        w.folderId = targetFolderId;
        count++;
      }
    }
    if (count > 0) {
      await saveWordbook(wordbook);
    }
    return count;
  }

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
  const bulkAiBtn = document.getElementById('bulkAiBtn');
  const bulkAiText = document.getElementById('bulkAiText');
  const linkSelectUnannotated = document.getElementById('linkSelectUnannotated');
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

  function applyTheme(theme) {
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.backgroundColor = '#121214';
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.style.backgroundColor = '#f8fafc';
    }
  }

  function initTheme() {
    const saved = localStorage.getItem('jyutping_ui_theme') || 'auto';
    applyTheme(saved);

    if (typeof chrome !== 'undefined' && chrome.storage) {
      if (chrome.storage.sync) {
        chrome.storage.sync.get(['uiTheme'], (res) => {
          const theme = (res && res.uiTheme) || saved || 'auto';
          localStorage.setItem('jyutping_ui_theme', theme);
          applyTheme(theme);
        });
      }

      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
          if (changes.uiTheme) {
            const theme = changes.uiTheme.newValue || 'auto';
            localStorage.setItem('jyutping_ui_theme', theme);
            applyTheme(theme);
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
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('jyutping_ui_theme', newTheme);
    applyTheme(newTheme);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ uiTheme: newTheme });
    }
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

    const sourceWords = wordbook.filter(w => {
      if (currentView === 'trash') return !!w.deletedAt;
      if (w.deletedAt) return false;
      if (currentFolderId && currentFolderId !== 'all') {
        return (w.folderId || 'default') === currentFolderId;
      }
      return true;
    });
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

    // Build chronological ID mapping for the current view and folder scope (1 = earliest created, N = newest)
    const currentScopeWords = wordbook.filter(w => {
      if (isTrash) return !!w.deletedAt;
      if (w.deletedAt) return false;
      if (currentFolderId && currentFolderId !== 'all') {
        return (w.folderId || 'default') === currentFolderId;
      }
      return true;
    });
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
            <label class="selection-label" title="${isChecked ? (t('wordbookDeselectItem') || '點擊取消選中') : (t('wordbookSelectItem') || '點擊選中')}">
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
    if (bulkAiBtn) {
      if (!bulkAiBtn.classList.contains('loading')) {
        if (count > 0) {
          bulkAiBtn.classList.add('active');
          if (bulkAiText) bulkAiText.textContent = `${t('wordbookAiAddNotes') || 'AI 添加筆記'} ( ${count} )`;
        } else {
          bulkAiBtn.classList.remove('active');
          if (bulkAiText) bulkAiText.textContent = t('wordbookAiAddNotes') || 'AI 添加筆記';
        }
      }
    }
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
    'col-meaning': `<div class="col-meaning"><span>Notes</span><div class="col-resizer" data-col="col-meaning" title="拖動調整寬度 / 雙擊恢復默認"></div></div>`,
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
        if (word.notes) {
          return `
            <div class="col-meaning">
              <div class="excel-cell" title="${escapeHtml(word.notes)}">
                <span class="excel-cell-text" style="display: flex; align-items: center; gap: 5px; color: var(--primary); font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(word.notes)}</span>
                </span>
              </div>
            </div>
          `;
        }
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
    'col-meaning': 'Notes',
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

  const MAX_TTS_CACHE_SIZE = 100;
  const ttsCache = new Map();

  function cacheTtsAudio(key, blobUrl) {
    if (ttsCache.has(key)) {
      const oldUrl = ttsCache.get(key);
      if (oldUrl && oldUrl !== blobUrl && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
      ttsCache.delete(key);
    } else if (ttsCache.size >= MAX_TTS_CACHE_SIZE) {
      const oldestKey = ttsCache.keys().next().value;
      const oldUrl = ttsCache.get(oldestKey);
      if (oldUrl && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
      ttsCache.delete(oldestKey);
    }
    ttsCache.set(key, blobUrl);
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
        const cacheKey = `${engine}:${rate}:${text}`;
        if (ttsCache.has(cacheKey)) {
          const cachedUrl = ttsCache.get(cacheKey);
          // Refresh LRU position
          ttsCache.delete(cacheKey);
          ttsCache.set(cacheKey, cachedUrl);

          const audio = new Audio(cachedUrl);
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
          audio.play().catch(() => stopSpeaking());
          return;
        }

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

          const blobUrl = URL.createObjectURL(blob);
          cacheTtsAudio(cacheKey, blobUrl);
          const audio = new Audio(blobUrl);
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
        if (isAutoPronounce) {
          triggerAutoPronounce(character, charEl);
        }
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

  // Quick select all words without notes from tooltip
  if (linkSelectUnannotated) {
    linkSelectUnannotated.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      selectedIds.clear();
      const unannotatedWords = filteredWords.filter(w => !w.deletedAt && (!w.notes || !w.notes.trim()));
      unannotatedWords.forEach(w => selectedIds.add(w.id));

      if (unannotatedWords.length === 0) {
        alert(t('wordbookAllHaveNotes') || '當前列表中的所有詞條均已添加筆記！');
      }

      renderList();
      updateSelectionUI();
    });
  }

  // Bulk AI Note generation
  if (bulkAiBtn) {
    bulkAiBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!bulkAiBtn.classList.contains('active') || bulkAiBtn.classList.contains('loading')) return;
      if (selectedIds.size === 0) return;

      const settings = await chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel', 'aiLanguage', 'uiLang', 'aiCustomSystemPrompt', 'aiNotePrompt']);
      if (!settings.aiBaseUrl || !settings.aiApiKey || !settings.aiModel) {
        alert(t('aiFeedbackConfigureTip') || '請先在設定中配置 AI 服務 (API Key)');
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
        return;
      }

      let targetLang = settings.aiLanguage || 'auto';
      if (targetLang === 'auto') {
        const langMap = { 'zh-HK': '繁體中文', 'zh-TW': '繁體中文', 'zh-CN': '簡體中文', 'en': 'English', 'ja': '日本語', 'ko': '한국어' };
        targetLang = langMap[settings.uiLang || uiLang] || '繁體中文';
      }

      const totalCount = selectedIds.size;
      const confirmMsg = (t('wordbookAiBulkConfirm') || '確定要使用 AI 為選中的 {n} 個詞條生成筆記釋義嗎？').replace('{n}', totalCount);
      if (!confirm(confirmMsg)) return;

      bulkAiBtn.classList.add('loading');
      if (bulkAiText) bulkAiText.textContent = `${t('wordbookAiGenerating') || '生成中...'} (0/${totalCount})`;

      const selectedWords = wordbook.filter(w => selectedIds.has(w.id));
      let doneCount = 0;

      async function processWord(w) {
        const char = w.character;
        const entry = (dictionary && dictionary[char]) || {};
        const pronunciation = entry.jyutping || entry.yale || w.jyutping || w.yale || '';
        const definitions = (entry.english || [])
          .filter(d => d)
          .map(d => typeof d === 'string' ? d : '')
          .filter(Boolean)
          .join('; ');

        const promptQuestion = resolveNotePrompt(settings.aiNotePrompt || globalAiCustomNotePrompt, char, pronunciation, definitions, targetLang);

        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'aiChatQuery',
            word: char,
            sentence: `${char}（${pronunciation}）：${definitions}`,
            originalTranslation: definitions,
            question: promptQuestion,
            history: [],
            systemPrompt: `你是一個粵語語言專家。請為用戶提供精準、精煉的詞義或記憶備忘，使用${targetLang}回答，字數嚴格控制在15字以內。若有多個不同釋義，請用分號「；」隔開，直接返回純文本內容。`
          }, (response) => {
            if (response && response.success && response.reply) {
              let cleanReply = response.reply.trim()
                .replace(/^["'「」『』`]+|["'「」『』`]+$/g, '')
                .replace(/^(釋義|意思|筆記|註解)[：:]\s*/i, '');
              w.notes = cleanReply;
            }
            doneCount++;
            if (bulkAiText) bulkAiText.textContent = `${t('wordbookAiGenerating') || '生成中...'} (${doneCount}/${totalCount})`;
            resolve();
          });
        });
      }

      // 順序併發執行（2 個並發，避免超出速率限制）
      const concurrency = 2;
      for (let i = 0; i < selectedWords.length; i += concurrency) {
        const batch = selectedWords.slice(i, i + concurrency);
        await Promise.all(batch.map(w => processWord(w)));
      }

      await saveWordbook(wordbook);
      renderList();

      // 同步更新右側正在查看的詞條筆記（若存在）
      const activeWord = detailPane?.dataset?.activeWord;
      if (activeWord) {
        const updatedItem = wordbook.find(w => w.character === activeWord && !w.deletedAt);
        if (updatedItem) {
          const noteContentEl = document.getElementById('detailNoteContent');
          if (noteContentEl) noteContentEl.textContent = updatedItem.notes || '';
          const noteTextarea = document.getElementById('detailNoteTextarea');
          if (noteTextarea) noteTextarea.value = updatedItem.notes || '';
        }
      }

      bulkAiBtn.classList.remove('loading');
      updateSelectionUI();
    });
  }

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
    renderFolderTabs();
    initFolderEvents();
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
    console.log('[AI Chat] Rendered response bubble into container:', container, 'bubble content length:', replyText?.length);

    // Auto-scroll the container so the response is immediately visible
    const scrollContainer = document.getElementById('detailScrollBody');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      setTimeout(() => {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
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
      const scrollContainer = document.getElementById('detailScrollBody');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      }

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
        if (scrollContainer) {
          scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        }
      });
    };

    let isGenericImeComposing = false;
    if (aiChatInput) {
      aiChatInput.addEventListener('compositionstart', () => {
        isGenericImeComposing = true;
        console.log('[AI Generic] IME composition started');
      });
      aiChatInput.addEventListener('compositionend', () => {
        isGenericImeComposing = false;
        console.log('[AI Generic] IME composition ended');
      });
    }

    const handleGenericSubmit = () => {
      const query = aiChatInput ? aiChatInput.value.trim() : '';
      console.log('[AI Generic] Submit triggered. Query:', query);
      if (query) {
        sendGenericQuestion(query);
        if (aiChatInput) aiChatInput.value = '';
      } else {
        console.warn('[AI Generic] Query is empty, nothing to send.');
      }
    };

    if (aiSendBtn) {
      aiSendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[AI Generic] Send button clicked');
        handleGenericSubmit();
      });
    }

    if (aiChatInput) {
      aiChatInput.addEventListener('keydown', (e) => {
        console.log('[AI Generic Keydown]', { key: e.key, code: e.code, keyCode: e.keyCode, isComposing: e.isComposing, isGenericImeComposing });
        if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13) {
          if (isGenericImeComposing && e.keyCode === 229) {
            console.log('[AI Generic Keydown] Suppressed IME candidate confirmation (keyCode 229)');
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          handleGenericSubmit();
        }
      });
    }
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
    const isSaved = wordbook.some(w => w.character === character && !w.deletedAt);
    const wordItem = wordbook.find(w => w.character === character && !w.deletedAt);
    const existingNote = wordItem ? (wordItem.notes || '') : '';
    
    // Header
    let html = `
      <div class="detail-scroll-body" id="detailScrollBody">
        <div id="cantonese-popup-dict" style="position: static; width: 100%; filter: none; margin: 0; padding: 0; background: transparent;">
          <div class="popup-main" style="width: 100%; min-width: auto; padding: 0; position: relative;">
          <!-- Action Buttons -->
          <div class="detail-actions-wrapper" id="detailActionsWrapper">
            <div class="detail-note-btn ${existingNote ? 'has-note' : ''}" id="detailNoteBtn" title="${existingNote ? (t('wordbookEditNote') || '編輯筆記') : (t('wordbookAddNote') || '添加筆記')}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 3px;">
                ${existingNote
                  ? '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>'
                  : '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>'
                }
              </svg>
              <span>${t('wordbookNote') || '筆記'}</span>
            </div>
            <div class="detail-report-btn" id="detailReportBtn" title="${t('dictReportTitle') || '報告錯誤'}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; flex-shrink: 0;">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
              <span>${t('dictBtnReport') || '報告'}</span>
            </div>
            <div class="detail-bookmark-btn" id="detailBookmarkBtn" title="${isSaved ? (t('dictBookmarkRemove') || '從生詞本移除') : (t('dictBookmarkAdd') || '加入生詞本')}">
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
      const isYale = !entry.jyutping && !!entry.yale;
      const phoneticLabel = isYale ? (t('dictLabelYale') || '耶魯:') : (t('dictLabelJyutping') || '粵拼:');
      html += `
        <div class="pronunciation-section" style="margin-top: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--popup-divider-strong); padding-bottom: 12px;">
          <span class="pronunciation-label">${phoneticLabel}</span>
          <span class="pronunciation-text" id="detailPronunciationText" style="cursor: pointer; font-size: 15px;">${pronunciation}</span>
          <button class="tts-speaker-btn" id="detailSpeakerBtn" title="${t('wordbookPlayAudio') || '播放發音'}" aria-label="${t('wordbookPlayAudio') || '播放發音'}">
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
      refLines.push(`<div class="ref-line"><span class="see-also-label">${t('dictLabelSims') || '近義：'}</span>${simLinks}</div>`);
    }
    if (entry.ants && entry.ants.length > 0) {
      const antLinks = entry.ants.map(w => `<span class="see-also-link" data-word="${w}">${w}</span>`).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">${t('dictLabelAnts') || '反義：'}</span>${antLinks}</div>`);
    }
    if (entry.see_also && entry.see_also.length > 0) {
      const seeLinks = entry.see_also.map(w => `<span class="see-also-link" data-word="${w}">${w}</span>`).join('、');
      refLines.push(`<div class="ref-line"><span class="see-also-label">${t('dictLabelVariants') || '異體：'}</span>${seeLinks}</div>`);
    }
    
    if (refLines.length > 0) {
      html += `<div class="see-also-section" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--popup-divider-strong);">${refLines.join('')}</div>`;
    }

    // Note Section
    html += `
      <div class="detail-note-section" id="detailNoteSection">
        <!-- Note Card (shown when note exists) -->
        <div class="detail-note-card" id="detailNoteCard" style="${existingNote ? '' : 'display: none;'}">
          <div class="detail-note-header">
            <div class="detail-note-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>${t('wordbookNote') || '筆記'}</span>
            </div>
            <div class="detail-note-actions">
              <button class="detail-note-action-btn" id="detailNoteEditBtn" title="${t('wordbookEditNote') || '編輯筆記'}" aria-label="${t('wordbookEditNote') || '編輯筆記'}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="detail-note-action-btn btn-delete" id="detailNoteDeleteBtn" title="${t('wordbookDeleteNote') || '刪除筆記'}" aria-label="${t('wordbookDeleteNote') || '刪除筆記'}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="detail-note-content" id="detailNoteContent">${escapeHtml(existingNote)}</div>
        </div>

        <!-- Note Editor (hidden by default) -->
        <div class="detail-note-editor" id="detailNoteEditor" style="display: none;">
          <textarea id="detailNoteTextarea" class="detail-note-textarea" placeholder="${t('wordbookNotePlaceholder') || '在此記錄記憶技巧、生活例句或筆記備註...'}">${escapeHtml(existingNote)}</textarea>
          <div class="detail-note-footer">
            <span class="detail-note-hint">${t('wordbookNoteShortcutHint') || 'Cmd/Ctrl + Enter 保存'}</span>
            <div class="detail-note-btn-group">
              <svg class="detail-note-ai-icon" id="detailNoteAiBtn" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="${t('wordbookAiGenerateNote') || 'AI 撰寫釋義'}">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
                <path d="M5 3v4"></path>
                <path d="M19 17v4"></path>
                <path d="M3 5h4"></path>
                <path d="M17 19h4"></path>
              </svg>
              <button class="btn" id="detailNoteCancelBtn">${t('wordbookNoteCancel') || '取消'}</button>
              <button class="btn btn-primary" id="detailNoteSaveBtn">${t('wordbookNoteSave') || '保存筆記'}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Report Form (hidden by default)
    html += `
      <div class="detail-report-form" id="detailReportForm" style="display: none;">
        <div class="detail-report-header">
          <span>${t('dictReportTitle') || '報告錯誤'}</span>
          <span class="detail-report-close" id="detailReportClose">✕</span>
        </div>
        <div class="detail-report-preview">
          <div><strong>${t('dictReportWord') || '詞語：'}</strong><span id="detailReportWord">${character}</span></div>
        </div>
        <textarea id="detailReportTextarea" class="detail-report-textarea" placeholder="${t('dictReportPlaceholder') || '請描述具體的錯誤（例如讀音不正確、釋義有誤等）...'}"></textarea>
        <div class="detail-report-actions">
          <button class="btn" id="detailReportCancelBtn">${t('wordbookNoteCancel') || '取消'}</button>
          <button class="btn btn-primary" id="detailReportSendBtn">${t('dictReportSend') || '發送報告'}</button>
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

    // Restore cached AI answer for this word if previously queried
    if (wordAiHistoryMap[character] && wordAiHistoryMap[character].reply) {
      const cached = wordAiHistoryMap[character];
      setTimeout(() => {
        const currentAiResponseArea = document.getElementById('aiResponseArea');
        if (currentAiResponseArea) {
          renderAiResponseBubble(currentAiResponseArea, cached.reply, cached.elapsed, () => sendAiQuestion(cached.question), cached.question, character);
        }
      }, 0);
    }

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
          reportSend.textContent = t('dictReportSending') || '發送中...';
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
              reportSend.textContent = '✓ ' + (t('dictReportSent') || '報告已送出');
              reportSend.style.background = '#4caf50';
              reportSend.style.borderColor = '#4caf50';
            } else {
              reportSend.textContent = '❌ ' + (t('dictReportFailed') || '發送失敗');
              reportSend.style.background = '#f44336';
              reportSend.style.borderColor = '#f44336';
              console.error('Email API Error:', result);
            }
          } catch (error) {
            reportSend.textContent = '❌ ' + (t('dictReportFailed') || '發送失敗');
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

    // ==================== Detail Note Binding ====================
    const noteBtn = document.getElementById('detailNoteBtn');
    const noteSection = document.getElementById('detailNoteSection');
    const noteCard = document.getElementById('detailNoteCard');
    const noteContent = document.getElementById('detailNoteContent');
    const noteEditor = document.getElementById('detailNoteEditor');
    const noteTextarea = document.getElementById('detailNoteTextarea');
    const noteEditBtn = document.getElementById('detailNoteEditBtn');
    const noteDeleteBtn = document.getElementById('detailNoteDeleteBtn');
    const noteCancelBtn = document.getElementById('detailNoteCancelBtn');
    const noteSaveBtn = document.getElementById('detailNoteSaveBtn');

    function openNoteEditor() {
      const currentWord = wordbook.find(w => w.character === character && !w.deletedAt);
      const curNote = currentWord ? (currentWord.notes || '') : '';
      if (noteTextarea) {
        noteTextarea.value = curNote;
      }
      if (noteCard) noteCard.style.display = 'none';
      if (noteEditor) noteEditor.style.display = 'flex';
      if (noteTextarea) {
        noteTextarea.focus();
        noteTextarea.setSelectionRange(noteTextarea.value.length, noteTextarea.value.length);
      }
      if (noteSection) {
        noteSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function closeNoteEditor() {
      const currentWord = wordbook.find(w => w.character === character && !w.deletedAt);
      const curNote = currentWord ? (currentWord.notes || '') : '';
      if (noteEditor) noteEditor.style.display = 'none';
      if (curNote) {
        if (noteCard) noteCard.style.display = 'block';
        if (noteContent) noteContent.textContent = curNote;
      } else {
        if (noteCard) noteCard.style.display = 'none';
      }
    }

    async function saveNoteAction() {
      if (!noteTextarea) return;
      const newNote = noteTextarea.value.trim();
      let currentWord = wordbook.find(w => w.character === character && !w.deletedAt);

      if (!currentWord) {
        // Auto-add to wordbook
        currentWord = {
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
          notes: newNote
        };
        wordbook.unshift(currentWord);

        const bookmarkBtn = document.getElementById('detailBookmarkBtn');
        if (bookmarkBtn) {
          const svg = bookmarkBtn.querySelector('svg');
          if (svg) {
            svg.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#D4AF37" stroke="#D4AF37" stroke-width="1.5"></polygon>';
          }
          bookmarkBtn.title = '從生詞本移除';
        }
      } else {
        currentWord.notes = newNote;
      }

      await saveWordbook(wordbook);
      renderList();
      updateStats();
      updateStorage();

      if (noteBtn) {
        if (newNote) {
          noteBtn.classList.add('has-note');
          noteBtn.title = t('wordbookEditNote') || '編輯筆記';
          noteBtn.querySelector('svg').innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>';
        } else {
          noteBtn.classList.remove('has-note');
          noteBtn.title = t('wordbookAddNote') || '添加筆記';
          noteBtn.querySelector('svg').innerHTML = '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>';
        }
      }

      closeNoteEditor();
    }

    async function deleteNoteAction() {
      const currentWord = wordbook.find(w => w.character === character && !w.deletedAt);
      if (!currentWord || !currentWord.notes) return;

      const confirmMsg = t('wordbookNoteDeleteConfirm') || '確定要刪除此筆記嗎？';
      if (!confirm(confirmMsg)) return;

      currentWord.notes = '';
      await saveWordbook(wordbook);
      renderList();
      updateStats();
      updateStorage();

      if (noteBtn) {
        noteBtn.classList.remove('has-note');
        noteBtn.title = t('wordbookAddNote') || '添加筆記';
        noteBtn.querySelector('svg').innerHTML = '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>';
      }

      if (noteTextarea) noteTextarea.value = '';
      if (noteEditor) noteEditor.style.display = 'none';
      if (noteCard) noteCard.style.display = 'none';
    }

    async function generateAiNote() {
      if (!character) return;
      const aiBtn = document.getElementById('detailNoteAiBtn');

      // 檢查 AI 配置
      const settings = await chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel', 'aiLanguage', 'uiLang', 'aiCustomSystemPrompt', 'aiNotePrompt']);
      if (!settings.aiBaseUrl || !settings.aiApiKey || !settings.aiModel) {
        alert(t('aiFeedbackConfigureTip') || '請先在設定中配置 AI 服務 (API Key)');
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
        return;
      }

      openNoteEditor();

      if (aiBtn) {
        aiBtn.classList.add('loading');
      }

      const origPlaceholder = noteTextarea ? noteTextarea.placeholder : '';
      if (noteTextarea) {
        noteTextarea.value = '';
        noteTextarea.placeholder = t('wordbookAiEditingPlaceholder') || '正在使用 AI 進行編輯...';
      }

      let targetLang = settings.aiLanguage || 'auto';
      if (targetLang === 'auto') {
        const langMap = { 'zh-HK': '繁體中文', 'zh-TW': '繁體中文', 'zh-CN': '簡體中文', 'en': 'English', 'ja': '日本語', 'ko': '한국어' };
        targetLang = langMap[settings.uiLang || uiLang] || '繁體中文';
      }

      const pronunciation = entry.jyutping || entry.yale || '';
      const definitions = (entry.english || [])
        .filter(d => d)
        .map(d => typeof d === 'string' ? d : '')
        .filter(Boolean)
        .join('; ');

      const promptQuestion = resolveNotePrompt(settings.aiNotePrompt || globalAiCustomNotePrompt, character, pronunciation, definitions, targetLang);

      chrome.runtime.sendMessage({
        action: 'aiChatQuery',
        word: character,
        sentence: `${character}（${pronunciation}）：${definitions}`,
        originalTranslation: definitions,
        question: promptQuestion,
        history: [],
        systemPrompt: `你是一個粵語語言專家。請為用戶提供精準、精煉的詞義或記憶備忘，使用${targetLang}回答，字數嚴格控制在15字以內。若有多個不同釋義，請用分號「；」隔開，直接返回純文本內容。`
      }, (response) => {
        if (aiBtn) {
          aiBtn.classList.remove('loading');
        }
        if (noteTextarea) {
          noteTextarea.placeholder = origPlaceholder;
        }

        if (response && response.success && response.reply) {
          let cleanReply = response.reply.trim()
            .replace(/^["'「」『』`]+|["'「」『』`]+$/g, '')
            .replace(/^(釋義|意思|筆記|註解)[：:]\s*/i, '');
          if (noteTextarea) {
            let i = 0;
            const textToStream = cleanReply;
            const timer = setInterval(() => {
              i++;
              noteTextarea.value = textToStream.slice(0, i);
              if (i >= textToStream.length) {
                clearInterval(timer);
                noteTextarea.focus();
                noteTextarea.setSelectionRange(textToStream.length, textToStream.length);
              }
            }, 30);
          }
        } else {
          alert('AI 生成失敗：' + (response?.error || '請求出錯，請稍後重試'));
        }
      });
    }

    const noteAiBtn = document.getElementById('detailNoteAiBtn');
    if (noteAiBtn) noteAiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      generateAiNote();
    });

    if (noteBtn) noteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (noteEditor && noteEditor.style.display === 'flex') {
        closeNoteEditor();
      } else {
        openNoteEditor();
      }
    });
    if (noteEditBtn) noteEditBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openNoteEditor();
    });
    if (noteDeleteBtn) noteDeleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNoteAction();
    });
    if (noteCancelBtn) noteCancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeNoteEditor();
    });
    if (noteSaveBtn) noteSaveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveNoteAction();
    });
    if (noteTextarea) {
      noteTextarea.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          saveNoteAction();
        } else if (e.key === 'Escape') {
          closeNoteEditor();
        }
      });
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

      let aiChatHistory = (wordAiHistoryMap[character]?.history) ? [...wordAiHistoryMap[character].history] : [];
      let aiIsLoading = false;

      const sendAiQuestion = (question) => {
        console.log('[AI Chat] sendAiQuestion called:', { question, character, pronunciation, aiIsLoading });
        if (!question || !question.trim() || aiIsLoading) {
          console.warn('[AI Chat] Blocked question dispatch:', { empty: !question || !question.trim(), aiIsLoading });
          return;
        }
        aiIsLoading = true;
        if (aiSendBtn) aiSendBtn.disabled = true;
        if (aiChatInput) aiChatInput.readOnly = true;

        const startTime = performance.now();

        // Show typing indicator in active response area
        const currentAiResponseArea = document.getElementById('aiResponseArea');
        if (currentAiResponseArea) {
          currentAiResponseArea.innerHTML = `
            <div class="ai-typing-indicator">
              <div class="ai-typing-dot"></div>
              <div class="ai-typing-dot"></div>
              <div class="ai-typing-dot"></div>
            </div>
          `;
          const scrollContainer = document.getElementById('detailScrollBody');
          if (scrollContainer) {
            scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
          }
        }

        // Build context from dictionary entry
        const definitions = (entry.english || [])
          .filter(d => d)
          .map(d => typeof d === 'string' ? d : '')
          .filter(Boolean)
          .join('; ');

        console.log('[AI Chat] Dispatching chrome.runtime.sendMessage aiChatQuery with word:', character, 'question:', question);
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
          if (aiSendBtn) aiSendBtn.disabled = false;
          if (aiChatInput) {
            aiChatInput.readOnly = false;
            aiChatInput.focus();
          }

          const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
          console.log('[AI Chat] Received response in', elapsed, 's:', response, 'lastError:', chrome.runtime.lastError);

          if (response && response.success) {
            // Add to conversation history
            aiChatHistory.push({ role: 'user', content: question });
            aiChatHistory.push({ role: 'assistant', content: response.reply });

            // Persist into word AI cache
            wordAiHistoryMap[character] = {
              reply: response.reply,
              question: question,
              elapsed: elapsed,
              history: aiChatHistory
            };

            const targetWordStr = character ? `${character}${pronunciation ? ` (${pronunciation})` : ''}` : '';
            const activeResponseArea = document.getElementById('aiResponseArea');
            if (activeResponseArea) {
              renderAiResponseBubble(activeResponseArea, response.reply, elapsed, () => sendAiQuestion(question), question, targetWordStr);
            }
          } else {
            const errMsg = response?.error || chrome.runtime.lastError?.message || '請求失敗';
            console.error('[AI Chat] Query failed with error:', errMsg);
            const activeResponseArea = document.getElementById('aiResponseArea');
            if (activeResponseArea) {
              activeResponseArea.innerHTML = `<div class="ai-response-bubble"><div class="ai-response-meta"><span class="ai-badge">AI</span><span class="ai-timing">${elapsed}s</span></div><div class="ai-response-content" style="color: var(--text-muted);">${escapeHtml(errMsg)}</div></div>`;
            }
          }
          const scrollContainer = document.getElementById('detailScrollBody');
          if (scrollContainer) {
            scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
            setTimeout(() => {
              scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
            }, 80);
          }
        });
      };

      let isImeComposing = false;
      if (aiChatInput) {
        aiChatInput.addEventListener('compositionstart', () => {
          isImeComposing = true;
          console.log('[AI Chat] IME composition started');
        });
        aiChatInput.addEventListener('compositionend', () => {
          isImeComposing = false;
          console.log('[AI Chat] IME composition ended');
        });
      }

      const handleInputSubmit = () => {
        const rawVal = aiChatInput ? aiChatInput.value.trim() : '';
        // If user typed custom text, use it; if empty, default to asking for word explanation
        const query = rawVal || `請詳細介紹「${character}」在粵語中的含義、語境用法與地道例句。`;
        console.log('[AI Chat] Submit triggered. Raw value:', rawVal, 'Final query:', query);
        sendAiQuestion(query);
        if (aiChatInput) aiChatInput.value = '';
      };

      // Bind send button
      if (aiSendBtn) {
        aiSendBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('[AI Chat] Send button clicked');
          handleInputSubmit();
        });
      }

      // Bind Enter key
      if (aiChatInput) {
        aiChatInput.addEventListener('keydown', (e) => {
          console.log('[AI Chat Keydown]', { key: e.key, code: e.code, keyCode: e.keyCode, isComposing: e.isComposing, isImeComposing, value: aiChatInput.value });
          if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13) {
            // 如果处于输入法候选词选词阶段 (keyCode 229 或 isImeComposing 为 true 且在组合中)，不拦截
            if (isImeComposing && e.keyCode === 229) {
              console.log('[AI Chat Keydown] Suppressed IME candidate confirmation (keyCode 229)');
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            handleInputSubmit();
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

  // ==================== Folder Tabs & Management ====================

  const folderTabsBar = document.getElementById('folderTabsBar');
  const folderModal = document.getElementById('folderModal');
  const closeFolderModalBtn = document.getElementById('closeFolderModalBtn');
  const folderCancelBtn = document.getElementById('folderCancelBtn');
  const folderSaveBtn = document.getElementById('folderSaveBtn');
  const folderDeleteModal = document.getElementById('folderDeleteModal');
  const closeFolderDeleteModalBtn = document.getElementById('closeFolderDeleteModalBtn');
  const folderDeleteCancelBtn = document.getElementById('folderDeleteCancelBtn');
  const folderDeleteConfirmBtn = document.getElementById('folderDeleteConfirmBtn');

  function getCurrentFolderName() {
    const f = folders.find(folder => folder.id === currentFolderId);
    if (!f) return t('folderDefault') || '生詞本';
    return (f.id === 'default') ? (t('folderDefault') || '生詞本') : f.name;
  }

  function updateSpellingQuizBtn() {
    const spellingQuizLink = document.getElementById('spellingQuizLink');
    const spellingQuizBtnText = document.getElementById('spellingQuizBtnText');
    if (!spellingQuizLink || !spellingQuizBtnText) return;

    const targetFolderId = currentFolderId || defaultFolderId || 'default';
    spellingQuizLink.href = `spelling.html?folder=${encodeURIComponent(targetFolderId)}`;

    const folderName = getCurrentFolderName();
    if (spellingQuizLink.matches(':hover') || spellingQuizLink.classList.contains('is-hovered')) {
      spellingQuizBtnText.textContent = folderName;
    } else {
      spellingQuizBtnText.textContent = t('spellingQuizBtn') || '拼寫練習';
      spellingQuizLink.style.minWidth = '';
    }
    spellingQuizLink.title = `${t('spellingQuizBtn') || '拼寫練習'} (${folderName})`;
  }

  function initSpellingQuizBtn() {
    const spellingQuizLink = document.getElementById('spellingQuizLink');
    const spellingQuizBtnText = document.getElementById('spellingQuizBtnText');
    if (!spellingQuizLink || !spellingQuizBtnText) return;

    function handleEnter() {
      const currentWidth = spellingQuizLink.getBoundingClientRect().width;
      if (currentWidth > 0) {
        spellingQuizLink.style.minWidth = `${Math.ceil(currentWidth)}px`;
      }
      spellingQuizLink.classList.add('is-hovered');
      spellingQuizBtnText.textContent = getCurrentFolderName();
    }

    function handleLeave() {
      spellingQuizLink.classList.remove('is-hovered');
      spellingQuizBtnText.textContent = t('spellingQuizBtn') || '拼寫練習';
      spellingQuizLink.style.minWidth = '';
    }

    spellingQuizLink.addEventListener('mouseenter', handleEnter);
    spellingQuizLink.addEventListener('mouseleave', handleLeave);
    spellingQuizLink.addEventListener('focus', handleEnter);
    spellingQuizLink.addEventListener('blur', handleLeave);

    updateSpellingQuizBtn();
  }

  function renderFolderTabs() {
    if (!folderTabsBar) return;
    const activeWords = wordbook.filter(w => !w.deletedAt);

    if (!folders.some(f => f.id === currentFolderId)) {
      currentFolderId = defaultFolderId || (folders[0] ? folders[0].id : 'default');
    }

    updateSpellingQuizBtn();

    let html = '';

    folders.forEach(f => {
      const isDef = (f.id === defaultFolderId);
      const count = activeWords.filter(w => (w.folderId || 'default') === f.id).length;
      const fName = (f.id === 'default') ? (t('folderDefault') || '生詞本') : f.name;
      const fColor = (f.color && f.color !== 'default') ? f.color : 'var(--primary)';

      html += `
        <div class="folder-tab-item ${currentFolderId === f.id ? 'active' : ''}" data-folder="${f.id}" title="${escapeHtml(fName)} (右鍵管理)">
          <span class="folder-tab-icon" style="color: ${fColor};">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="color-mix(in srgb, ${fColor} 18%, transparent)" stroke="${fColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
            </svg>
          </span>
          <span class="folder-name-text">${escapeHtml(fName)}</span>
          ${isDef ? `<span class="folder-default-star" title="${t('folderDefaultBadge') || '預設生詞本'}"><svg viewBox="0 0 24 24" width="12" height="12" fill="#EAB308" stroke="#CA8A04" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>` : ''}
          <span class="folder-pill-count">${count}</span>
        </div>
      `;
    });

    folderTabsBar.innerHTML = html;

    folderTabsBar.querySelectorAll('.folder-tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        closeFolderContextMenu();
        const folderId = tab.getAttribute('data-folder');
        if (folderId && folderId !== currentFolderId) {
          currentFolderId = folderId;
          selectedIds.clear();
          renderFolderTabs();
          renderList();
          updateSelectionUI();
        }
      });

      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const folderId = tab.getAttribute('data-folder');
        if (folderId) {
          openFolderContextMenu(folderId, e.clientX, e.clientY);
        }
      });
    });

    setTimeout(() => {
      updateFolderOverflowLayout();
    }, 0);
  }

  function updateFolderOverflowLayout() {
    const bar = document.getElementById('folderTabsBar');
    const overflowWrapper = document.getElementById('folderOverflowWrapper');
    const wrapper = document.getElementById('folderTabsWrapper');
    if (!bar || !overflowWrapper || !wrapper) return;

    const tabs = Array.from(bar.querySelectorAll('.folder-tab-item'));
    if (tabs.length === 0) {
      overflowWrapper.style.display = 'none';
      wrapper.classList.remove('is-expanded');
      bar.style.height = '42px';
      return;
    }

    const availableWidth = bar.clientWidth;
    if (availableWidth <= 0) return;

    let totalWidth = 0;
    const gap = 8;
    tabs.forEach(t => {
      totalWidth += (totalWidth === 0) ? t.offsetWidth : (gap + t.offsetWidth);
    });

    const isOverflowing = totalWidth > availableWidth + 2;
    if (isOverflowing) {
      overflowWrapper.style.display = 'flex';
      if (wrapper.classList.contains('is-expanded')) {
        bar.style.height = `${bar.scrollHeight}px`;
      }
    } else {
      overflowWrapper.style.display = 'none';
      wrapper.classList.remove('is-expanded');
      bar.style.height = '42px';
    }
  }

  function toggleFolderExpand() {
    const wrapper = document.getElementById('folderTabsWrapper');
    const bar = document.getElementById('folderTabsBar');
    if (!wrapper || !bar) return;

    const isCurrentlyExpanded = wrapper.classList.contains('is-expanded');

    if (isCurrentlyExpanded) {
      bar.style.height = `${bar.scrollHeight}px`;
      bar.offsetHeight;
      bar.style.height = '42px';
      wrapper.classList.remove('is-expanded');
    } else {
      bar.style.height = 'auto';
      const targetHeight = bar.scrollHeight;
      bar.style.height = '42px';
      bar.offsetHeight;
      bar.style.height = `${targetHeight}px`;
      wrapper.classList.add('is-expanded');

      clearTimeout(bar._expandTimer);
      bar._expandTimer = setTimeout(() => {
        if (wrapper.classList.contains('is-expanded')) {
          bar.style.height = 'auto';
        }
      }, 300);
    }
  }

  function updateFolderNameInputColor(color) {
    const inputEl = document.getElementById('folderNameInput');
    if (!inputEl) return;
    const accentColor = (color && color !== 'default') ? color : 'var(--primary)';
    inputEl.style.setProperty('--folder-accent-color', accentColor);
    inputEl.style.borderColor = accentColor;
  }

  function renderFolderPalette(selectedColor) {
    const paletteEl = document.getElementById('folderColorPalette');
    if (!paletteEl) return;

    updateFolderNameInputColor(selectedColor);

    paletteEl.innerHTML = FOLDER_COLORS.map(color => {
      const isSelected = color === selectedColor;
      const bg = color === 'default' ? 'var(--primary)' : color;
      return `
        <div class="folder-color-option ${isSelected ? 'active' : ''}" data-color="${color}" style="background: ${bg};" title="${color}">
          ${isSelected ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </div>
      `;
    }).join('');

    paletteEl.querySelectorAll('.folder-color-option').forEach(opt => {
      opt.addEventListener('click', () => {
        selectedFolderColor = opt.getAttribute('data-color');
        renderFolderPalette(selectedFolderColor);
      });
    });
  }

  function openFolderModal(folderId = null) {
    editingFolderId = folderId;
    const modal = document.getElementById('folderModal');
    const titleEl = document.getElementById('folderModalTitle');
    const nameInput = document.getElementById('folderNameInput');
    const isDefaultToggle = document.getElementById('folderIsDefaultToggle');
    const isDefaultWrapper = document.getElementById('folderIsDefaultWrapper');

    if (!modal || !nameInput) return;

    if (folderId) {
      const targetFolder = folders.find(f => f.id === folderId);
      if (!targetFolder) return;
      if (titleEl) titleEl.textContent = t('folderEdit') || '編輯資料夾';
      nameInput.value = (targetFolder.id === 'default') ? (t('folderDefault') || '生詞本') : targetFolder.name;
      selectedFolderColor = targetFolder.color || 'default';

      if (isDefaultWrapper) {
        if (targetFolder.id === defaultFolderId) {
          isDefaultWrapper.style.display = 'none';
        } else {
          isDefaultWrapper.style.display = 'flex';
          if (isDefaultToggle) isDefaultToggle.checked = false;
        }
      }
    } else {
      if (titleEl) titleEl.textContent = t('folderNew') || '新建資料夾';
      nameInput.value = '';
      selectedFolderColor = 'default';
      if (isDefaultWrapper) {
        isDefaultWrapper.style.display = 'flex';
        if (isDefaultToggle) isDefaultToggle.checked = false;
      }
    }

    renderFolderPalette(selectedFolderColor);
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    setTimeout(() => { nameInput.focus(); }, 50);
  }

  function closeFolderModal() {
    const modal = document.getElementById('folderModal');
    if (modal) modal.classList.remove('show');
    document.body.classList.remove('modal-open');
    editingFolderId = null;
  }

  async function handleSaveFolder() {
    const nameInput = document.getElementById('folderNameInput');
    const isDefaultToggle = document.getElementById('folderIsDefaultToggle');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    const isDefault = isDefaultToggle ? isDefaultToggle.checked : false;

    if (editingFolderId) {
      await updateFolder(editingFolderId, {
        name,
        color: selectedFolderColor,
        isDefault
      });
    } else {
      const created = await createFolder(name, selectedFolderColor, isDefault);
      if (created) currentFolderId = created.id;
    }

    closeFolderModal();
    renderFolderTabs();
    renderList();
  }

  async function requestDeleteFolder(folderId) {
    const targetFolder = folders.find(f => f.id === folderId);
    if (!targetFolder || targetFolder.id === 'default') return;

    const activeWordsInFolder = wordbook.filter(w => !w.deletedAt && (w.folderId || 'default') === folderId).length;

    // 如果生詞本中沒有生詞的話，直接進行刪除
    if (activeWordsInFolder === 0) {
      const fName = targetFolder.name;
      await deleteFolder(folderId, true);
      renderFolderTabs();
      renderList();
      updateStats();
      updateStorage();
      showToast((t('folderDeleted') || '已刪除資料夾「$1」').replace('$1', fName));
      return;
    }

    // 如果有生詞，彈出確認彈窗
    openFolderDeleteModal(folderId);
  }

  function openFolderDeleteModal(folderId) {
    deletingFolderId = folderId;
    const targetFolder = folders.find(f => f.id === folderId);
    if (!targetFolder) return;

    const modal = document.getElementById('folderDeleteModal');
    const descEl = document.getElementById('folderDeleteDesc');
    if (!modal) return;

    const activeWordsInFolder = wordbook.filter(w => !w.deletedAt && (w.folderId || 'default') === folderId).length;
    const fName = targetFolder.name;

    if (descEl) {
      descEl.textContent = (t('folderDeleteConfirmDesc') || '資料夾「$1」內含有 $2 個生詞，請選擇處理方式：')
        .replace('$1', fName)
        .replace('$2', activeWordsInFolder);
    }

    const optionMove = document.getElementById('folderDeleteOptionMove');
    const optionPurge = document.getElementById('folderDeleteOptionPurge');
    const radioMove = modal.querySelector('input[value="move"]');
    if (radioMove) radioMove.checked = true;
    if (optionMove) optionMove.classList.add('active');
    if (optionPurge) optionPurge.classList.remove('active');

    modal.classList.add('show');
    document.body.classList.add('modal-open');
  }

  function closeFolderDeleteModal() {
    const modal = document.getElementById('folderDeleteModal');
    if (modal) modal.classList.remove('show');
    document.body.classList.remove('modal-open');
    deletingFolderId = null;
  }

  async function handleConfirmDeleteFolder() {
    if (!deletingFolderId) return;
    const modal = document.getElementById('folderDeleteModal');
    const choice = modal?.querySelector('input[name="folderDeleteChoice"]:checked')?.value || 'move';
    const moveToDefault = (choice === 'move');

    await deleteFolder(deletingFolderId, moveToDefault);
    closeFolderDeleteModal();
    renderFolderTabs();
    renderList();
    updateStats();
    updateStorage();
  }

  function openFolderContextMenu(folderId, clientX, clientY) {
    const menu = document.getElementById('folderGlobalContextMenu');
    if (!menu) return;

    const targetFolder = folders.find(f => f.id === folderId);
    if (!targetFolder) return;

    activeCtxFolderId = folderId;

    const isDef = (targetFolder.id === defaultFolderId);
    const fName = (targetFolder.id === 'default') ? (t('folderDefault') || '生詞本') : targetFolder.name;
    const fColor = (targetFolder.color && targetFolder.color !== 'default') ? targetFolder.color : 'var(--primary)';

    const headerTitle = document.getElementById('folderCtxHeaderTitle');
    if (headerTitle) headerTitle.textContent = fName;

    const headerIcon = document.getElementById('folderCtxHeaderIcon');
    if (headerIcon) {
      headerIcon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="color-mix(in srgb, ${fColor} 20%, transparent)" stroke="${fColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
        </svg>
      `;
    }

    const moveHereBtn = document.getElementById('folderCtxMoveHereBtn');
    const moveDivider = document.getElementById('folderCtxMoveDivider');
    const moveHereText = document.getElementById('folderCtxMoveHereText');
    const movableWords = wordbook.filter(w => !w.deletedAt && selectedIds.has(w.id) && (w.folderId || 'default') !== folderId);
    const hasMovable = (movableWords.length > 0);

    if (moveHereBtn) {
      moveHereBtn.style.display = hasMovable ? 'flex' : 'none';
      if (moveDivider) moveDivider.style.display = hasMovable ? 'block' : 'none';
      if (moveHereText) {
        moveHereText.textContent = (t('folderMoveHere') || '移動選中的 $1 個生詞至此').replace('$1', movableWords.length);
      }
    }

    const setDefaultBtn = document.getElementById('folderCtxSetDefaultBtn');
    const setDefaultText = document.getElementById('folderCtxSetDefaultText');
    if (setDefaultBtn) {
      setDefaultBtn.style.display = isDef ? 'none' : 'flex';
      if (setDefaultText) setDefaultText.textContent = t('folderSetDefault') || '設為預設生詞本';
    }

    const editBtn = document.getElementById('folderCtxEditBtn');
    const editText = document.getElementById('folderCtxEditText');
    if (editBtn && editText) {
      editText.textContent = t('folderEdit') || '編輯資料夾';
    }

    const deleteBtn = document.getElementById('folderCtxDeleteBtn');
    const deleteDivider = document.getElementById('folderCtxDeleteDivider');
    const deleteText = document.getElementById('folderCtxDeleteText');
    if (deleteBtn) {
      const canDelete = (targetFolder.id !== 'default');
      deleteBtn.style.display = canDelete ? 'flex' : 'none';
      if (deleteDivider) deleteDivider.style.display = canDelete ? 'block' : 'none';
      if (deleteText) deleteText.textContent = t('folderDelete') || '刪除資料夾';
    }

    // Position menu within viewport bounds
    menu.style.display = 'flex';
    const menuWidth = 200;
    const menuHeight = (hasMovable ? 40 : 0) + (isDef ? 95 : 135);

    let posX = clientX;
    let posY = clientY;

    if (posX + menuWidth > window.innerWidth - 10) {
      posX = Math.max(10, window.innerWidth - menuWidth - 10);
    }
    if (posY + menuHeight > window.innerHeight - 10) {
      posY = Math.max(10, window.innerHeight - menuHeight - 10);
    }

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
  }

  function closeFolderContextMenu() {
    const menu = document.getElementById('folderGlobalContextMenu');
    if (menu) menu.style.display = 'none';
    activeCtxFolderId = null;
  }

  function initFolderEvents() {
    // Folder Modal Events
    if (closeFolderModalBtn) closeFolderModalBtn.addEventListener('click', closeFolderModal);
    if (folderCancelBtn) folderCancelBtn.addEventListener('click', closeFolderModal);
    if (folderSaveBtn) folderSaveBtn.addEventListener('click', handleSaveFolder);
    if (folderModal) {
      folderModal.addEventListener('click', (e) => {
        if (e.target === folderModal) closeFolderModal();
      });
    }

    // Folder Delete Modal Events
    if (closeFolderDeleteModalBtn) closeFolderDeleteModalBtn.addEventListener('click', closeFolderDeleteModal);
    if (folderDeleteCancelBtn) folderDeleteCancelBtn.addEventListener('click', closeFolderDeleteModal);
    if (folderDeleteConfirmBtn) folderDeleteConfirmBtn.addEventListener('click', handleConfirmDeleteFolder);
    if (folderDeleteModal) {
      folderDeleteModal.addEventListener('click', (e) => {
        if (e.target === folderDeleteModal) closeFolderDeleteModal();
      });

      const optionMove = document.getElementById('folderDeleteOptionMove');
      const optionPurge = document.getElementById('folderDeleteOptionPurge');
      if (optionMove) {
        optionMove.addEventListener('click', () => {
          const radio = optionMove.querySelector('input');
          if (radio) radio.checked = true;
          optionMove.classList.add('active');
          if (optionPurge) optionPurge.classList.remove('active');
        });
      }
      if (optionPurge) {
        optionPurge.addEventListener('click', () => {
          const radio = optionPurge.querySelector('input');
          if (radio) radio.checked = true;
          optionPurge.classList.add('active');
          if (optionMove) optionMove.classList.remove('active');
        });
      }
    }

    // Folder Global Context Menu Events
    const ctxMoveHereBtn = document.getElementById('folderCtxMoveHereBtn');
    const ctxSetDefaultBtn = document.getElementById('folderCtxSetDefaultBtn');
    const ctxEditBtn = document.getElementById('folderCtxEditBtn');
    const ctxDeleteBtn = document.getElementById('folderCtxDeleteBtn');

    if (ctxMoveHereBtn) {
      ctxMoveHereBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fId = activeCtxFolderId;
        if (!fId) return;
        const movableIds = wordbook
          .filter(w => !w.deletedAt && selectedIds.has(w.id) && (w.folderId || 'default') !== fId)
          .map(w => w.id);
        closeFolderContextMenu();
        if (movableIds.length === 0) return;

        const targetFolder = folders.find(f => f.id === fId);
        const targetName = targetFolder ? ((targetFolder.id === 'default') ? (t('folderDefault') || '生詞本') : targetFolder.name) : '';
        const movedCount = await moveWordsToFolder(movableIds, fId);
        selectedIds.clear();
        renderFolderTabs();
        renderList();
        updateSelectionUI();
        showToast((t('folderMovedSuccess') || '已移動 $1 個生詞至「$2」')
          .replace('$1', movedCount)
          .replace('$2', targetName)
        );
      });
    }

    if (ctxSetDefaultBtn) {
      ctxSetDefaultBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fId = activeCtxFolderId;
        closeFolderContextMenu();
        if (fId) await setDefaultFolderId(fId);
      });
    }

    if (ctxEditBtn) {
      ctxEditBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fId = activeCtxFolderId;
        closeFolderContextMenu();
        if (fId) openFolderModal(fId);
      });
    }

    if (ctxDeleteBtn) {
      ctxDeleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fId = activeCtxFolderId;
        closeFolderContextMenu();
        if (fId) requestDeleteFolder(fId);
      });
    }

    // New Folder Button
    const btnNew = document.getElementById('btnNewFolder');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        closeFolderContextMenu();
        openFolderModal(null);
      });
    }

    // Folder Overflow Expand Button
    const overflowBtn = document.getElementById('folderOverflowBtn');
    if (overflowBtn) {
      overflowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFolderContextMenu();
        toggleFolderExpand();
      });
    }

    // Global dismiss for folder context menu
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#folderGlobalContextMenu')) {
        closeFolderContextMenu();
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('.folder-tab-item')) {
        closeFolderContextMenu();
      }
    });

    window.addEventListener('blur', () => {
      closeFolderContextMenu();
    });

    window.addEventListener('resize', () => {
      closeFolderContextMenu();
      updateFolderOverflowLayout();
    });

    if (window.ResizeObserver && folderTabsBar) {
      const ro = new ResizeObserver(() => {
        updateFolderOverflowLayout();
      });
      ro.observe(folderTabsBar);
      const wrapper = document.getElementById('folderTabsWrapper');
      if (wrapper) ro.observe(wrapper);
    }
  }

  // ==================== Init ====================

  async function init() {
    initTheme();

    // Detect language
    try {
      const res = await chrome.storage.local.get(['uiLang', 'extensionLang']);
      if (res) {
        const rawLang = res.uiLang || res.extensionLang;
        if (rawLang) currentLang = normalizeLang(rawLang);
      }
    } catch (e) {}
    applyI18n();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes[WORDBOOK_FOLDERS_KEY] || changes[WORDBOOK_DEFAULT_FOLDER_KEY])) {
        if (changes[WORDBOOK_FOLDERS_KEY]) folders = changes[WORDBOOK_FOLDERS_KEY].newValue || [];
        if (changes[WORDBOOK_DEFAULT_FOLDER_KEY]) defaultFolderId = changes[WORDBOOK_DEFAULT_FOLDER_KEY].newValue || 'default';
        renderFolderTabs();
        renderList();
      }
      if (area === 'local' && (changes.uiLang || changes.extensionLang)) {
        const nextLang = (changes.uiLang || changes.extensionLang).newValue;
        if (nextLang) {
          currentLang = normalizeLang(nextLang);
          applyI18n();
          renderFolderTabs();
          renderList();
          if (aiSettingsModal && aiSettingsModal.classList.contains('show')) {
            if (aiCustomPromptInputModal && isDefaultSystemPrompt(aiCustomPromptInputModal.value)) {
              aiCustomPromptInputModal.value = getDefaultSystemPrompt(currentLang);
            }
            if (aiNotePromptInputModal && isDefaultNotePrompt(aiNotePromptInputModal.value)) {
              aiNotePromptInputModal.value = getDefaultNotePrompt(currentLang);
            }
            renderContextMenuEnginesListModal();
            renderAiSettingsList();
          }
        }
      }
    });

    // Load folders and wordbook
    await getFolders();
    wordbook = await getWordbook();

    // Parse URL parameter for active folder
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlFolder = urlParams.get('folder') || urlParams.get('folderId');
      if (urlFolder && (urlFolder === 'all' || folders.some(f => f.id === urlFolder))) {
        currentFolderId = urlFolder;
      }
    } catch (e) {}
    
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

    // Shortcuts & Audio Settings Toggles in Modal
    const autoPronounceSettingToggle = document.getElementById('autoPronounceSettingToggle');
    if (autoPronounceSettingToggle) {
      autoPronounceSettingToggle.checked = isAutoPronounce;
      autoPronounceSettingToggle.addEventListener('change', () => {
        isAutoPronounce = autoPronounceSettingToggle.checked;
        localStorage.setItem('jyutping_auto_pronounce', isAutoPronounce);
      });
    }

    renderFolderTabs();
    initFolderEvents();
    initSpellingQuizBtn();
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
  const aiNotePromptInputModal = document.getElementById('aiNotePromptInputModal');
  const restoreAiNotePromptBtnModal = document.getElementById('restoreAiNotePromptBtnModal');
  const aiNotePromptSavedHint = document.getElementById('aiNotePromptSavedHint');

  let modalAiQuickActions = [];
  let modalContextMenuEngines = [];

  function openAiSettingsModal(initialTab) {
    if (!aiSettingsModal) return;
    
    // Clone states for editing
    modalAiQuickActions = JSON.parse(JSON.stringify(globalAiQuickActions));
    modalContextMenuEngines = JSON.parse(JSON.stringify(globalContextMenuEngines));
    
    // Populate prompt textareas with actual editable text for current language
    if (aiCustomPromptInputModal) {
      aiCustomPromptInputModal.value = getEffectiveSystemPrompt(currentLang);
    }
    if (aiNotePromptInputModal) {
      aiNotePromptInputModal.value = getEffectiveNotePrompt(currentLang);
    }

    const activeTabName = (typeof initialTab === 'string' && initialTab) ? initialTab : 'quick-actions';
    switchSettingsTab(activeTabName);

    const aiHoverPronunciationToggle = document.getElementById('aiHoverPronunciationToggle');
    if (aiHoverPronunciationToggle) {
      aiHoverPronunciationToggle.checked = aiHoverPronunciationEnabled;
    }

    const autoPronounceSettingToggle = document.getElementById('autoPronounceSettingToggle');
    if (autoPronounceSettingToggle) {
      autoPronounceSettingToggle.checked = isAutoPronounce;
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
    if (aiNotePromptInputModal) {
      globalAiCustomNotePrompt = aiNotePromptInputModal.value.trim();
    }

    chrome.storage.local.set({ 
      aiQuickActions: globalAiQuickActions,
      aiCustomSystemPrompt: globalAiCustomSystemPrompt,
      aiNotePrompt: globalAiCustomNotePrompt,
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

// Category & Tab Switching
const WORDBOOK_TABS = ['shortcuts', 'context-menu'];
const AI_TABS = ['quick-actions', 'custom-prompt', 'interaction'];

function switchSettingsCategory(category, initialSubTab) {
  const isWordbook = category === 'wordbook';
  const settingsCategorySwitch = document.getElementById('settingsCategorySwitch');
  const categoryTabsWordbook = document.getElementById('categoryTabsWordbook');
  const categoryTabsAi = document.getElementById('categoryTabsAi');

  if (settingsCategorySwitch) {
    settingsCategorySwitch.querySelectorAll('.settings-category-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });
  }

  if (categoryTabsWordbook) categoryTabsWordbook.style.display = isWordbook ? 'flex' : 'none';
  if (categoryTabsAi) categoryTabsAi.style.display = isWordbook ? 'none' : 'flex';

  const activeContainer = isWordbook ? categoryTabsWordbook : categoryTabsAi;
  let targetSubTab = initialSubTab;
  if (!targetSubTab && activeContainer) {
    const activeBtn = activeContainer.querySelector('.ai-modal-tab-btn.active') || activeContainer.querySelector('.ai-modal-tab-btn');
    targetSubTab = activeBtn?.dataset.tab;
  }
  if (!targetSubTab) {
    targetSubTab = isWordbook ? 'shortcuts' : 'quick-actions';
  }

  switchSettingsTab(targetSubTab);
}

function switchSettingsTab(targetTab) {
  const isWordbookTab = WORDBOOK_TABS.includes(targetTab);
  const category = isWordbookTab ? 'wordbook' : 'ai';
  const settingsCategorySwitch = document.getElementById('settingsCategorySwitch');
  const categoryTabsWordbook = document.getElementById('categoryTabsWordbook');
  const categoryTabsAi = document.getElementById('categoryTabsAi');

  if (settingsCategorySwitch) {
    settingsCategorySwitch.querySelectorAll('.settings-category-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });
  }
  if (categoryTabsWordbook) categoryTabsWordbook.style.display = isWordbookTab ? 'flex' : 'none';
  if (categoryTabsAi) categoryTabsAi.style.display = isWordbookTab ? 'none' : 'flex';

  document.querySelectorAll('.ai-modal-tabs .ai-modal-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === targetTab);
  });

  const tabPaneQuickActions = document.getElementById('tabPaneQuickActions');
  const tabPaneCustomPrompt = document.getElementById('tabPaneCustomPrompt');
  const tabPaneNotePrompt = document.getElementById('tabPaneNotePrompt');
  const tabPaneInteraction = document.getElementById('tabPaneInteraction');
  const tabPaneShortcuts = document.getElementById('tabPaneShortcuts');
  const tabPaneContextMenu = document.getElementById('tabPaneContextMenu');

  if (tabPaneQuickActions) tabPaneQuickActions.classList.toggle('active', targetTab === 'quick-actions');
  if (tabPaneCustomPrompt) tabPaneCustomPrompt.classList.toggle('active', targetTab === 'custom-prompt');
  if (tabPaneNotePrompt) tabPaneNotePrompt.classList.toggle('active', targetTab === 'note-prompt');
  if (tabPaneInteraction) tabPaneInteraction.classList.toggle('active', targetTab === 'interaction');
  if (tabPaneShortcuts) tabPaneShortcuts.classList.toggle('active', targetTab === 'shortcuts');
  if (tabPaneContextMenu) tabPaneContextMenu.classList.toggle('active', targetTab === 'context-menu');
}

const settingsCategorySwitch = document.getElementById('settingsCategorySwitch');
if (settingsCategorySwitch) {
  settingsCategorySwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('.settings-category-btn');
    if (!btn) return;
    switchSettingsCategory(btn.dataset.category);
  });
}

document.querySelectorAll('.ai-modal-tabs').forEach(tabGroup => {
  tabGroup.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.ai-modal-tab-btn');
    if (!tabBtn) return;
    switchSettingsTab(tabBtn.dataset.tab);
  });
});

// Save prompt helper
function savePromptState(val) {
  const trimmed = val.trim();
  globalAiCustomSystemPrompt = isDefaultSystemPrompt(trimmed) ? '' : trimmed;
  chrome.storage.local.set({ aiCustomSystemPrompt: globalAiCustomSystemPrompt });
  if (aiPromptSavedHint) {
    aiPromptSavedHint.style.opacity = '1';
    clearTimeout(aiPromptSavedHint._timer);
    aiPromptSavedHint._timer = setTimeout(() => {
      aiPromptSavedHint.style.opacity = '0';
    }, 1500);
  }
}

function saveNotePromptState(val) {
  const trimmed = val.trim();
  globalAiCustomNotePrompt = isDefaultNotePrompt(trimmed) ? '' : trimmed;
  chrome.storage.local.set({ aiNotePrompt: globalAiCustomNotePrompt });
  if (aiNotePromptSavedHint) {
    aiNotePromptSavedHint.style.opacity = '1';
    clearTimeout(aiNotePromptSavedHint._timer);
    aiNotePromptSavedHint._timer = setTimeout(() => {
      aiNotePromptSavedHint.style.opacity = '0';
    }, 1500);
  }
}

// Prompt Textarea input auto-save
if (aiCustomPromptInputModal) {
  aiCustomPromptInputModal.addEventListener('input', () => {
    savePromptState(aiCustomPromptInputModal.value);
  });
}

if (aiNotePromptInputModal) {
  aiNotePromptInputModal.addEventListener('input', () => {
    saveNotePromptState(aiNotePromptInputModal.value);
  });
}

// Variable Tags Insertion
document.querySelectorAll('.ai-prompt-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const varText = tag.dataset.tag;
    const targetId = tag.dataset.target || 'aiCustomPromptInputModal';
    const targetInput = document.getElementById(targetId);
    if (targetInput && varText) {
      const start = targetInput.selectionStart || 0;
      const end = targetInput.selectionEnd || 0;
      const val = targetInput.value;
      targetInput.value = val.substring(0, start) + varText + val.substring(end);
      targetInput.focus();
      targetInput.selectionStart = targetInput.selectionEnd = start + varText.length;
      if (targetId === 'aiNotePromptInputModal') {
        saveNotePromptState(targetInput.value);
      } else {
        savePromptState(targetInput.value);
      }
    }
  });
});

// Restore Default Prompt
if (restoreAiPromptBtnModal) {
  restoreAiPromptBtnModal.addEventListener('click', () => {
    const confirmMsg = t('wordbookConfirmRestorePrompt') || '確定要恢復預設 Prompt 嗎？這將會清除您自訂的系統提示詞。';
    if (confirm(confirmMsg)) {
      if (aiCustomPromptInputModal) {
        const defaultPrompt = getDefaultSystemPrompt(currentLang);
        aiCustomPromptInputModal.value = defaultPrompt;
        savePromptState('');
      }
    }
  });
}

if (restoreAiNotePromptBtnModal) {
  restoreAiNotePromptBtnModal.addEventListener('click', () => {
    const confirmMsg = t('wordbookConfirmRestorePrompt') || '確定要恢復預設 Prompt 嗎？這將會清除您自訂的系統提示詞。';
    if (confirm(confirmMsg)) {
      if (aiNotePromptInputModal) {
        const defaultPrompt = getDefaultNotePrompt(currentLang);
        aiNotePromptInputModal.value = defaultPrompt;
        saveNotePromptState('');
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
    nameInput.value = getEngineDisplayName(engine);
    nameInput.className = 'cm-engine-input cm-engine-input-name';
    nameInput.placeholder = t('wordbookEngineNamePlaceholder') || '搜尋源名稱 (如: Wiki 粵語詞典)';
    nameInput.addEventListener('input', () => {
      const val = nameInput.value.trim();
      if (!val || isDefaultEngineName(engine.id, val)) {
        engine.customName = false;
        engine.name = '';
      } else {
        engine.customName = true;
        engine.name = val;
      }
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
        const displayName = getEngineDisplayName(engine) || '搜尋';
        return `
          <button class="context-menu-item" data-id="${engine.id}">
            <div class="context-menu-item-left">
              <span class="context-menu-item-icon">${iconHtml}</span>
              <span class="context-menu-item-name">${escapeHtml(displayName)}</span>
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
    return;
  }

  // 生詞表鍵盤導航：ArrowUp / ArrowDown / Enter 切換生詞
  const activeEl = document.activeElement;
  const isInputActive = activeEl && (
    activeEl.tagName === 'INPUT' ||
    activeEl.tagName === 'TEXTAREA' ||
    activeEl.isContentEditable ||
    (activeEl.closest && activeEl.closest('#detailPane'))
  );
  if (isInputActive) return;

  if (document.body.classList.contains('modal-open')) return;
  if (customContextMenu && customContextMenu.style.display !== 'none') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // 生詞表鍵盤導航：ArrowUp / ArrowDown 切換生詞
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const rows = Array.from(document.querySelectorAll('#wordList .table-row.word-card'));
    if (rows.length === 0) return;

    e.preventDefault();

    const activeIndex = rows.findIndex(r => r.classList.contains('active-row'));
    let targetIndex = 0;

    if (e.key === 'ArrowDown') {
      if (activeIndex === -1) {
        targetIndex = 0;
      } else {
        targetIndex = Math.min(activeIndex + 1, rows.length - 1);
      }
    } else if (e.key === 'ArrowUp') {
      if (activeIndex === -1) {
        targetIndex = rows.length - 1;
      } else {
        targetIndex = Math.max(activeIndex - 1, 0);
      }
    }

    const targetRow = rows[targetIndex];
    if (!targetRow) return;

    // 移除舊的 active-row 並選中新的 targetRow
    rows.forEach(r => r.classList.remove('active-row'));
    targetRow.classList.add('active-row');

    // 滾動保證選中行在視野範圍內
    targetRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    // 如果當前處於詳情面板模式 (Detail Mode)，即時渲染該生詞的詳細釋義
    const charEl = targetRow.querySelector('.word-character');
    const wordText = charEl?.dataset.word;
    if (isDetailMode && wordText) {
      renderDetailPanel(wordText);
    }

    // 若開啟了自動朗讀，切換時即時發音
    if (wordText) {
      triggerAutoPronounce(wordText, charEl);
    }
    return;
  }

  // 空格鍵 (Space) 或 左右方向鍵 (← / →)：手動朗讀當前選中生詞
  if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const activeRow = document.querySelector('#wordList .table-row.active-row');
    if (activeRow) {
      e.preventDefault();
      const charEl = activeRow.querySelector('.word-character');
      const wordText = charEl?.dataset.word;
      if (wordText) {
        playTts(wordText, charEl);
      }
    }
    return;
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
      hoverHighlightEl.className = 'ai-word-hover-highlight-container';
      hoverHighlightEl.style.display = 'none';
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
      if (hoverHighlightEl) {
        hoverHighlightEl.style.display = 'none';
        hoverHighlightEl.innerHTML = '';
      }
      if (hoverPillEl) {
        hoverPillEl.classList.remove('is-visible');
      }
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
      if (e.target === hoverHighlightEl || hoverHighlightEl.contains(e.target) || hoverPillEl.contains(e.target) || selectionToolbarEl.contains(e.target)) {
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
      if (target === hoverHighlightEl || hoverHighlightEl.contains(target) || hoverPillEl.contains(target)) {
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

      // 計算匹配詞的精準幾何位置（支援換行分段精確高亮）
      try {
        const wordRange = document.createRange();
        wordRange.setStart(best.textNode, best.startOffset);
        wordRange.setEnd(best.textNode, best.endOffset);

        const clientRects = Array.from(wordRange.getClientRects()).filter(r => r.width > 0 && r.height > 0);
        if (clientRects.length === 0) {
          hideHoverSnap();
          return;
        }

        currentHoverWord = best.word;

        // 1. 渲染每個換行分段的精準高亮方塊，避免跨行產生整行大矩形
        hoverHighlightEl.innerHTML = '';
        clientRects.forEach(r => {
          const box = document.createElement('div');
          box.className = 'ai-word-hover-highlight-box';
          box.style.top = `${r.top}px`;
          box.style.left = `${r.left}px`;
          box.style.width = `${r.width}px`;
          box.style.height = `${r.height}px`;
          hoverHighlightEl.appendChild(box);
        });
        hoverHighlightEl.style.display = 'block';

        // 2. 定位音標懸浮窗：錨定在鼠標當前所在的折行分段（或首個分段）
        let targetRect = clientRects[0];
        for (const r of clientRects) {
          if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 &&
              e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6) {
            targetRect = r;
            break;
          }
        }

        hoverPillSpan.textContent = best.jyutping;

        let top = Math.max(10, targetRect.top);
        let left = Math.max(50, Math.min(window.innerWidth - 50, targetRect.left + targetRect.width / 2));

        let isFlipped = false;
        if (top < 45) {
          top = targetRect.bottom;
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

