/**
 * 拼寫與多題型練習頁面邏輯
 * spelling.js — Multi-type Cantonese Quiz & Study Engine
 */
(function () {
  'use strict';

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== Multi-Engine TTS ====================
  const EDGE_TTS_DEFAULT_URL = 'http://114.55.243.162:8090';
  let speakingBtn = null;
  let speakingTimer = null;
  let currentAudio = null;
  let currentTtsRequestId = 0;

  function startSpeaking(btn) {
    if (speakingBtn) speakingBtn.classList.remove('speaking');
    if (speakingTimer) clearTimeout(speakingTimer);
    speakingBtn = btn;
    if (btn) btn.classList.add('speaking');
    speakingTimer = setTimeout(stopSpeaking, 10000);
  }

  function stopSpeaking() {
    if (speakingBtn) speakingBtn.classList.remove('speaking');
    speakingBtn = null;
    if (speakingTimer) { clearTimeout(speakingTimer); speakingTimer = null; }
  }

  function stopAllAudio() {
    try {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      if (chrome.tts && typeof chrome.tts.stop === 'function') chrome.tts.stop();
      if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; }
    } catch(e) {}
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
    stopAllAudio();
    startSpeaking(ttsBtn);

    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-HK';
        u.onend = () => { if (reqId === currentTtsRequestId) stopSpeaking(); };
        u.onerror = () => { if (reqId === currentTtsRequestId) stopSpeaking(); };
        speechSynthesis.speak(u);
      } else { stopSpeaking(); }
      return;
    }

    chrome.storage.sync.get([
      'ttsEngine', 'edgeTtsMode', 'edgeTtsUrl', 'azureTtsMode', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'ttsRate'
    ], async (result) => {
      if (reqId !== currentTtsRequestId) return;
      const engine = result.ttsEngine || 'edgeTts';
      const rate = result.ttsRate || 0.9;

      if (engine === 'webSpeech') {
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
        if (chrome.tts) {
          chrome.tts.speak(text, {
            lang: 'zh-HK', rate: rate,
            onEvent: (e) => {
              if (reqId === currentTtsRequestId && (e.type === 'end' || e.type === 'error')) stopSpeaking();
            }
          });
        } else { stopSpeaking(); }
      } else if (engine === 'edgeTts') {
        const cacheKey = `${engine}:${rate}:${text}`;
        if (ttsCache.has(cacheKey)) {
          const cachedUrl = ttsCache.get(cacheKey);
          // Refresh LRU position
          ttsCache.delete(cacheKey);
          ttsCache.set(cacheKey, cachedUrl);

          const audio = new Audio(cachedUrl);
          currentAudio = audio;
          audio.onended = () => { if (reqId === currentTtsRequestId) { currentAudio = null; stopSpeaking(); } };
          audio.onerror = () => { if (reqId === currentTtsRequestId) { currentAudio = null; stopSpeaking(); } };
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
          if (reqId !== currentTtsRequestId) return;
          if (!resp.ok) throw new Error('Edge TTS error: ' + resp.status);
          const blob = await resp.blob();
          if (reqId !== currentTtsRequestId) return;
          const blobUrl = URL.createObjectURL(blob);
          cacheTtsAudio(cacheKey, blobUrl);
          const audio = new Audio(blobUrl);
          currentAudio = audio;
          audio.onended = () => { if (reqId === currentTtsRequestId) { currentAudio = null; stopSpeaking(); } };
          audio.onerror = () => { if (reqId === currentTtsRequestId) { currentAudio = null; stopSpeaking(); } };
          audio.play();
        } catch (e) {
          if (reqId !== currentTtsRequestId) return;
          if (chrome.tts) {
            chrome.tts.speak(text, { lang: 'zh-HK', rate: rate, onEvent: (e) => { if (reqId === currentTtsRequestId && (e.type === 'end' || e.type === 'error')) stopSpeaking(); } });
          } else if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-HK'; u.rate = rate;
            u.onend = () => { if (reqId === currentTtsRequestId) stopSpeaking(); };
            u.onerror = () => { if (reqId === currentTtsRequestId) stopSpeaking(); };
            speechSynthesis.speak(u);
          } else { stopSpeaking(); }
        }
      } else if (engine === 'bertVits2') {
        try {
          const resp = await fetch('http://127.0.0.1:5000/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, speed: rate })
          });
          if (reqId !== currentTtsRequestId) return;
          if (!resp.ok) throw new Error('BertVits2 error');
          const blob = await resp.blob();
          if (reqId !== currentTtsRequestId) return;
          const audio = new Audio(URL.createObjectURL(blob));
          currentAudio = audio;
          audio.onended = () => { if (reqId === currentTtsRequestId) { URL.revokeObjectURL(audio.src); currentAudio = null; stopSpeaking(); } };
          audio.onerror = () => { if (reqId === currentTtsRequestId) { currentAudio = null; stopSpeaking(); } };
          audio.play();
        } catch (e) {
          if (reqId !== currentTtsRequestId) return;
          if (chrome.tts) { chrome.tts.speak(text, { lang: 'zh-HK', rate: rate, onEvent: (e) => { if (reqId === currentTtsRequestId && (e.type === 'end' || e.type === 'error')) stopSpeaking(); } }); }
          else { stopSpeaking(); }
        }
      } else if (engine === 'azureTts') {
        const action = result.azureTtsMode === 'custom' ? 'azureTtsSpeak' : 'azureTtsProxySpeak';
        const msg = { action, text, rate, azureVoice: result.azureTtsVoice || 'zh-HK-HiuMaanNeural' };
        if (result.azureTtsMode === 'custom') { msg.azureKey = result.azureTtsKey; msg.azureRegion = result.azureTtsRegion; }
        chrome.runtime.sendMessage(msg, (response) => {
          if (reqId !== currentTtsRequestId) return;
          if (response && response.audioData) {
            const audio = new Audio(response.audioData);
            currentAudio = audio;
            audio.onended = () => { if (reqId === currentTtsRequestId) { currentAudio = null; stopSpeaking(); } };
            audio.onerror = () => { if (reqId === currentTtsRequestId) { currentAudio = null; stopSpeaking(); } };
            audio.play().catch(() => { if (reqId === currentTtsRequestId) stopSpeaking(); });
          } else {
            if (chrome.tts) { chrome.tts.speak(text, { lang: 'zh-HK', rate: rate, onEvent: (e) => { if (reqId === currentTtsRequestId && (e.type === 'end' || e.type === 'error')) stopSpeaking(); } }); }
            else { stopSpeaking(); }
          }
        });
      }
    });
  }

  // ==================== i18n ======================================

  const i18nStrings = {
    'zh-HK': {
      spellingQuizTitle: '練習模式',
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
      spellingQuizNoWordsDetail: '生詞本中至少需要 3 個詞彙才能開啟練習',
      spellingQuizInputPlaceholder: '在此輸入答案…',
      spellingQuizProgress: '$1 / $2',
      spellingQuizResultCorrect: '答對',
      spellingQuizResultWrong: '答錯',
      spellingQuizResultSkipped: '跳過',
      spellingQuizYourAnswer: '你的回答：',
      spellingQuizCorrectAnswer: '正確答案：',
      spellingQuizSeconds: '秒',
      spellingQuizReviewTitle: '題目回顧',
      spellingQuizLoading: '正在載入詞典…',
      quizSettingsTitle: '練習設定',
      quizSaveSettings: '儲存並開始',
      quizCancel: '取消',
      quizReplayAudio: '點擊播放發音',
      quizMode: '題型模式（可多選）',
      quizQuestionCount: '練習題量',
      quizClozeTts: '例句填空自動朗讀',
      quizClozeTtsSentence: '朗讀例句',
      quizClozeTtsWord: '朗讀單詞',
      quizClozeTtsOff: '關閉',
      quizModeSentenceCloze: '例句填空',
      quizModeWordSpelling: '單詞拼寫',
      quizModeDefinitionChoice: '釋義選擇',
      quizModeListeningChoice: '聽音辨字',
      quizCount10: '10 題',
      quizCount20: '20 題',
      quizCountAll: '全部單詞',
      quizSelectCorrectDef: '請選擇正確的釋義：',
      quizListenSelectWord: '聽發音，選出對應的單詞：',
      quizWordLengthHint: '$1 個字',
      imeModeEnabled: 'Web 版粵拼輸入法',
      imeModeDisabled: 'Web 版粵拼輸入法 (已關閉)',
      imeModeToggleTitle: '切換 Web 版粵拼輸入法',
      toneCheatsheetTitle: '聲調鍵位：',
      toneCheatsheetTooltip: '輸入對應字母可直接指定聲調（支援數字 1-6 或字母 v/x/q/vv/xx/qq）',
      tone1: '1聲',
      tone2: '2聲',
      tone3: '3聲',
      tone4: '4聲',
      tone5: '5聲',
      tone6: '6聲',
      quizFolderScope: '練習生詞範圍',
      quizFolderAll: '全部生詞',
      quizFolderInsufficient: '該資料夾內可用生詞不足（至少需要 3 詞）',
      folderDefault: '生詞本'
    },
    'zh-CN': {
      spellingQuizTitle: '练习模式',
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
      spellingQuizNoWordsDetail: '生词本中至少需要 3 个词汇才能开启练习',
      spellingQuizInputPlaceholder: '在此输入答案…',
      spellingQuizProgress: '$1 / $2',
      spellingQuizResultCorrect: '答对',
      spellingQuizResultWrong: '答错',
      spellingQuizResultSkipped: '跳过',
      spellingQuizYourAnswer: '你的回答：',
      spellingQuizCorrectAnswer: '正确答案：',
      spellingQuizSeconds: '秒',
      spellingQuizReviewTitle: '题目回顾',
      spellingQuizLoading: '正在加载词典…',
      quizSettingsTitle: '练习设置',
      quizSaveSettings: '保存并开始',
      quizCancel: '取消',
      quizReplayAudio: '点击播放发音',
      quizMode: '题型模式（可多选）',
      quizQuestionCount: '练习题量',
      quizClozeTts: '例句填空自动朗读',
      quizClozeTtsSentence: '朗读例句',
      quizClozeTtsWord: '朗读单词',
      quizClozeTtsOff: '关闭',
      quizModeSentenceCloze: '例句填空',
      quizModeWordSpelling: '单词拼写',
      quizModeDefinitionChoice: '释义选择',
      quizModeListeningChoice: '听音辨字',
      quizCount10: '10 题',
      quizCount20: '20 题',
      quizCountAll: '全部单词',
      quizSelectCorrectDef: '请选择正确的释义：',
      quizListenSelectWord: '听发音，选出对应的单词：',
      quizWordLengthHint: '$1 个字',
      imeModeEnabled: 'Web 版粤拼输入法',
      imeModeDisabled: 'Web 版粤拼输入法 (已关闭)',
      imeModeToggleTitle: '切换 Web 版粤拼输入法',
      toneCheatsheetTitle: '声调键位：',
      toneCheatsheetTooltip: '输入对应字母可直接指定声调（支持数字 1-6 或字母 v/x/q/vv/xx/qq）',
      tone1: '1声',
      tone2: '2声',
      tone3: '3声',
      tone4: '4声',
      tone5: '5声',
      tone6: '6声',
      quizFolderScope: '练习生词范围',
      quizFolderAll: '全部生词',
      quizFolderInsufficient: '该文件夹内可用生词不足（至少需要 3 词）',
      folderDefault: '生词本'
    },
    'en': {
      spellingQuizTitle: 'Study & Quiz',
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
      spellingQuizNoWordsDetail: 'Please save at least 3 words to start quiz',
      spellingQuizInputPlaceholder: 'Type your answer…',
      spellingQuizProgress: '$1 / $2',
      spellingQuizResultCorrect: 'Correct',
      spellingQuizResultWrong: 'Wrong',
      spellingQuizResultSkipped: 'Skipped',
      spellingQuizYourAnswer: 'Your Answer:',
      spellingQuizCorrectAnswer: 'Correct Answer:',
      spellingQuizSeconds: 's',
      spellingQuizReviewTitle: 'Review',
      spellingQuizLoading: 'Loading dictionary…',
      quizSettingsTitle: 'Quiz Settings',
      quizSaveSettings: 'Save & Start',
      quizCancel: 'Cancel',
      quizReplayAudio: 'Click to play audio',
      quizMode: 'Question Types (Multi-select)',
      quizQuestionCount: 'Question Count',
      quizClozeTts: 'Sentence Cloze Auto-Audio',
      quizClozeTtsSentence: 'Read Sentence',
      quizClozeTtsWord: 'Read Word',
      quizClozeTtsOff: 'Off',
      quizModeSentenceCloze: 'Sentence Cloze',
      quizModeWordSpelling: 'Word Spelling',
      quizModeDefinitionChoice: 'Definition Choice',
      quizModeListeningChoice: 'Listening Quiz',
      quizCount10: '10 Questions',
      quizCount20: '20 Questions',
      quizCountAll: 'All Words',
      quizSelectCorrectDef: 'Select the correct definition:',
      quizListenSelectWord: 'Listen and choose the matching word:',
      quizWordLengthHint: '$1 chars',
      imeModeEnabled: 'Web Jyutping IME',
      imeModeDisabled: 'Web Jyutping IME (Disabled)',
      imeModeToggleTitle: 'Toggle Web Jyutping IME',
      toneCheatsheetTitle: 'Tone Keys:',
      toneCheatsheetTooltip: 'Type keys to specify tone directly (Supports 1-6 or v/x/q/vv/xx/qq)',
      tone1: 'Tone 1',
      tone2: 'Tone 2',
      tone3: 'Tone 3',
      tone4: 'Tone 4',
      tone5: 'Tone 5',
      tone6: 'Tone 6',
      quizFolderScope: 'Word Scope',
      quizFolderAll: 'All Words',
      quizFolderInsufficient: 'Not enough words in this folder (at least 3 words required)',
      folderDefault: 'Wordbook'
    },
    'ja': {
      spellingQuizTitle: '練習モード',
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
      spellingQuizNoWordsDetail: '単語帳に3語以上保存してください',
      spellingQuizInputPlaceholder: '答えを入力…',
      spellingQuizProgress: '$1 / $2',
      spellingQuizResultCorrect: '正解',
      spellingQuizResultWrong: '不正解',
      spellingQuizResultSkipped: 'スキップ',
      spellingQuizYourAnswer: 'あなたの回答：',
      spellingQuizCorrectAnswer: '正解：',
      spellingQuizSeconds: '秒',
      spellingQuizReviewTitle: '振り返り',
      spellingQuizLoading: '辞書を読み込み中…',
      quizSettingsTitle: '練習設定',
      quizSaveSettings: '保存して開始',
      quizCancel: 'キャンセル',
      quizReplayAudio: 'クリックして音声を再生',
      quizMode: '問題形式（複数選択可）',
      quizQuestionCount: '問題数',
      quizClozeTts: '例文穴埋めの自動音声',
      quizClozeTtsSentence: '例文を再生',
      quizClozeTtsWord: '単語を再生',
      quizClozeTtsOff: 'オフ',
      quizModeSentenceCloze: '例文穴埋め',
      quizModeWordSpelling: '単語スペル',
      quizModeDefinitionChoice: '意味の選択',
      quizModeListeningChoice: 'リスニング',
      quizCount10: '10問',
      quizCount20: '20問',
      quizCountAll: 'すべての単語',
      quizSelectCorrectDef: '正しい意味を選択してください：',
      quizListenSelectWord: '音声を聞いて正しい単語を選んでください：',
      quizWordLengthHint: '$1 文字',
      imeModeEnabled: 'Web版 粤拼入力',
      imeModeDisabled: 'Web版 粤拼入力 (オフ)',
      imeModeToggleTitle: 'Web版粤拼入力の切り替え',
      toneCheatsheetTitle: '声調キー：',
      toneCheatsheetTooltip: 'キー入力で直接声調を指定できます（数字1〜6またはv/x/q/vv/xx/qqに対応）',
      tone1: '第1声',
      tone2: '第2声',
      tone3: '第3声',
      tone4: '第4声',
      tone5: '第5声',
      tone6: '第6声',
      quizFolderScope: '出題範囲',
      quizFolderAll: 'すべての単語',
      quizFolderInsufficient: 'このフォルダには問題生成に必要な単語が不足しています（最低3単語必要）',
      folderDefault: '単語帳'
    },
    'ko': {
      spellingQuizTitle: '연습 모드',
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
      spellingQuizNoWordsDetail: '단어장에 최소 3개 이상의 단어를 추가해 주세요',
      spellingQuizInputPlaceholder: '답을 입력하세요…',
      spellingQuizProgress: '$1 / $2',
      spellingQuizResultCorrect: '정답',
      spellingQuizResultWrong: '오답',
      spellingQuizResultSkipped: '건너뜀',
      spellingQuizYourAnswer: '내 답변:',
      spellingQuizCorrectAnswer: '정답:',
      spellingQuizSeconds: '초',
      spellingQuizReviewTitle: '문제 리뷰',
      spellingQuizLoading: '사전 로딩 중…',
      quizSettingsTitle: '연습 설정',
      quizSaveSettings: '저장 및 시작',
      quizCancel: '취소',
      quizReplayAudio: '클릭하여 오디오 재생',
      quizMode: '문제 유형 (다중 선택 가능)',
      quizQuestionCount: '문제 수',
      quizClozeTts: '예문 빈칸 오디오 자동 재생',
      quizClozeTtsSentence: '예문 읽기',
      quizClozeTtsWord: '단어 읽기',
      quizClozeTtsOff: '끄기',
      quizModeSentenceCloze: '예문 빈칸 채우기',
      quizModeWordSpelling: '단어 맞춤법',
      quizModeDefinitionChoice: '의미 선택',
      quizModeListeningChoice: '듣기 평가',
      quizCount10: '10문제',
      quizCount20: '20문제',
      quizCountAll: '모든 단어',
      quizSelectCorrectDef: '올바른 의미를 선택하세요:',
      quizListenSelectWord: '소리를 듣고 알맞은 단어를 고르세요:',
      quizWordLengthHint: '$1 글자',
      imeModeEnabled: 'Web 즛핑 입력기',
      imeModeDisabled: 'Web 즛핑 입력기 (비활성화)',
      imeModeToggleTitle: '웹 광둥어 즛핑 입력기 전환',
      toneCheatsheetTitle: '성조 키:',
      toneCheatsheetTooltip: '해당 키를 입력하여 성조를 바로 지정할 수 있습니다 (숫자 1-6 또는 v/x/q/vv/xx/qq 지원)',
      tone1: '1성',
      tone2: '2성',
      tone3: '3성',
      tone4: '4성',
      tone5: '5성',
      tone6: '6성',
      quizFolderScope: '연습 단어 범위',
      quizFolderAll: '모든 단어',
      quizFolderInsufficient: '이 폴더에 연습 가능한 단어가 부족합니다 (최소 3개 필요)',
      folderDefault: '단어장'
    }
  };

  let currentLang = 'zh-HK';

  function normalizeLang(lang) {
    if (!lang) return 'zh-HK';
    if (lang === 'zh_TW' || lang === 'zh-TW') return 'zh-HK';
    if (lang === 'zh_CN') return 'zh-CN';
    return lang;
  }

  function t(key, ...args) {
    let str = (i18nStrings[currentLang] && i18nStrings[currentLang][key]) ||
              (i18nStrings['zh-HK'] && i18nStrings['zh-HK'][key]) ||
              key;
    args.forEach((arg, i) => {
      str = str.replace('$' + (i + 1), arg);
    });
    return str;
  }

  // ==================== Theme ====================

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

      if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
          if (namespace === 'sync' && changes.uiTheme) {
            const next = changes.uiTheme.newValue || 'auto';
            localStorage.setItem('jyutping_ui_theme', next);
            applyTheme(next);
          }
        });
      }
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    localStorage.setItem('jyutping_ui_theme', next);
    applyTheme(next);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ uiTheme: next });
    }
  }

  // ==================== Settings State ====================

  const SETTINGS_KEY = 'jyutping_quiz_settings';
  const WORDBOOK_FOLDERS_KEY = 'wordbook_folders';
  const WORDBOOK_DEFAULT_FOLDER_KEY = 'wordbook_default_folder_id';
  const ALL_QUIZ_TYPES = ['sentence_cloze', 'word_spelling', 'definition_choice', 'listening_choice'];

  let folders = [];
  let defaultFolderId = 'default';

  let quizSettings = {
    types: ['sentence_cloze', 'word_spelling', 'definition_choice', 'listening_choice'], // array of enabled types
    count: '10',        // '10' | '20' | 'all'
    clozeTts: 'sentence', // 'sentence' | 'word' | 'off'
    folderId: 'all'     // 'all' | folder ID
  };

  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mode && (!parsed.types || parsed.types.length === 0)) {
          if (parsed.mode === 'mixed') {
            parsed.types = [...ALL_QUIZ_TYPES];
          } else {
            parsed.types = [parsed.mode];
          }
        }
        quizSettings = Object.assign({}, quizSettings, parsed);
        if (!Array.isArray(quizSettings.types) || quizSettings.types.length === 0) {
          quizSettings.types = [...ALL_QUIZ_TYPES];
        }
      }
    } catch (e) {}

    // Check URL parameters for folder override
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlFolder = urlParams.get('folder') || urlParams.get('folderId');
      if (urlFolder) {
        quizSettings.folderId = urlFolder;
      }
    } catch (e) {}
  }

  function saveSettings(newSettings) {
    quizSettings = Object.assign({}, quizSettings, newSettings);
    if (!Array.isArray(quizSettings.types) || quizSettings.types.length === 0) {
      quizSettings.types = [...ALL_QUIZ_TYPES];
    }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(quizSettings));
    } catch (e) {}
  }

  function getWordbookBackUrl() {
    const targetFolder = quizSettings.folderId || 'all';
    if (targetFolder && targetFolder !== 'all') {
      return `wordbook.html?folder=${encodeURIComponent(targetFolder)}`;
    }
    return 'wordbook.html';
  }

  // ==================== Data Loading & Bottom Bar ====================

  const WORDBOOK_KEY = 'wordbook';
  let dictionary = null;
  let wordbook = [];
  let imeEngine = null;
  let ime = null;

  function updateBottomBarI18n() {
    const toneCheatsheet = document.getElementById('sqToneCheatsheet');
    if (toneCheatsheet) {
      toneCheatsheet.title = t('toneCheatsheetTooltip');
    }
    const toneTitle = document.getElementById('sqToneTitle');
    if (toneTitle) {
      toneTitle.textContent = t('toneCheatsheetTitle');
    }
    const toneLabels = document.querySelectorAll('.sq-tone-label');
    toneLabels.forEach(el => {
      const toneNum = el.getAttribute('data-tone');
      if (toneNum) {
        el.textContent = t('tone' + toneNum);
      }
    });

    if (ime && typeof ime.setI18n === 'function') {
      ime.setI18n({
        enabled: t('imeModeEnabled'),
        disabled: t('imeModeDisabled'),
        title: t('imeModeToggleTitle')
      });
    }
  }

  async function loadData() {
    // Load language
    await new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['uiLang', 'extensionLang'], (res) => {
          if (res) {
            const rawLang = res.uiLang || res.extensionLang;
            if (rawLang) currentLang = normalizeLang(rawLang);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });

    // Load wordbook & folders
    const storageRes = await new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([WORDBOOK_KEY, WORDBOOK_FOLDERS_KEY, WORDBOOK_DEFAULT_FOLDER_KEY], resolve);
      } else {
        resolve({});
      }
    });
    wordbook = storageRes[WORDBOOK_KEY] || [];
    folders = storageRes[WORDBOOK_FOLDERS_KEY] || [];
    defaultFolderId = storageRes[WORDBOOK_DEFAULT_FOLDER_KEY] || 'default';

    // Load dictionary
    const url = chrome.runtime.getURL('dictionary.json');
    const res = await fetch(url);
    dictionary = await res.json();

    // Initialize Web IME
    if (window.JyutpingImeEngine && window.JyutpingWebIme) {
      imeEngine = new window.JyutpingImeEngine();
      imeEngine.init(dictionary);
      ime = new window.JyutpingWebIme(imeEngine, {
        i18n: {
          enabled: t('imeModeEnabled'),
          disabled: t('imeModeDisabled'),
          title: t('imeModeToggleTitle')
        }
      });
    }

    updateBottomBarI18n();
    loadSettings();

    const extName = currentLang === 'zh-CN' ? '粤语悬浮词典' :
                    currentLang === 'en' ? 'Cantonese Hover Dictionary' :
                    currentLang === 'ja' ? '広東語ポップアップ辞書' :
                    currentLang === 'ko' ? '광둥어 팝업 사전' :
                    '粵語懸浮詞典';
    let quizPageTitle = t('spellingQuizTitle');
    if (quizSettings.folderId && quizSettings.folderId !== 'all') {
      const curFolder = folders.find(f => f.id === quizSettings.folderId);
      const folderName = curFolder ? (curFolder.id === 'default' ? t('folderDefault') : curFolder.name) : '';
      if (folderName) {
        quizPageTitle += ` (${folderName})`;
      }
    }
    document.title = quizPageTitle + ' - ' + extName;
  }

  // Listen to language changes from options/popup
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.uiLang || changes.extensionLang)) {
        const nextLang = (changes.uiLang || changes.extensionLang).newValue;
        if (nextLang) {
          currentLang = normalizeLang(nextLang);
          updateBottomBarI18n();
          if (quizState.questions && quizState.questions.length > 0) {
            renderQuizQuestion();
          }
        }
      }
    });
  }

  // ==================== Smart Distractor Engine ====================

  let cachedDictEntries = null;
  let dictByLength = null;

  function initDistractorPool() {
    if (cachedDictEntries) return;
    cachedDictEntries = Object.keys(dictionary).filter(k => {
      const e = dictionary[k];
      return e && e.jyutping && e.english && e.english.length > 0;
    });
    dictByLength = new Map();
    for (const k of cachedDictEntries) {
      const len = k.length;
      if (!dictByLength.has(len)) dictByLength.set(len, []);
      dictByLength.get(len).push(k);
    }
  }

  function getSmartDistractors(targetWord, targetDef, targetJyutping, count = 3) {
    initDistractorPool();
    const distractors = [];
    const usedWords = new Set([targetWord]);
    const usedDefs = new Set([targetDef]);

    // 1. 先優先從用戶的生詞本其他生詞中挑選干擾項 (加強專屬記憶效果)
    const otherWb = wordbook.filter(w => !w.deletedAt && w.character !== targetWord);
    for (const w of otherWb) {
      if (distractors.length >= count) break;
      const e = dictionary[w.character];
      if (!e) continue;
      const def = (e.english || []).filter(d => !d.startsWith('[粵]')).slice(0, 2).join('; ') || (e.english || [])[0] || '';
      if (def && !usedDefs.has(def)) {
        usedWords.add(w.character);
        usedDefs.add(def);
        distractors.push({
          word: w.character,
          traditional: e.traditional || w.character,
          jyutping: e.jyutping || w.jyutping || '',
          definition: def
        });
      }
    }

    // 2. 從長度相同/相近的大詞庫中補充高質量干擾項
    const len = targetWord.length;
    const pool = dictByLength.get(len) || cachedDictEntries;
    let attempts = 0;
    while (distractors.length < count && attempts < 150) {
      attempts++;
      const randWord = pool[Math.floor(Math.random() * pool.length)];
      if (usedWords.has(randWord)) continue;
      const e = dictionary[randWord];
      if (!e) continue;
      const def = (e.english || []).filter(d => !d.startsWith('[粵]')).slice(0, 2).join('; ') || (e.english || [])[0] || '';
      if (!def || usedDefs.has(def)) continue;

      usedWords.add(randWord);
      usedDefs.add(def);
      distractors.push({
        word: randWord,
        traditional: e.traditional || randWord,
        jyutping: e.jyutping || '',
        definition: def
      });
    }

    return distractors;
  }

  // ==================== Multi-Type Quiz Generator ====================

  function generateQuizQuestions(wb, dict, customSettings) {
    const settings = customSettings || quizSettings;
    const targetFolder = (settings && settings.folderId) || 'all';
    const activeWords = wb.filter(w => {
      if (w.deletedAt) return false;
      if (targetFolder !== 'all') {
        const fId = w.folderId || 'default';
        return fId === targetFolder;
      }
      return true;
    });
    if (activeWords.length === 0) return [];

    const availableMode = settings.mode || 'mixed';
    const rawBank = [];

    for (const word of activeWords) {
      const entry = dict[word.character];
      const trad = (entry && entry.traditional) || word.character;
      const simp = (entry && entry.simplified) || word.character;
      const jyutping = (entry && entry.jyutping) || word.jyutping || '';
      const engList = (entry && entry.english) ? entry.english.filter(d => !d.startsWith('[粵]')).slice(0, 2) : [];
      const primaryDef = engList.join('; ') || ((entry && entry.english && entry.english[0]) || word.explanation || '');

      // 檢查是否有可用例句
      let exampleItem = null;
      if (entry && entry.examples) {
        for (const exArr of entry.examples) {
          if (!exArr) continue;
          for (const ex of exArr) {
            if (!ex.yue || ex.yue.length < 4) continue;
            let targetWord = null;
            if (ex.yue.includes(trad)) targetWord = trad;
            else if (simp !== trad && ex.yue.includes(simp)) targetWord = simp;
            if (targetWord) {
              const idx = ex.yue.indexOf(targetWord);
              const blankMarker = '\x00BLANK' + targetWord.length + '\x00';
              const blankedSentence = ex.yue.substring(0, idx) + blankMarker + ex.yue.substring(idx + targetWord.length);
              exampleItem = {
                sentence: ex.yue,
                blankedSentence: blankedSentence,
                translation: ex.eng || '',
                targetWordLength: targetWord.length
              };
              break;
            }
          }
          if (exampleItem) break;
        }
      }

      // 生成干擾選項 (供選擇題使用)
      const distractors = getSmartDistractors(word.character, primaryDef, jyutping, 3);

      // 定義 4 種具體題型候選對象
      const typeCandidates = [];

      // 1. 例句填空 (Sentence Cloze)
      if (exampleItem) {
        typeCandidates.push({
          type: 'sentence_cloze',
          typeBadge: t('quizModeSentenceCloze'),
          word: word.character,
          traditional: trad,
          simplified: simp,
          jyutping: jyutping,
          sentence: exampleItem.sentence,
          blankedSentence: exampleItem.blankedSentence,
          wordLength: exampleItem.targetWordLength,
          translation: exampleItem.translation,
          english: engList
        });
      }

      // 2. 單詞拼寫 (Word Spelling)
      typeCandidates.push({
        type: 'word_spelling',
        typeBadge: t('quizModeWordSpelling'),
        word: word.character,
        traditional: trad,
        simplified: simp,
        jyutping: jyutping,
        wordLength: trad.length,
        prompt: primaryDef || trad,
        english: engList
      });

      // 3. 釋義選擇題 (Definition Choice)
      if (distractors.length >= 3 && primaryDef) {
        const choiceOptions = [
          { label: primaryDef, isCorrect: true },
          ...distractors.map(d => ({ label: d.definition, isCorrect: false }))
        ];
        // 打亂 4 個選項順序
        for (let i = choiceOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [choiceOptions[i], choiceOptions[j]] = [choiceOptions[j], choiceOptions[i]];
        }
        typeCandidates.push({
          type: 'definition_choice',
          typeBadge: t('quizModeDefinitionChoice'),
          word: word.character,
          traditional: trad,
          simplified: simp,
          jyutping: jyutping,
          correctDefinition: primaryDef,
          options: choiceOptions
        });
      }

      // 4. 聽音辨字題 (Listening Quiz)
      if (distractors.length >= 3) {
        const choiceOptions = [
          { label: trad, jyutping: jyutping, sub: primaryDef, isCorrect: true },
          ...distractors.map(d => ({ label: d.traditional, jyutping: d.jyutping, sub: d.definition, isCorrect: false }))
        ];
        for (let i = choiceOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [choiceOptions[i], choiceOptions[j]] = [choiceOptions[j], choiceOptions[i]];
        }
        typeCandidates.push({
          type: 'listening_choice',
          typeBadge: t('quizModeListeningChoice'),
          word: word.character,
          traditional: trad,
          simplified: simp,
          jyutping: jyutping,
          definition: primaryDef,
          options: choiceOptions
        });
      }

      rawBank.push({
        word: word.character,
        candidates: typeCandidates
      });
    }

    // 根據用戶多選的題型池進行精準組卷
    const questions = [];
    const enabledTypes = (settings.types && settings.types.length > 0)
      ? settings.types
      : ALL_QUIZ_TYPES;

    // 隨機打亂生詞順序
    for (let i = rawBank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rawBank[i], rawBank[j]] = [rawBank[j], rawBank[i]];
    }

    rawBank.forEach((item, index) => {
      // 輪詢用戶勾選的題型
      const targetType = enabledTypes[index % enabledTypes.length];
      let chosen = item.candidates.find(c => c.type === targetType);
      if (!chosen) {
        // 若特定題型缺失 (如例句不存在)，從用戶勾選的其他題型中選取
        for (const t of enabledTypes) {
          chosen = item.candidates.find(c => c.type === t);
          if (chosen) break;
        }
        if (!chosen) chosen = item.candidates[0];
      }
      if (chosen) questions.push(chosen);
    });

    // 截取題量
    let countLimit = questions.length;
    if (settings.count === '10') countLimit = 10;
    else if (settings.count === '20') countLimit = 20;

    return questions.slice(0, countLimit);
  }

  const quizState = {
    questions: [],
    currentIndex: 0,
    answers: [],
    startTime: 0,
    endTime: 0,
    hintUsed: false,
    answered: false,
    answeredAt: 0,
    autoAdvanceTimer: null
  };

  function startQuiz(questionsOverride) {
    const targetFolder = quizSettings.folderId || 'all';
    const scopedWords = wordbook.filter(w => {
      if (w.deletedAt) return false;
      if (targetFolder !== 'all') {
        return (w.folderId || 'default') === targetFolder;
      }
      return true;
    });

    if (scopedWords.length < 3) {
      const folderObj = folders.find(f => f.id === targetFolder);
      const fName = folderObj ? (folderObj.id === 'default' ? t('folderDefault') : folderObj.name) : '';
      renderEmpty(targetFolder !== 'all' ? (t('quizFolderInsufficient') || `該資料夾「${fName}」內可用生詞不足（至少需要 3 詞）`) : null);
      return;
    }

    const questions = questionsOverride || generateQuizQuestions(wordbook, dictionary);
    if (questions.length === 0) {
      renderEmpty();
      return;
    }
    quizState.questions = questions;
    quizState.currentIndex = 0;
    quizState.answers = [];
    quizState.startTime = Date.now();
    quizState.endTime = 0;
    quizState.hintUsed = false;
    quizState.answered = false;
    quizState.answeredAt = 0;
    renderQuizQuestion();
  }

  // ==================== Render Question ====================

  function renderQuizQuestion() {
    if (quizState.autoAdvanceTimer) {
      clearTimeout(quizState.autoAdvanceTimer);
      quizState.autoAdvanceTimer = null;
    }
    const q = quizState.questions[quizState.currentIndex];
    const total = quizState.questions.length;
    const current = quizState.currentIndex + 1;
    quizState.hintUsed = false;
    quizState.answered = false;
    quizState.answeredAt = 0;

    const container = document.getElementById('sqContainer');
    const bottomBar = document.getElementById('sqBottomBar');

    // 根據是否為打字填空題型，優雅顯隱底部的粵拼輸入法懸浮條
    const isTypingType = q.type === 'sentence_cloze' || q.type === 'word_spelling';
    if (bottomBar) {
      bottomBar.style.display = isTypingType ? 'flex' : 'none';
    }

    let cardBodyHtml = '';

    if (q.type === 'sentence_cloze') {
      // 題型 1：例句填空拼寫
      cardBodyHtml = `
        <div class="sq-sentence-row">
          <div class="sq-sentence" id="sqSentence">
            ${formatBlankedSentence(q.blankedSentence)}
          </div>
          <button class="sq-speak-btn" id="sqSentenceSpeakBtn" title="朗讀整句">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </button>
        </div>
        ${q.translation ? `<div class="sq-translation">${escapeHtml(q.translation)}</div>` : ''}
        ${q.english && q.english.length > 0 ? `<div class="sq-definition">${q.english.map(d => escapeHtml(d)).join(' · ')}</div>` : ''}
        
        <div class="sq-input-row">
          <input type="text" class="sq-input" id="sqInput" placeholder="${t('spellingQuizInputPlaceholder')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
          <button class="sq-word-speak-btn" id="sqWordSpeakBtn" title="朗讀單詞 (${escapeHtml(q.word)})">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </button>
        </div>

        <div class="sq-hint-area" id="sqHintArea">
          <button class="sq-hint-btn" id="sqHintBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>${t('spellingQuizShowHint')}</span>
          </button>
        </div>
      `;
    } else if (q.type === 'word_spelling') {
      // 題型 2：純單詞拼寫
      cardBodyHtml = `
        <div class="sq-word-prompt-wrap">
          <div class="sq-word-prompt-main">
            <span>${escapeHtml(q.prompt)}</span>
            <button class="sq-speak-btn" id="sqWordSpeakBtn" title="朗讀單詞">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            </button>
          </div>
          <div>
            <span class="sq-word-len-pill">${t('quizWordLengthHint').replace('$1', q.wordLength)}</span>
          </div>
        </div>

        <div class="sq-input-row">
          <input type="text" class="sq-input" id="sqInput" placeholder="${t('spellingQuizInputPlaceholder')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
        </div>

        <div class="sq-hint-area" id="sqHintArea">
          <button class="sq-hint-btn" id="sqHintBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>${t('spellingQuizShowHint')}</span>
          </button>
        </div>
      `;
    } else if (q.type === 'definition_choice') {
      // 題型 3：釋義選擇題
      const keys = ['1', '2', '3', '4'];
      cardBodyHtml = `
        <div class="sq-word-prompt-wrap">
          <div class="sq-word-prompt-main">
            <span>${escapeHtml(q.traditional)}</span>
            <button class="sq-speak-btn" id="sqWordSpeakBtn" title="朗讀單詞">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            </button>
          </div>
          <div class="sq-prompt-jyutping">${escapeHtml(q.jyutping)}</div>
          <div style="font-size: 13px; color: var(--text-muted); margin-top: 10px;">${t('quizSelectCorrectDef')}</div>
        </div>

        <div class="sq-choice-grid" id="sqChoiceGrid">
          ${q.options.map((opt, idx) => `
            <div class="sq-choice-item" data-index="${idx}">
              <div class="sq-choice-badge">${keys[idx]}</div>
              <div class="sq-choice-content">
                <div class="sq-choice-main">${escapeHtml(opt.label)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (q.type === 'listening_choice') {
      // 題型 4：聽音辨字題
      const keys = ['1', '2', '3', '4'];
      cardBodyHtml = `
        <div class="sq-listen-hero">
          <button class="sq-listen-btn" id="sqListenHeroBtn" title="${t('quizReplayAudio')}">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </button>
          <span class="sq-listen-hint">${t('quizListenSelectWord')}</span>
        </div>

        <div class="sq-choice-grid" id="sqChoiceGrid">
          ${q.options.map((opt, idx) => `
            <div class="sq-choice-item" data-index="${idx}">
              <div class="sq-choice-badge">${keys[idx]}</div>
              <div class="sq-choice-content">
                <div class="sq-choice-main">${escapeHtml(opt.label)} <span style="font-size: 13px; font-weight: 400; color: var(--text-muted); margin-left: 4px;">${escapeHtml(opt.jyutping)}</span></div>
                ${opt.sub ? `<div class="sq-choice-sub">${escapeHtml(opt.sub)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="sq-header">
        <a href="${getWordbookBackUrl()}" class="sq-back-btn" id="sqBackBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>${t('spellingQuizBack')}</span>
        </a>
        <div class="sq-header-right">
          <div class="sq-progress-text">${t('spellingQuizProgress').replace('$1', current).replace('$2', total)}</div>
          <button class="sq-settings-btn" id="sqSettingsBtn" title="${t('quizSettingsTitle')}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button class="sq-theme-toggle" id="sqThemeToggle" title="Toggle theme">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="sq-progress-bar-wrap">
        <div class="sq-progress-bar" style="width: ${(current / total) * 100}%"></div>
      </div>

      <div class="sq-card" id="sqCard">
        <span class="sq-type-badge">${q.typeBadge}</span>
        ${cardBodyHtml}
        <div class="sq-feedback" id="sqFeedback" style="display: none;"></div>
      </div>

      <div class="sq-actions">
        <button class="sq-action-btn sq-skip-btn" id="sqSkipBtn">${t('spellingQuizSkip')}</button>
        <button class="sq-action-btn sq-confirm-btn" id="sqConfirmBtn">
          <span>${t('spellingQuizConfirm')}</span>
          <span class="sq-enter-badge" title="按 Enter 鍵確認答案">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 10 4 15 9 20"></polyline>
              <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
            </svg>
            <span>Enter</span>
          </span>
        </button>
      </div>
    `;

    bindQuestionEvents(q);
  }

  // ==================== Question Events ====================

  function bindQuestionEvents(q) {
    const input = document.getElementById('sqInput');
    const confirmBtn = document.getElementById('sqConfirmBtn');
    const skipBtn = document.getElementById('sqSkipBtn');
    const hintBtn = document.getElementById('sqHintBtn');
    const themeBtn = document.getElementById('sqThemeToggle');
    const settingsBtn = document.getElementById('sqSettingsBtn');
    const sentenceSpeakBtn = document.getElementById('sqSentenceSpeakBtn');
    const wordSpeakBtn = document.getElementById('sqWordSpeakBtn');
    const listenHeroBtn = document.getElementById('sqListenHeroBtn');
    const choiceGrid = document.getElementById('sqChoiceGrid');

    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Attach Web IME if text input exists
    if (input && ime) {
      ime.attach(input, document.getElementById('sqImeBottomToggle'));
      setTimeout(() => input.focus(), 80);
    }

    // Auto TTS on question load
    if (q.type === 'sentence_cloze') {
      const clozeTtsMode = quizSettings.clozeTts || 'sentence';
      if (clozeTtsMode === 'sentence') {
        setTimeout(() => playTts(q.sentence, sentenceSpeakBtn), 200);
      } else if (clozeTtsMode === 'word') {
        setTimeout(() => playTts(q.word, wordSpeakBtn), 200);
      }
    } else if (q.type === 'listening_choice') {
      setTimeout(() => playTts(q.word, listenHeroBtn), 200);
    } else if (q.type === 'word_spelling' || q.type === 'definition_choice') {
      setTimeout(() => playTts(q.word, wordSpeakBtn), 200);
    }

    // 朗讀按鈕事件
    if (sentenceSpeakBtn) {
      sentenceSpeakBtn.addEventListener('click', () => {
        playTts(q.sentence, sentenceSpeakBtn);
        if (input) input.focus();
      });
    }
    if (wordSpeakBtn) {
      wordSpeakBtn.addEventListener('click', () => {
        playTts(q.word, wordSpeakBtn);
        if (input) input.focus();
      });
    }
    if (listenHeroBtn) {
      listenHeroBtn.addEventListener('click', () => {
        playTts(q.word, listenHeroBtn);
      });
    }

    // 打字題：輸入與提交
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          e.stopPropagation();
          if (quizState.answered) {
            if (Date.now() - (quizState.answeredAt || 0) > 300) {
              goToNextQuestion();
            }
          } else {
            checkCurrentAnswer();
          }
        }
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (quizState.answered) {
          goToNextQuestion();
        } else {
          checkCurrentAnswer();
        }
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        if (quizState.answered) {
          goToNextQuestion();
        } else {
          quizState.answers.push({ input: '', correct: false, skipped: true, question: q });
          showFeedback(false, true);
        }
      });
    }

    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        quizState.hintUsed = true;
        const jp = q.jyutping;
        const parts = jp.split(' ');
        let hint = parts.map((p, i) => i === 0 ? p : p.charAt(0) + '___').join(' ');
        const hintArea = document.getElementById('sqHintArea');
        if (hintArea) {
          hintArea.innerHTML = `<div class="sq-hint-text"><span class="sq-hint-label">${t('spellingQuizHint')}:</span> ${escapeHtml(hint)}</div>`;
        }
        if (input) input.focus();
      });
    }

    // 選擇題：選項點擊事件
    if (choiceGrid) {
      const items = choiceGrid.querySelectorAll('.sq-choice-item');
      items.forEach(item => {
        item.addEventListener('click', () => {
          if (quizState.answered) return;
          const idx = parseInt(item.getAttribute('data-index'), 10);
          handleChoiceSelection(idx, q);
        });
      });
    }
  }

  function handleChoiceSelection(selectedIndex, q) {
    if (quizState.answered) return;
    const selectedOpt = q.options[selectedIndex];
    const isCorrect = selectedOpt && selectedOpt.isCorrect;

    quizState.answers.push({
      input: selectedOpt ? (selectedOpt.label || '') : '',
      correct: isCorrect,
      skipped: false,
      question: q
    });

    const choiceGrid = document.getElementById('sqChoiceGrid');
    if (choiceGrid) {
      const items = choiceGrid.querySelectorAll('.sq-choice-item');
      items.forEach((item, idx) => {
        const opt = q.options[idx];
        if (idx === selectedIndex) {
          item.classList.add('is-selected');
          item.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
        } else if (!isCorrect && opt.isCorrect) {
          item.classList.add('is-revealed-correct');
        }
      });
    }

    showFeedback(isCorrect, false);
  }

  function formatBlankedSentence(blanked) {
    if (!blanked) return '';
    const match = blanked.match(/\x00BLANK(\d+)\x00/);
    if (!match) return `<span>${escapeHtml(blanked)}</span>`;
    const charCount = parseInt(match[1], 10);
    const parts = blanked.split(match[0]);
    const lines = '\uFF3F'.repeat(charCount);
    return `<span>${escapeHtml(parts[0])}</span><span class="sq-blank">${lines}</span><span>${escapeHtml(parts.slice(1).join(''))}</span>`;
  }

  function formatFilledSentence(blanked, filledWord, isCorrect) {
    if (!blanked) return '';
    const match = blanked.match(/\x00BLANK(\d+)\x00/);
    if (!match) return `<span>${escapeHtml(blanked)}</span>`;
    const parts = blanked.split(match[0]);
    const cls = isCorrect ? 'sq-filled-word is-correct' : 'sq-filled-word is-wrong';
    return `<span>${escapeHtml(parts[0])}</span><span class="${cls}">${escapeHtml(filledWord)}</span><span>${escapeHtml(parts.slice(1).join(''))}</span>`;
  }

  function checkCurrentAnswer() {
    const input = document.getElementById('sqInput');
    if (!input) return;
    const userAnswer = (input.value || '').trim();
    if (!userAnswer) return;

    const q = quizState.questions[quizState.currentIndex];
    const isCorrect = userAnswer === q.traditional || userAnswer === q.simplified || userAnswer === q.word;
    quizState.answers.push({ input: userAnswer, correct: isCorrect, skipped: false, question: q });
    showFeedback(isCorrect, false);
  }

  function showFeedback(isCorrect, isSkipped) {
    quizState.answered = true;
    quizState.answeredAt = Date.now();
    const q = quizState.questions[quizState.currentIndex];
    const feedback = document.getElementById('sqFeedback');
    const input = document.getElementById('sqInput');
    const card = document.getElementById('sqCard');
    const confirmBtn = document.getElementById('sqConfirmBtn');
    const skipBtn = document.getElementById('sqSkipBtn');
    const sentenceEl = document.getElementById('sqSentence');

    if (input) input.readOnly = true;
    if (skipBtn) skipBtn.style.display = 'none';

    // 1. 若為例句填空，在上方句子中即時填入對應單詞
    if (sentenceEl && q.type === 'sentence_cloze') {
      sentenceEl.innerHTML = formatFilledSentence(q.blankedSentence, q.traditional, isCorrect);
    }

    // 2. 答對時：停留 1.2 秒讓用戶清晰看到反饋與填入內容，隨後平滑自動翻題
    if (isCorrect) {
      if (card) card.classList.add('sq-correct');
      if (input) input.classList.add('sq-input-correct');
      if (confirmBtn) confirmBtn.style.display = 'none';
      if (feedback) {
        feedback.innerHTML = `
          <div class="sq-feedback-correct">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${t('spellingQuizCorrect')}</span>
          </div>
        `;
        feedback.style.display = 'block';
      }

      quizState.autoAdvanceTimer = setTimeout(() => {
        if (quizState.answered) goToNextQuestion();
      }, 1200);
    } else {
      // 3. 答錯/跳過時：保留時間讓用戶查看正確答案與拼音，顯示手動「下一題」按鈕
      if (card) card.classList.add('sq-wrong');
      if (!isSkipped && input) input.classList.add('sq-input-wrong');
      if (confirmBtn) {
        confirmBtn.classList.add('is-next');
        const nextText = quizState.currentIndex < quizState.questions.length - 1 ? t('spellingQuizNext') : t('spellingQuizComplete');
        confirmBtn.innerHTML = `
          <span>${nextText}</span>
          <span class="sq-enter-badge" title="按 Enter 鍵進入下一題">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 10 4 15 9 20"></polyline>
              <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
            </svg>
            <span>Enter</span>
          </span>
        `;
        confirmBtn.style.display = 'inline-flex';
      }

      if (feedback) {
        feedback.innerHTML = `
          <div class="sq-feedback-wrong">
            <span>${isSkipped ? '' : '✗ '}${t('spellingQuizWrong')}: <strong>${escapeHtml(q.traditional || q.word)}</strong></span>
            <span class="sq-feedback-jyutping">${escapeHtml(q.jyutping)}</span>
          </div>
        `;
        feedback.style.display = 'block';
      }
    }
  }

  function goToNextQuestion() {
    if (ime) ime.clearBuffer();
    if (quizState.currentIndex < quizState.questions.length - 1) {
      quizState.currentIndex++;
      renderQuizQuestion();
    } else {
      quizState.endTime = Date.now();
      renderQuizResults();
    }
  }

  // ==================== Results & Review ====================

  function renderQuizResults() {
    const answers = quizState.answers;
    const total = answers.length;
    const correct = answers.filter(a => a.correct).length;
    const wrong = answers.filter(a => !a.correct && !a.skipped).length;
    const skipped = answers.filter(a => a.skipped).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const elapsed = Math.round((quizState.endTime - quizState.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}${t('spellingQuizSeconds')}` : `${seconds}${t('spellingQuizSeconds')}`;

    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (accuracy / 100) * circumference;
    const ringColor = accuracy >= 80 ? 'var(--success)' : accuracy >= 50 ? 'var(--warning)' : 'var(--danger)';
    const wrongQuestions = answers.filter(a => !a.correct).map(a => a.question);

    const bottomBar = document.getElementById('sqBottomBar');
    if (bottomBar) bottomBar.style.display = 'none';

    const container = document.getElementById('sqContainer');
    container.innerHTML = `
      <div class="sq-header">
        <a href="${getWordbookBackUrl()}" class="sq-back-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>${t('spellingQuizBack')}</span>
        </a>
        <div class="sq-header-right">
          <button class="sq-settings-btn" id="sqSettingsBtn" title="${t('quizSettingsTitle')}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button class="sq-theme-toggle" id="sqThemeToggle" title="Toggle theme">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="sq-result-card">
        <div class="sq-result-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>${t('spellingQuizComplete')}</span>
        </div>

        <div class="sq-result-ring-section">
          <div class="sq-result-ring">
            <svg viewBox="0 0 120 120" width="150" height="150">
              <circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--border)" stroke-width="8" />
              <circle cx="60" cy="60" r="${radius}" fill="none" stroke="${ringColor}" stroke-width="8"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                stroke-linecap="round" transform="rotate(-90 60 60)"
                style="transition: stroke-dashoffset 1s ease;" />
            </svg>
            <div class="sq-result-ring-text">
              <span class="sq-result-pct">${accuracy}%</span>
              <span class="sq-result-pct-label">${t('spellingQuizAccuracy')}</span>
            </div>
          </div>
        </div>

        <div class="sq-result-stats">
          <div class="sq-result-stat">
            <span class="sq-stat-value sq-stat-correct">${correct}</span>
            <span class="sq-stat-label">${t('spellingQuizResultCorrect')}</span>
          </div>
          <div class="sq-result-stat">
            <span class="sq-stat-value sq-stat-wrong">${wrong}</span>
            <span class="sq-stat-label">${t('spellingQuizResultWrong')}</span>
          </div>
          <div class="sq-result-stat">
            <span class="sq-stat-value sq-stat-skipped">${skipped}</span>
            <span class="sq-stat-label">${t('spellingQuizResultSkipped')}</span>
          </div>
          <div class="sq-result-stat">
            <span class="sq-stat-value">${timeStr}</span>
            <span class="sq-stat-label">${t('spellingQuizTime')}</span>
          </div>
        </div>

        <div class="sq-result-actions">
          <button class="sq-action-btn sq-retry-btn" id="sqRetryBtn">${t('spellingQuizRetry')}</button>
          ${wrongQuestions.length > 0 ? `<button class="sq-action-btn sq-retry-wrong-btn" id="sqRetryWrongBtn">${t('spellingQuizRetryWrong')}</button>` : ''}
          <a href="${getWordbookBackUrl()}" class="sq-action-btn sq-back-to-wb-btn">${t('spellingQuizBack')}</a>
        </div>
      </div>

      ${answers.length > 0 ? `
        <div class="sq-review-section">
          <h3 class="sq-review-title">${t('spellingQuizReviewTitle')}</h3>
          <div class="sq-review-list">
            ${answers.map((a, i) => {
              const q = a.question;
              const isCorrect = a.correct;
              const isSkipped = a.skipped;

              // Determine correct answer display text
              let correctTargetText = q.traditional || q.word;
              if (q.type === 'definition_choice') {
                correctTargetText = q.correctDefinition || (q.options && q.options.find(o => o.isCorrect)?.label) || q.word;
              }

              // Determine contextual display (Sentence or Definition)
              let contextText = '';
              let speakText = q.traditional || q.word;
              if (q.sentence) {
                contextText = q.sentence;
                speakText = q.sentence;
              } else if (q.prompt || q.correctDefinition || q.definition) {
                contextText = q.prompt || q.correctDefinition || q.definition;
              }

              let statusBadge = '';
              if (isCorrect) {
                statusBadge = `
                  <span class="sq-review-badge is-correct">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>${t('spellingQuizResultCorrect')}</span>
                  </span>
                `;
              } else if (isSkipped) {
                statusBadge = `
                  <span class="sq-review-badge is-skipped">
                    <span>${t('spellingQuizResultSkipped')}</span>
                  </span>
                `;
              } else {
                statusBadge = `
                  <span class="sq-review-badge is-wrong">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <span>${t('spellingQuizResultWrong')}</span>
                  </span>
                `;
              }

              return `
                <div class="sq-review-item ${isCorrect ? 'is-correct' : isSkipped ? 'is-skipped' : 'is-wrong'}">
                  <div class="sq-review-header">
                    <div class="sq-review-title-group">
                      <span class="sq-review-num">${i + 1}.</span>
                      <span class="sq-review-word">${escapeHtml(q.traditional || q.word)}</span>
                      ${q.jyutping ? `<span class="sq-review-jyutping">${escapeHtml(q.jyutping)}</span>` : ''}
                      <span class="sq-review-type">${escapeHtml(q.typeBadge)}</span>
                    </div>
                    <div class="sq-review-status ${isCorrect ? 'is-correct' : isSkipped ? 'is-skipped' : 'is-wrong'}">
                      ${isCorrect ? '✓ ' + t('spellingQuizResultCorrect') : isSkipped ? t('spellingQuizResultSkipped') : '✗ ' + t('spellingQuizResultWrong')}
                    </div>
                  </div>

                  ${contextText ? `
                    <div class="sq-review-context">
                      <span class="sq-review-sentence-text">${escapeHtml(contextText)}</span>
                      <button class="sq-review-speak-btn" data-text="${escapeHtml(speakText)}" title="朗讀">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                          <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                        </svg>
                      </button>
                    </div>
                  ` : ''}

                  ${!isCorrect ? `
                    <div class="sq-review-diff">
                      ${!isSkipped && a.input ? `
                        <div class="sq-diff-row">
                          <span class="sq-diff-label">${t('spellingQuizYourAnswer')}</span>
                          <span class="sq-diff-val is-wrong">${escapeHtml(a.input)}</span>
                        </div>
                      ` : ''}
                      <div class="sq-diff-row">
                        <span class="sq-diff-label">${t('spellingQuizCorrectAnswer')}</span>
                        <span class="sq-diff-val is-correct">${escapeHtml(correctTargetText)}</span>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Bind results events
    document.getElementById('sqRetryBtn').addEventListener('click', () => startQuiz());
    const themeBtn = document.getElementById('sqThemeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    const settingsBtn = document.getElementById('sqSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);

    const retryWrongBtn = document.getElementById('sqRetryWrongBtn');
    if (retryWrongBtn) {
      retryWrongBtn.addEventListener('click', () => {
        if (wrongQuestions.length >= 1) startQuiz(wrongQuestions);
      });
    }

    // Bind review speak buttons
    document.querySelectorAll('.sq-review-speak-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const txt = btn.getAttribute('data-text');
        if (txt) playTts(txt, btn);
      });
    });
  }

  function renderLoading() {
    const container = document.getElementById('sqContainer');
    container.innerHTML = `
      <div class="sq-header">
        <a href="${getWordbookBackUrl()}" class="sq-back-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>${t('spellingQuizBack')}</span>
        </a>
      </div>
      <div class="sq-loading">
        <div class="sq-loading-spinner"></div>
        <span>${t('spellingQuizLoading')}</span>
      </div>
    `;
  }

  function renderEmpty(customDesc) {
    const bottomBar = document.getElementById('sqBottomBar');
    if (bottomBar) bottomBar.style.display = 'none';

    const container = document.getElementById('sqContainer');
    container.innerHTML = `
      <div class="sq-header">
        <a href="${getWordbookBackUrl()}" class="sq-back-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>${t('spellingQuizBack')}</span>
        </a>
        <div class="sq-header-right">
          <button class="sq-settings-btn" id="sqSettingsBtn" title="${t('quizSettingsTitle')}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button class="sq-theme-toggle" id="sqThemeToggle" title="Toggle theme">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="sq-empty">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
        <div class="sq-empty-title">${t('spellingQuizNoWords')}</div>
        <div class="sq-empty-desc">${customDesc || t('spellingQuizNoWordsDetail')}</div>
        <div style="display: flex; gap: 10px; margin-top: 12px;">
          <a href="${getWordbookBackUrl()}" class="sq-action-btn sq-back-to-wb-btn">${t('spellingQuizBack')}</a>
          <button type="button" class="sq-action-btn sq-retry-btn" id="sqOpenSettingsFromEmpty">${t('quizSettingsTitle')}</button>
        </div>
      </div>
    `;
    const themeBtn = document.getElementById('sqThemeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    const settingsBtn = document.getElementById('sqSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
    const emptySettingsBtn = document.getElementById('sqOpenSettingsFromEmpty');
    if (emptySettingsBtn) emptySettingsBtn.addEventListener('click', openSettingsModal);
  }

  // ==================== Settings Modal Control ====================

  let tempSettings = { ...quizSettings };

  function openSettingsModal() {
    tempSettings = {
      types: [...(quizSettings.types || ALL_QUIZ_TYPES)],
      count: quizSettings.count || '10',
      clozeTts: quizSettings.clozeTts || 'sentence',
      folderId: quizSettings.folderId || 'all'
    };
    const modal = document.getElementById('sqSettingsModal');
    if (!modal) return;

    // Update modal labels with i18n
    const titleText = document.getElementById('sqModalTitleText');
    if (titleText) titleText.textContent = t('quizSettingsTitle');
    const folderTitle = document.getElementById('sqModalFolderSectionTitle');
    if (folderTitle) folderTitle.textContent = t('quizFolderScope') || '練習生詞範圍';
    const modeTitle = document.getElementById('sqModalModeSectionTitle');
    if (modeTitle) modeTitle.textContent = t('quizMode');
    const countTitle = document.getElementById('sqModalCountSectionTitle');
    if (countTitle) countTitle.textContent = t('quizQuestionCount');
    const clozeTtsTitle = document.getElementById('sqModalClozeTtsSectionTitle');
    if (clozeTtsTitle) clozeTtsTitle.textContent = t('quizClozeTts');
    const saveBtn = document.getElementById('sqModalSaveBtn');
    if (saveBtn) saveBtn.textContent = t('quizSaveSettings');
    const cancelBtn = document.getElementById('sqModalCancelBtn');
    if (cancelBtn) cancelBtn.textContent = t('quizCancel');

    // Update Folder Scope Pills
    const folderPillsContainer = document.getElementById('sqFolderPills');
    if (folderPillsContainer) {
      const activeWb = wordbook.filter(w => !w.deletedAt);
      const allCount = activeWb.length;
      let pillsHtml = `
        <button type="button" class="sq-radio-pill ${(tempSettings.folderId || 'all') === 'all' ? 'is-active' : ''}" data-folder="all">
          ${t('quizFolderAll') || '全部生詞'} (${allCount})
        </button>
      `;

      folders.forEach(f => {
        const count = activeWb.filter(w => (w.folderId || 'default') === f.id).length;
        const fName = (f.id === 'default') ? (t('folderDefault') || '預設生詞') : f.name;
        pillsHtml += `
          <button type="button" class="sq-radio-pill ${tempSettings.folderId === f.id ? 'is-active' : ''}" data-folder="${f.id}">
            ${escapeHtml(fName)} (${count})
          </button>
        `;
      });

      folderPillsContainer.innerHTML = pillsHtml;

      folderPillsContainer.querySelectorAll('.sq-radio-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          folderPillsContainer.querySelectorAll('.sq-radio-pill').forEach(p => p.classList.remove('is-active'));
          pill.classList.add('is-active');
          tempSettings.folderId = pill.getAttribute('data-folder');
        });
      });
    }

    // Update Mode Pills (Multi-Select)
    const modePills = document.querySelectorAll('#sqModePills .sq-radio-pill');
    const activeSet = new Set(tempSettings.types);
    modePills.forEach(pill => {
      const mode = pill.getAttribute('data-mode');
      if (mode === 'sentence_cloze') pill.textContent = t('quizModeSentenceCloze');
      else if (mode === 'word_spelling') pill.textContent = t('quizModeWordSpelling');
      else if (mode === 'definition_choice') pill.textContent = t('quizModeDefinitionChoice');
      else if (mode === 'listening_choice') pill.textContent = t('quizModeListeningChoice');

      pill.classList.toggle('is-active', activeSet.has(mode));
    });

    // Update Count Pills
    const countPills = document.querySelectorAll('#sqCountPills .sq-radio-pill');
    countPills.forEach(pill => {
      const count = pill.getAttribute('data-count');
      if (count === '10') pill.textContent = t('quizCount10');
      else if (count === '20') pill.textContent = t('quizCount20');
      else if (count === 'all') pill.textContent = t('quizCountAll');

      pill.classList.toggle('is-active', count === tempSettings.count);
    });

    // Update Cloze TTS Pills
    const clozeTtsPills = document.querySelectorAll('#sqClozeTtsPills .sq-radio-pill');
    clozeTtsPills.forEach(pill => {
      const ttsMode = pill.getAttribute('data-cloze-tts');
      if (ttsMode === 'sentence') pill.textContent = t('quizClozeTtsSentence');
      else if (ttsMode === 'word') pill.textContent = t('quizClozeTtsWord');
      else if (ttsMode === 'off') pill.textContent = t('quizClozeTtsOff');

      pill.classList.toggle('is-active', ttsMode === (tempSettings.clozeTts || 'sentence'));
    });

    modal.classList.add('open');
  }

  function closeSettingsModal() {
    const modal = document.getElementById('sqSettingsModal');
    if (modal) modal.classList.remove('open');
  }

  function initSettingsModalEvents() {
    const modal = document.getElementById('sqSettingsModal');
    const closeBtn = document.getElementById('sqModalCloseBtn');
    const cancelBtn = document.getElementById('sqModalCancelBtn');
    const saveBtn = document.getElementById('sqModalSaveBtn');

    if (closeBtn) closeBtn.addEventListener('click', closeSettingsModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeSettingsModal);

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSettingsModal();
      });
    }

    // Mode selection (Multi-Select toggle)
    const modePills = document.querySelectorAll('#sqModePills .sq-radio-pill');
    modePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const isCurrentlyActive = pill.classList.contains('is-active');
        const activeCount = document.querySelectorAll('#sqModePills .sq-radio-pill.is-active').length;

        // Ensure at least 1 type remains selected
        if (isCurrentlyActive && activeCount <= 1) {
          return;
        }

        pill.classList.toggle('is-active');
        const selected = Array.from(document.querySelectorAll('#sqModePills .sq-radio-pill.is-active'))
          .map(p => p.getAttribute('data-mode'));
        tempSettings.types = selected;
      });
    });

    // Count selection (Single-Select)
    const countPills = document.querySelectorAll('#sqCountPills .sq-radio-pill');
    countPills.forEach(pill => {
      pill.addEventListener('click', () => {
        countPills.forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        tempSettings.count = pill.getAttribute('data-count');
      });
    });

    // Cloze TTS selection (Single-Select)
    const clozeTtsPills = document.querySelectorAll('#sqClozeTtsPills .sq-radio-pill');
    clozeTtsPills.forEach(pill => {
      pill.addEventListener('click', () => {
        clozeTtsPills.forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        tempSettings.clozeTts = pill.getAttribute('data-cloze-tts');
      });
    });

    // Save and restart
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        saveSettings(tempSettings);
        closeSettingsModal();
        startQuiz();
      });
    }
  }

  // ==================== Init ====================

  async function init() {
    initTheme();
    renderLoading();

    try {
      await loadData();
      initSettingsModalEvents();
      startQuiz();
    } catch (e) {
      console.error('Failed to initialize spelling quiz', e);
      renderEmpty();
    }
  }

  init();

  // ==================== Global Keyboard & Focus Handling ====================

  document.addEventListener('click', (e) => {
    if (e.target.closest('.sq-back-btn') || e.target.closest('a') || e.target.closest('.sq-modal-overlay') || e.target.closest('.sq-settings-btn')) return;
    const input = document.getElementById('sqInput');
    if (input && !input.readOnly && document.activeElement !== input) {
      input.focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Esc closes settings modal
    if (e.key === 'Escape') {
      closeSettingsModal();
      return;
    }

    // Modal open, skip quiz shortcuts
    const modal = document.getElementById('sqSettingsModal');
    if (modal && modal.classList.contains('open')) return;

    // Enter to next question after answered
    if (e.key === 'Enter') {
      if (quizState.answered) {
        if (Date.now() - (quizState.answeredAt || 0) > 300) {
          e.preventDefault();
          goToNextQuestion();
          return;
        }
      }
    }

    // 選擇題鍵盤快捷鍵：按 1/2/3/4 或 A/B/C/D 快速作答
    const currentQ = quizState.questions && quizState.questions[quizState.currentIndex];
    if (currentQ && (currentQ.type === 'definition_choice' || currentQ.type === 'listening_choice') && !quizState.answered) {
      let choiceIndex = -1;
      if (e.key === '1' || e.key === 'a' || e.key === 'A') choiceIndex = 0;
      else if (e.key === '2' || e.key === 'b' || e.key === 'B') choiceIndex = 1;
      else if (e.key === '3' || e.key === 'c' || e.key === 'C') choiceIndex = 2;
      else if (e.key === '4' || e.key === 'd' || e.key === 'D') choiceIndex = 3;

      if (choiceIndex >= 0 && choiceIndex < (currentQ.options || []).length) {
        e.preventDefault();
        handleChoiceSelection(choiceIndex, currentQ);
        return;
      }
    }

    // 填空題輸入框焦點保持
    const input = document.getElementById('sqInput');
    if (input && !input.readOnly && document.activeElement !== input) {
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
        input.focus();
      }
    }
  });

})();
