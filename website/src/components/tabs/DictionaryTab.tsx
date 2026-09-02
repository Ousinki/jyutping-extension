'use client';

import React, { useState } from 'react';
import { Search, Volume2, BookOpen, Bookmark, Sparkles, Filter } from 'lucide-react';

interface DictEntry {
  hanzi: string;
  jyutping: string;
  yale: string;
  pos: string;
  tones: number[];
  def: string;
  en: string;
  exampleZh: string;
  exampleYue: string;
  source: 'words.hk' | 'cc-canto';
}

const SAMPLE_ENTRIES: DictEntry[] = [
  {
    hanzi: '唔該',
    jyutping: 'm4 goi1',
    yale: 'm̀hgōi',
    pos: '歎詞 / 禮貌語',
    tones: [4, 1],
    def: '常用客氣話，表示感謝（接受別人小幫助時）或勞駕、麻煩別人借光。',
    en: 'Thank you (for small favors); Excuse me; Please.',
    exampleZh: '唔該借借，我想過一過。',
    exampleYue: '勞駕讓一下，我想走過去。',
    source: 'words.hk',
  },
  {
    hanzi: '點解',
    jyutping: 'dim2 gaai2',
    yale: 'dímgáai',
    pos: '疑問代詞',
    tones: [2, 2],
    def: '詢問原因或緣由，相當於普通話的「為什麼、怎麼會」。',
    en: 'Why; How come.',
    exampleZh: '你今日點解咁遲先返到嚟？',
    exampleYue: '你今天為什麼這麼晚才回來？',
    source: 'words.hk',
  },
  {
    hanzi: '行街',
    jyutping: 'haang4 gaai1',
    yale: 'hàahnggāai',
    pos: '動詞',
    tones: [4, 1],
    def: '在街上散步或購物；亦可泛指外出休閒遊逛。',
    en: 'To go window shopping; to stroll on the streets.',
    exampleZh: '聽日放假，我哋一齊去銅鑼灣行街囉。',
    exampleYue: '明天放假，我們一起去銅鑼灣逛街吧。',
    source: 'words.hk',
  },
  {
    hanzi: '巴閉',
    jyutping: 'baa1 bai3',
    yale: 'bāabai',
    pos: '形容詞',
    tones: [1, 3],
    def: '① 形容人顯赫、有威勢；② 形容人態度囂張跋扈、擺架子；③ 形容聲勢浩大喧鬧。',
    en: 'Proud; haughty; ostentatious; loud and bustling.',
    exampleZh: '有咩咁巴閉啫，咪又係靠屋企人。',
    exampleYue: '有什麼好神氣的，還不是靠家裡人。',
    source: 'words.hk',
  },
  {
    hanzi: '好睇',
    jyutping: 'hou2 tai2',
    yale: 'hóutái',
    pos: '形容詞',
    tones: [2, 2],
    def: '形容書籍、影視作品精彩吸引人，或指人/事物美觀好看。',
    en: 'Good-looking; enjoyable to watch or read; fascinating.',
    exampleZh: '尋晚嗰套港產片真係好好睇！',
    exampleYue: '昨晚那部港產電影真的非常好看！',
    source: 'words.hk',
  },
  {
    hanzi: '埋單',
    jyutping: 'maai4 daan1',
    yale: 'màahndāan',
    pos: '動詞',
    tones: [4, 1],
    def: '在餐廳或商店結帳、付款算帳。現亦引申指為某種結果承擔責任。',
    en: 'To pay the bill; to settle the account at a restaurant.',
    exampleZh: '夥計，呢張枱埋單唔該！',
    exampleYue: '服務員，這桌結帳，謝謝！',
    source: 'words.hk',
  },
  {
    hanzi: '拍拖',
    jyutping: 'paak3 to1',
    yale: 'paaktō',
    pos: '動詞',
    tones: [3, 1],
    def: '男女戀愛、談戀愛或約會。源於舊時珠江上小拖船依附大輪船航行之稱。',
    en: 'To date; to be in a romantic relationship.',
    exampleZh: '佢哋兩個人拍咗拖好多年啦。',
    exampleYue: '他們兩個人談戀愛很多年了。',
    source: 'words.hk',
  },
  {
    hanzi: '屋企',
    jyutping: 'uk1 kei2',
    yale: 'ūkkéi',
    pos: '名詞',
    tones: [1, 2],
    def: '家、住宅；亦指家庭或家裡的人。',
    en: 'Home; family; house.',
    exampleZh: '我收工即刻返屋企食飯。',
    exampleYue: '我下班馬上回家吃晚飯。',
    source: 'words.hk',
  }
];

const TONE_CLASSES: Record<number, string> = {
  1: 'tone-badge-1',
  2: 'tone-badge-2',
  3: 'tone-badge-3',
  4: 'tone-badge-4',
  5: 'tone-badge-5',
  6: 'tone-badge-6',
};

export const DictionaryTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeSourceFilter, setActiveSourceFilter] = useState<'all' | 'wordshk'>('all');
  const [playingWord, setPlayingWord] = useState<string | null>(null);

  const filteredEntries = SAMPLE_ENTRIES.filter(e => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      e.hanzi.includes(q) ||
      e.jyutping.toLowerCase().includes(q) ||
      e.yale.toLowerCase().includes(q) ||
      e.def.toLowerCase().includes(q) ||
      e.en.toLowerCase().includes(q)
    );
  });

  const playTTS = (text: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-HK';
      utter.rate = 0.9;
      setPlayingWord(text);
      utter.onend = () => setPlayingWord(null);
      utter.onerror = () => setPlayingWord(null);
      window.speechSynthesis.speak(utter);
    } catch {
      setPlayingWord(null);
    }
  };

  return (
    <div className="animate-fadeIn max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Search Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#fdf2f2] dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] border border-[#fecaca] dark:border-[#8A1C1C]/40">
          <BookOpen className="w-3.5 h-3.5" />
          <span>權威收錄 Words.hk 粵典 · 23 萬+ 詞條在線檢索</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
          在線粵語詞典檢索
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          支持直接輸入漢字、粵拼 (如 `m4 goi1`)、耶魯拼音或英文釋義進行全庫檢索。
        </p>
      </div>

      {/* Search Input Box */}
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="輸入漢字、粵拼（如 dim2 gaai2）、耶魯拼音或英語釋義..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white dark:bg-[#1c1b1e] border border-slate-300 dark:border-[#333138] text-slate-900 dark:text-white placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8A1C1C]/30 focus:border-[#8A1C1C] text-sm sm:text-base transition-all"
          />
        </div>

        {/* Hot Quick Search Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
          <span className="font-medium">熱門詞彙：</span>
          {['唔該', '點解', '行街', '巴閉', '好睇', '埋單', '拍拖', '屋企'].map((hot) => (
            <button
              key={hot}
              onClick={() => setQuery(hot)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1c1b1e] border border-slate-200 dark:border-[#2e2c33] text-slate-700 dark:text-slate-300 hover:border-[#8A1C1C] hover:text-[#8A1C1C] transition-colors cursor-pointer"
            >
              {hot}
            </button>
          ))}
        </div>
      </div>

      {/* Search Results List */}
      <div className="max-w-3xl mx-auto space-y-4 pt-4">
        <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200 dark:border-[#2e2c33]">
          <span>找到 {filteredEntries.length} 個相關詞條</span>
          <span className="flex items-center gap-1 text-[#b8860b] dark:text-amber-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" /> 粵典 Words.hk 權威語料
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#1c1b1e] rounded-2xl border border-slate-200 dark:border-[#2e2c33] p-8 space-y-3">
            <p className="text-slate-500 text-sm">未找到與「{query}」完全匹配的詞條</p>
            <p className="text-xs text-slate-400">您可以嘗試輸入拼音（如 `dim2 gaai2`）或簡化關鍵詞重新檢索。</p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.hanzi}
              className="rounded-2xl border border-slate-200 dark:border-[#2e2c33] bg-white dark:bg-[#1c1b1e] p-6 shadow-sm hover:border-[#8A1C1C]/40 dark:hover:border-[#8A1C1C]/60 transition-all space-y-4"
            >
              {/* Header: Hanzi + Phonetics + TTS Button */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 dark:text-white tracking-wide">
                      {entry.hanzi}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#fdf2f2] dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] border border-[#fecaca] dark:border-[#8A1C1C]/30">
                      {entry.pos}
                    </span>
                    <span className="text-[11px] font-bold text-[#b8860b] dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/30">
                      [粵] Words.hk
                    </span>
                  </div>

                  {/* Phonetics & Tone Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                      <span>粵拼:</span>
                      <span className="text-[#8A1C1C] dark:text-[#f87171]">{entry.jyutping}</span>
                    </div>

                    <div className="flex items-center gap-1 pl-2">
                      {entry.tones.map((t, i) => (
                        <span key={i} className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${TONE_CLASSES[t] || ''}`}>
                          {t}聲
                        </span>
                      ))}
                    </div>

                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500 pl-2">
                      Yale: {entry.yale}
                    </span>
                  </div>
                </div>

                {/* Pronunciation Button */}
                <button
                  onClick={() => playTTS(entry.hanzi)}
                  className="p-2.5 rounded-xl bg-[#fdf2f2] dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] border border-[#fecaca] dark:border-[#8A1C1C]/40 hover:bg-[#fee2e2] transition-colors cursor-pointer shrink-0 active:scale-95"
                  title="朗讀粵語發音"
                >
                  <Volume2 className={`w-5 h-5 ${playingWord === entry.hanzi ? 'animate-bounce' : ''}`} />
                </button>
              </div>

              {/* Definition */}
              <div className="space-y-2 text-sm">
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                  {entry.def}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  EN: {entry.en}
                </p>
              </div>

              {/* Example Sentence Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#262529] border border-slate-100 dark:border-[#2e2c33] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 font-serif">
                    💬 例句：{entry.exampleZh}
                  </span>
                  <button
                    onClick={() => playTTS(entry.exampleZh)}
                    className="text-slate-400 hover:text-[#8A1C1C] text-xs flex items-center gap-1 cursor-pointer"
                    title="朗讀例句"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> 聽例句
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  釋義：{entry.exampleYue}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
