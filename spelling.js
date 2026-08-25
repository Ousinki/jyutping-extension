/**
 * 拼寫練習頁面邏輯
 * spelling.js — Standalone quiz page
 */
(function () {
  'use strict';

  function escapeHtml(text) {
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

  function playTts(text, ttsBtn) {
    if (!text) return;
    const reqId = ++currentTtsRequestId;
    stopAllAudio();
    startSpeaking(ttsBtn);

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
          const audio = new Audio(URL.createObjectURL(blob));
          currentAudio = audio;
          audio.onended = () => { if (reqId === currentTtsRequestId) { URL.revokeObjectURL(audio.src); currentAudio = null; stopSpeaking(); } };
          audio.onerror = () => { if (reqId === currentTtsRequestId) { currentAudio = null; stopSpeaking(); } };
          audio.play();
        } catch (e) {
          if (reqId !== currentTtsRequestId) return;
          // Fallback
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
      spellingQuizLoading: '正在載入詞典…'
    },
    'zh-CN': {
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
      spellingQuizLoading: '正在加载词典…'
    },
    'en': {
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
      spellingQuizLoading: 'Loading dictionary…'
    },
    'ja': {
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
      spellingQuizLoading: '辞書を読み込み中…'
    },
    'ko': {
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
      spellingQuizLoading: '사전 로딩 중…'
    }
  };

  let currentLang = 'zh-HK';

  function t(key) {
    return (i18nStrings[currentLang] && i18nStrings[currentLang][key]) ||
           (i18nStrings['zh-HK'] && i18nStrings['zh-HK'][key]) ||
           key;
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

  // ==================== Data Loading ====================

  const WORDBOOK_KEY = 'wordbook';
  let dictionary = null;
  let wordbook = [];
  let imeEngine = null;
  let ime = null;

  async function loadData() {
    // Load language
    await new Promise(resolve => {
      chrome.storage.local.get(['extensionLang'], (res) => {
        if (res.extensionLang) currentLang = res.extensionLang;
        resolve();
      });
    });

    // Update page title
    document.title = t('spellingQuizTitle') + ' - 粵語懸浮詞典';

    // Load wordbook
    wordbook = await new Promise(resolve => {
      chrome.storage.local.get([WORDBOOK_KEY], result => {
        resolve(result[WORDBOOK_KEY] || []);
      });
    });

    // Load dictionary
    const url = chrome.runtime.getURL('dictionary.json');
    const res = await fetch(url);
    dictionary = await res.json();

    // Initialize Web IME
    if (window.JyutpingImeEngine && window.JyutpingWebIme) {
      imeEngine = new window.JyutpingImeEngine();
      imeEngine.init(dictionary);
      ime = new window.JyutpingWebIme(imeEngine);
    }
  }

  // ==================== Quiz Engine ====================

  function generateQuizQuestions(wb, dict) {
    const questions = [];
    const activeWords = wb.filter(w => !w.deletedAt);
    for (const word of activeWords) {
      const entry = dict[word.character];
      if (!entry || !entry.examples) continue;
      for (const exArr of entry.examples) {
        if (!exArr) continue;
        for (const ex of exArr) {
          if (!ex.yue || ex.yue.length < 4) continue;
          const trad = entry.traditional || word.character;
          const simp = entry.simplified || word.character;
          let targetWord = null;
          if (ex.yue.includes(trad)) targetWord = trad;
          else if (simp !== trad && ex.yue.includes(simp)) targetWord = simp;
          if (!targetWord) continue;
          const idx = ex.yue.indexOf(targetWord);
          const blankMarker = '\x00BLANK' + targetWord.length + '\x00';
          const blankedSentence = ex.yue.substring(0, idx) + blankMarker + ex.yue.substring(idx + targetWord.length);
          questions.push({
            word: word.character,
            traditional: trad,
            simplified: simp,
            jyutping: entry.jyutping || word.jyutping || '',
            sentence: ex.yue,
            blankedSentence: blankedSentence,
            wordLength: targetWord.length,
            translation: ex.eng || '',
            english: (entry.english || []).filter(d => !d.startsWith('[粵]')).slice(0, 2)
          });
          break;
        }
      }
    }
    // Fisher-Yates shuffle
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    return questions;
  }

  const quizState = {
    questions: [],
    currentIndex: 0,
    answers: [],
    startTime: 0,
    endTime: 0,
    hintUsed: false,
    answered: false
  };

  function startQuiz(questionsOverride) {
    const questions = questionsOverride || generateQuizQuestions(wordbook, dictionary);
    if (questions.length < 3) {
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
    renderQuizQuestion();
  }

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
    container.innerHTML = `
      <div class="sq-header">
        <a href="wordbook.html" class="sq-back-btn" id="sqBackBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>${t('spellingQuizBack')}</span>
        </a>
        <div class="sq-header-right">
          <div class="sq-progress-text">${t('spellingQuizProgress').replace('$1', current).replace('$2', total)}</div>
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
        ${q.english.length > 0 ? `<div class="sq-definition">${q.english.map(d => escapeHtml(d)).join(' · ')}</div>` : ''}
        
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

  function bindQuestionEvents(q) {
    const input = document.getElementById('sqInput');
    const confirmBtn = document.getElementById('sqConfirmBtn');
    const skipBtn = document.getElementById('sqSkipBtn');
    const hintBtn = document.getElementById('sqHintBtn');
    const themeBtn = document.getElementById('sqThemeToggle');
    const sentenceSpeakBtn = document.getElementById('sqSentenceSpeakBtn');
    const wordSpeakBtn = document.getElementById('sqWordSpeakBtn');

    // Attach Web IME to input and fixed bottom-left toggle
    if (ime) {
      ime.attach(input, document.getElementById('sqImeBottomToggle'));
    }

    setTimeout(() => input.focus(), 80);

    // 防止點擊任何非文本輸入按鈕奪走輸入框焦點
    [sentenceSpeakBtn, wordSpeakBtn, hintBtn, themeBtn, skipBtn, confirmBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault(); // 阻止瀏覽器預設的按鈕奪焦行為
        });
      }
    });

    // Auto-read the sentence on question load
    setTimeout(() => playTts(q.sentence, sentenceSpeakBtn), 200);

    // 1. 句子朗讀按鈕
    if (sentenceSpeakBtn) {
      sentenceSpeakBtn.addEventListener('click', () => {
        playTts(q.sentence, sentenceSpeakBtn);
        if (input) input.focus();
      });
    }

    // 2. 單詞朗讀按鈕 (只朗讀填空的目標單詞)
    if (wordSpeakBtn) {
      wordSpeakBtn.addEventListener('click', () => {
        playTts(q.word, wordSpeakBtn);
        if (input) input.focus();
      });
    }

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

    confirmBtn.addEventListener('click', () => {
      if (quizState.answered) {
        goToNextQuestion();
      } else {
        checkCurrentAnswer();
      }
      if (input) input.focus();
    });

    skipBtn.addEventListener('click', () => {
      if (quizState.answered) {
        goToNextQuestion();
      } else {
        quizState.answers.push({ input: '', correct: false, skipped: true, question: q });
        showFeedback(false, true);
      }
      if (input) input.focus();
    });

    hintBtn.addEventListener('click', () => {
      quizState.hintUsed = true;
      const jp = q.jyutping;
      const parts = jp.split(' ');
      let hint = parts.map((p, i) => i === 0 ? p : p.charAt(0) + '___').join(' ');
      const hintArea = document.getElementById('sqHintArea');
      hintArea.innerHTML = `<div class="sq-hint-text"><span class="sq-hint-label">${t('spellingQuizHint')}:</span> ${escapeHtml(hint)}</div>`;
      if (input) input.focus();
    });

    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  }

  function formatBlankedSentence(blanked) {
    const match = blanked.match(/\x00BLANK(\d+)\x00/);
    if (!match) return `<span>${escapeHtml(blanked)}</span>`;
    const charCount = parseInt(match[1], 10);
    const parts = blanked.split(match[0]);
    const lines = '\uFF3F'.repeat(charCount);
    return `<span>${escapeHtml(parts[0])}</span><span class="sq-blank">${lines}</span><span>${escapeHtml(parts.slice(1).join(''))}</span>`;
  }

  function formatFilledSentence(blanked, filledWord, isCorrect) {
    const match = blanked.match(/\x00BLANK(\d+)\x00/);
    if (!match) return `<span>${escapeHtml(blanked)}</span>`;
    const parts = blanked.split(match[0]);
    const cls = isCorrect ? 'sq-filled-word is-correct' : 'sq-filled-word is-wrong';
    return `<span>${escapeHtml(parts[0])}</span><span class="${cls}">${escapeHtml(filledWord)}</span><span>${escapeHtml(parts.slice(1).join(''))}</span>`;
  }

  function checkCurrentAnswer() {
    const input = document.getElementById('sqInput');
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
    skipBtn.style.display = 'none';

    // 1. 直接在上方的原句填空處填入相應的單詞
    if (sentenceEl) {
      sentenceEl.innerHTML = formatFilledSentence(q.blankedSentence, q.traditional, isCorrect);
    }

    // 2. 答對時：停留 1.2 秒讓用戶清晰看到反饋與填入內容，隨後平滑自動翻題
    if (isCorrect) {
      card.classList.add('sq-correct');
      if (input) input.classList.add('sq-input-correct');
      confirmBtn.style.display = 'none';
      feedback.innerHTML = `
        <div class="sq-feedback-correct">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>${t('spellingQuizCorrect')}</span>
        </div>
      `;
      feedback.style.display = 'block';

      quizState.autoAdvanceTimer = setTimeout(() => {
        if (quizState.answered) goToNextQuestion();
      }, 1200);
    } else {
      // 3. 答錯/跳過時：保留時間讓用戶查看正確答案與拼音，顯示手動「下一題」按鈕
      card.classList.add('sq-wrong');
      if (!isSkipped && input) input.classList.add('sq-input-wrong');
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

      feedback.innerHTML = `
        <div class="sq-feedback-wrong">
          <span>${isSkipped ? '' : '✗ '}${t('spellingQuizWrong')}: <strong>${escapeHtml(q.traditional)}</strong></span>
          <span class="sq-feedback-jyutping">${escapeHtml(q.jyutping)}</span>
        </div>
      `;
      feedback.style.display = 'block';
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

    const container = document.getElementById('sqContainer');
    container.innerHTML = `
      <div class="sq-header">
        <a href="wordbook.html" class="sq-back-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>${t('spellingQuizBack')}</span>
        </a>
        <div class="sq-header-right">
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
          <a href="wordbook.html" class="sq-action-btn sq-back-to-wb-btn">${t('spellingQuizBack')}</a>
        </div>
      </div>

      ${answers.length > 0 ? `
        <div class="sq-review-section">
          <h3 class="sq-review-title">${t('spellingQuizReviewTitle')}</h3>
          <div class="sq-review-list">
            ${answers.map((a, i) => `
              <div class="sq-review-item ${a.correct ? 'sq-review-correct' : 'sq-review-wrong'}">
                <div class="sq-review-num">${i + 1}</div>
                <div class="sq-review-body">
                  <div class="sq-review-word">${escapeHtml(a.question.traditional)} <span class="sq-review-jyutping">${escapeHtml(a.question.jyutping)}</span></div>
                  <div class="sq-review-sentence-row">
                    <span class="sq-review-sentence">${escapeHtml(a.question.sentence)}</span>
                    <button class="sq-review-speak-btn" data-sentence="${escapeHtml(a.question.sentence)}" title="朗讀">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                      </svg>
                    </button>
                  </div>
                  ${!a.correct ? `<div class="sq-review-answer">${a.skipped ? `<span class="sq-review-skipped">${t('spellingQuizResultSkipped')}</span>` : `<span class="sq-review-user-answer">${escapeHtml(a.input)}</span> → <strong>${escapeHtml(a.question.traditional)}</strong>`}</div>` : ''}
                </div>
                <div class="sq-review-status">${a.correct ? '✓' : a.skipped ? '–' : '✗'}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Bind events
    document.getElementById('sqRetryBtn').addEventListener('click', () => startQuiz());
    const themeBtn = document.getElementById('sqThemeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
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
        const sentence = btn.getAttribute('data-sentence');
        if (sentence) playTts(sentence, btn);
      });
    });
  }

  function renderLoading() {
    const container = document.getElementById('sqContainer');
    container.innerHTML = `
      <div class="sq-header">
        <a href="wordbook.html" class="sq-back-btn">
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

  function renderEmpty() {
    const container = document.getElementById('sqContainer');
    container.innerHTML = `
      <div class="sq-header">
        <a href="wordbook.html" class="sq-back-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>${t('spellingQuizBack')}</span>
        </a>
        <div class="sq-header-right">
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
        <div class="sq-empty-desc">${t('spellingQuizNoWordsDetail')}</div>
        <a href="wordbook.html" class="sq-action-btn sq-back-to-wb-btn" style="margin-top: 12px;">${t('spellingQuizBack')}</a>
      </div>
    `;
    const themeBtn = document.getElementById('sqThemeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  }

  // ==================== Init ====================

  async function init() {
    initTheme();
    renderLoading();

    try {
      await loadData();
      startQuiz();
    } catch (e) {
      console.error('Failed to initialize spelling quiz', e);
      renderEmpty();
    }
  }

    init();

    // ==================== 全域輸入框焦點鎖定 ====================

    // 點擊頁面任意空白處、卡片背景時，始終維持輸入框聚焦
    document.addEventListener('click', (e) => {
      if (e.target.closest('.sq-back-btn') || e.target.closest('a')) return;
      const input = document.getElementById('sqInput');
      if (input && document.activeElement !== input) {
        input.focus();
      }
    });

    // 鍵盤按下任意字符、數字、退格、Enter 時，即刻將焦點重定向回輸入框；答題後按 Enter 翻題
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        if (quizState.answered) {
          // 確保不是提交答案時的同一次回車事件冒泡
          if (Date.now() - (quizState.answeredAt || 0) > 300) {
            e.preventDefault();
            goToNextQuestion();
            return;
          }
        }
      }
      const input = document.getElementById('sqInput');
      if (input && document.activeElement !== input) {
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
          input.focus();
        }
      }
    });

  })();
