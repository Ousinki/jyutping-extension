'use client';

import React, { useState } from 'react';
import { Volume2, Search, Bookmark, Check, Info } from 'lucide-react';

interface WordData {
  word: string;
  jyutping: string[];
  yale: string;
  pos: string;
  defZh: string;
  defEn: string;
  tones: number[];
}

const DEMO_WORDS: Record<string, WordData> = {
  '好犀利': {
    word: '好犀利',
    jyutping: ['hou2', 'sai1', 'lei6'],
    tones: [2, 1, 6],
    yale: 'hóu sāi leih',
    pos: '形容詞',
    defZh: '非常厲害、出眾、強大。',
    defEn: 'Terrific, awesome, very powerful or impressive.',
  },
  '唔該': {
    word: '唔該',
    jyutping: ['m4', 'goi1'],
    tones: [4, 1],
    yale: 'm̀h gōi',
    pos: '常用語',
    defZh: '謝謝、勞駕、麻煩你（用於請求幫助或表示感謝）。',
    defEn: 'Please; thank you (for a service or favor); excuse me.',
  },
  '點解': {
    word: '點解',
    jyutping: ['dim2', 'gaai2'],
    tones: [2, 2],
    yale: 'dím gáai',
    pos: '疑問詞',
    defZh: '為什麼、怎麼回事。',
    defEn: 'Why; how come; for what reason.',
  },
  '食咗飯未': {
    word: '食咗飯未',
    jyutping: ['sik6', 'zo2', 'faan6', 'mei6'],
    tones: [6, 2, 6, 6],
    yale: 'sihk jó faahn meih',
    pos: '日常問候',
    defZh: '吃過飯了嗎？（廣東人最地道親切的日常問候語）。',
    defEn: 'Have you eaten yet? (Standard friendly Cantonese greeting).',
  },
  '搞掂': {
    word: '搞掂',
    jyutping: ['gaau2', 'dim2'],
    tones: [2, 2],
    yale: 'gáau dím',
    pos: '動詞',
    defZh: '辦妥、弄好、解決完畢。',
    defEn: 'All done, settled, completed successfully.',
  },
  '吹水': {
    word: '吹水',
    jyutping: ['ceoi1', 'seoi2'],
    tones: [1, 2],
    yale: 'chēui séui',
    pos: '動詞',
    defZh: '閒聊、侃大山、說空話。',
    defEn: 'To chat informally, gossip, shoot the breeze.',
  },
};

export const LiveDemoWidget: React.FC = () => {
  const [selectedWordKey, setSelectedWordKey] = useState<string>('好犀利');
  const [isPlaying, setIsPlaying] = useState(false);
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [customInput, setCustomInput] = useState('');

  const currentWord = DEMO_WORDS[selectedWordKey] || {
    word: selectedWordKey,
    jyutping: ['jyut6', 'jyu5'],
    tones: [6, 5],
    yale: 'yuht yúh',
    pos: '詞彙',
    defZh: '地道粵語詞彙查詢。',
    defEn: 'Cantonese colloquial dictionary lookup.',
  };

  const playAudio = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-HK';
      utterance.rate = 0.88;
      setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleBookmark = (w: string) => {
    setBookmarked((prev) => ({ ...prev, [w]: !prev[w] }));
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    if (DEMO_WORDS[customInput.trim()]) {
      setSelectedWordKey(customInput.trim());
    } else {
      DEMO_WORDS[customInput.trim()] = {
        word: customInput.trim(),
        jyutping: [customInput.trim()],
        tones: [1],
        yale: customInput.trim(),
        pos: '詞彙',
        defZh: `「${customInput.trim()}」的粵語字典收錄詞條。`,
        defEn: `Cantonese dictionary definition for "${customInput.trim()}".`,
      };
      setSelectedWordKey(customInput.trim());
    }
    setCustomInput('');
  };

  return (
    <section id="live-demo" className="py-16 md:py-20 bg-slate-50/70 dark:bg-[#151417] border-b border-slate-200/80 dark:border-[#2e2c33]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">
            在線劃詞交互體驗
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
            點擊段落中標記的詞語，或直接輸入任意粵語詞彙，即刻體驗懸浮窗查詞與發音。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Sample Text */}
          <div className="md:col-span-7 bg-white dark:bg-[#1c1b1e] rounded-xl border border-slate-200 dark:border-[#2e2c33] p-6 shadow-sm">
            <div className="flex items-center gap-1.5 pb-3 mb-4 border-b border-slate-100 dark:border-[#2e2c33] text-xs font-medium text-slate-500">
              <Info className="w-3.5 h-3.5 text-[#8A1C1C] dark:text-[#f87171]" />
              <span>點擊下方帶底色的詞彙進行查詢</span>
            </div>

            <div className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-loose space-y-3">
              <p>
                喺廣東同香港生活，最緊要學識幾句地道說話。
                遇到幫忙記得講聲{' '}
                <button
                  onClick={() => {
                    setSelectedWordKey('唔該');
                    playAudio('唔該');
                  }}
                  className={`font-semibold px-1.5 py-0.5 rounded text-sm transition-all cursor-pointer ${
                    selectedWordKey === '唔該'
                      ? 'bg-[#8A1C1C] text-white'
                      : 'bg-rose-50 dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] border border-rose-200 dark:border-[#8A1C1C]/50 hover:bg-[#8A1C1C] hover:text-white'
                  }`}
                >
                  唔該
                </button>
                ；見到朋友問句{' '}
                <button
                  onClick={() => {
                    setSelectedWordKey('食咗飯未');
                    playAudio('食咗飯未');
                  }}
                  className={`font-semibold px-1.5 py-0.5 rounded text-sm transition-all cursor-pointer ${
                    selectedWordKey === '食咗飯未'
                      ? 'bg-[#8A1C1C] text-white'
                      : 'bg-rose-50 dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] border border-rose-200 dark:border-[#8A1C1C]/50 hover:bg-[#8A1C1C] hover:text-white'
                  }`}
                >
                  食咗飯未
                </button>
                ，即刻拉近距離！
              </p>

              <p>
                如果有人做事做得好出色，你可以大讚佢{' '}
                <button
                  onClick={() => {
                    setSelectedWordKey('好犀利');
                    playAudio('好犀利');
                  }}
                  className={`font-semibold px-1.5 py-0.5 rounded text-sm transition-all cursor-pointer ${
                    selectedWordKey === '好犀利'
                      ? 'bg-[#8A1C1C] text-white'
                      : 'bg-rose-50 dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] border border-rose-200 dark:border-[#8A1C1C]/50 hover:bg-[#8A1C1C] hover:text-white'
                  }`}
                >
                  好犀利
                </button>
                ；事情辦妥咗就係{' '}
                <button
                  onClick={() => {
                    setSelectedWordKey('搞掂');
                    playAudio('搞掂');
                  }}
                  className={`font-semibold px-1.5 py-0.5 rounded text-sm transition-all cursor-pointer ${
                    selectedWordKey === '搞掂'
                      ? 'bg-[#8A1C1C] text-white'
                      : 'bg-rose-50 dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] border border-rose-200 dark:border-[#8A1C1C]/50 hover:bg-[#8A1C1C] hover:text-white'
                  }`}
                >
                  搞掂
                </button>
                。放工之後同同事去{' '}
                <button
                  onClick={() => {
                    setSelectedWordKey('吹水');
                    playAudio('吹水');
                  }}
                  className={`font-semibold px-1.5 py-0.5 rounded text-sm transition-all cursor-pointer ${
                    selectedWordKey === '吹水'
                      ? 'bg-[#8A1C1C] text-white'
                      : 'bg-rose-50 dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] border border-rose-200 dark:border-[#8A1C1C]/50 hover:bg-[#8A1C1C] hover:text-white'
                  }`}
                >
                  吹水
                </button>
                ，問佢{' '}
                <button
                  onClick={() => {
                    setSelectedWordKey('點解');
                    playAudio('點解');
                  }}
                  className={`font-semibold px-1.5 py-0.5 rounded text-sm transition-all cursor-pointer ${
                    selectedWordKey === '點解'
                      ? 'bg-[#8A1C1C] text-white'
                      : 'bg-rose-50 dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] border border-rose-200 dark:border-[#8A1C1C]/50 hover:bg-[#8A1C1C] hover:text-white'
                  }`}
                >
                  點解
                </button>
                咁開心！
              </p>
            </div>

            {/* Custom Input */}
            <form onSubmit={handleCustomSearch} className="mt-5 pt-4 border-t border-slate-100 dark:border-[#2e2c33] flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="輸入任意粵語詞彙（如：得閒、行街、買單）..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#333138] rounded-lg focus:outline-none focus:border-[#8A1C1C] text-slate-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#8A1C1C] hover:bg-[#B42929] rounded-lg cursor-pointer transition-colors shadow-sm"
              >
                查詢
              </button>
            </form>
          </div>

          {/* Right Column: Exact 1:1 Popup Card Result */}
          <div className="md:col-span-5">
            <div className="rounded-xl border border-slate-300 dark:border-[#333138] bg-white dark:bg-[#1c1b1e] p-4 shadow-md">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {currentWord.word}
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-slate-100 dark:bg-[#262529] text-slate-600 dark:text-slate-300">
                    {currentWord.pos}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleBookmark(currentWord.word)}
                    className={`p-1.5 rounded border transition-colors cursor-pointer ${
                      bookmarked[currentWord.word]
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-600'
                        : 'border-slate-200 dark:border-[#333138] text-slate-400 hover:text-slate-600'
                    }`}
                    title="收藏生詞"
                  >
                    {bookmarked[currentWord.word] ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => playAudio(currentWord.word)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      isPlaying
                        ? 'bg-[#8A1C1C] text-white'
                        : 'bg-slate-100 dark:bg-[#262529] text-[#8A1C1C] dark:text-[#f87171] hover:bg-[#8A1C1C] hover:text-white'
                    }`}
                    title="朗讀"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{isPlaying ? '朗讀中' : '發音'}</span>
                  </button>
                </div>
              </div>

              {/* Jyutping & Yale */}
              <div className="bg-slate-50 dark:bg-[#121214] p-2 rounded border border-slate-100 dark:border-[#2e2c33] mb-3">
                <div className="flex items-center gap-1 flex-wrap mb-1 text-xs">
                  <span className="text-slate-400 font-medium">粵拼:</span>
                  {currentWord.jyutping.map((jp, i) => {
                    const tone = currentWord.tones[i] || 1;
                    return (
                      <span key={i} className={`font-mono text-xs font-semibold tone-badge-${tone} px-1.5 py-0.2 rounded`}>
                        {jp}
                      </span>
                    );
                  })}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Yale: {currentWord.yale}</span>
                </div>
              </div>

              {/* Definition */}
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1 mb-3">
                <div className="flex items-start gap-1.5">
                  <span className="text-[11px] font-bold text-[#b8860b] dark:text-[#fbbf24] shrink-0">[粵]</span>
                  <p className="leading-normal">{currentWord.defZh}</p>
                </div>
                <p className="text-[11px] text-slate-400 pl-5">{currentWord.defEn}</p>
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#2e2c33] flex items-center justify-between text-[11px] text-slate-400">
                <span>Words.hk 權威詞庫</span>
                {bookmarked[currentWord.word] && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    ★ 已收錄至生詞本
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
