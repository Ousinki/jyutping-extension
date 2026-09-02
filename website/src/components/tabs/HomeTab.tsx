'use client';

import React, { useState } from 'react';
import { 
  Puzzle, 
  BookOpen, 
  GraduationCap, 
  Wrench, 
  Volume2, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Globe2, 
  Award,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { ChromeIcon, EdgeIcon } from '@/components/Icons';

interface HomeTabProps {
  onSelectTab: (tabId: string) => void;
}

const DAILY_WORDS = [
  { hanzi: '唔該', jyutping: 'm4 goi1', yale: 'm̀hgōi', def: '常用禮貌用語，表示「謝謝、勞駕、麻煩你」。', note: '日常最高頻口語詞之一' },
  { hanzi: '點解', jyutping: 'dim2 gaai2', yale: 'dímgáai', def: '疑問詞，相當於普通話的「為什麼、怎麼會」。', note: '港產影視最高頻台詞' },
  { hanzi: '行街', jyutping: 'haang4 gaai1', yale: 'hàahnggāai', def: '逛街、散步；亦可指在外購物休閒。', note: '生活必備詞彙' },
  { hanzi: '好睇', jyutping: 'hou2 tai2', yale: 'hóutái', def: '好看、精彩；形容電影、書籍或事物引人入勝。', note: '讚賞與評價用語' },
  { hanzi: '巴閉', jyutping: 'baa1 bai3', yale: 'bāabai', def: '形容人顯赫、了不起，或指人態度囂張、聲勢浩大。', note: '經典地道俚語' },
];

export const HomeTab: React.FC<HomeTabProps> = ({ onSelectTab }) => {
  const [selectedWordIdx, setSelectedWordIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeWord = DAILY_WORDS[selectedWordIdx];

  const playTTS = (text: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-HK';
      utter.rate = 0.9;
      setIsPlaying(true);
      utter.onend = () => setIsPlaying(false);
      utter.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utter);
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-20 py-8 sm:py-12">
      {/* 1. Portal Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#fdf2f2] dark:bg-[#271616] border border-[#fecaca] dark:border-[#8A1C1C]/40 text-[#8A1C1C] dark:text-[#f87171] mb-6 shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>jyut.hk · 專業粵語學習與數字生態門戶</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.2] mb-6">
          讓粵語學習更純粹 · 更地道
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
          匯聚 <span className="font-semibold text-slate-900 dark:text-white">Words.hk 權威粵典</span>、<span className="font-semibold text-slate-900 dark:text-white">瀏覽器懸浮查詞擴展</span>、<span className="font-semibold text-slate-900 dark:text-white">香港名師視聽課堂</span> 與實用拼音工具，助您無障礙融入粵語世界。
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 max-w-xl mx-auto">
          <button
            onClick={() => onSelectTab('extension')}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-xl bg-[#8A1C1C] hover:bg-[#B42929] shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Puzzle className="w-4 h-4" />
            <span>進入懸浮詞典擴展</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="https://chromewebstore.google.com/detail/jyutping-hover-dictionary/nkghannminfkihhnkebcjhodfcoamkkm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 rounded-xl bg-white dark:bg-[#1c1b1e] border border-slate-300 dark:border-[#333138] hover:bg-slate-50 dark:hover:bg-[#262529] shadow-sm active:scale-95 transition-all"
          >
            <ChromeIcon className="w-4 h-4" />
            <span>免費安裝 Chrome 擴展</span>
          </a>
        </div>
      </section>

      {/* 2. Interactive Spotlight: Daily Cantonese Word */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 dark:border-[#2e2c33] bg-white dark:bg-[#1c1b1e] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-[#2a282f]">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#8A1C1C] dark:text-[#f87171] uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>每日地道粵語精選</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                隨機探索高頻粵語詞彙與發音
              </h2>
            </div>

            {/* Word Chips */}
            <div className="flex flex-wrap gap-2">
              {DAILY_WORDS.map((w, idx) => (
                <button
                  key={w.hanzi}
                  onClick={() => setSelectedWordIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedWordIdx === idx
                      ? 'bg-[#8A1C1C] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-[#27262c] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {w.hanzi}
                </button>
              ))}
            </div>
          </div>

          {/* Active Word Card */}
          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white font-serif tracking-wide">
                  {activeWord.hanzi}
                </span>
                <span className="text-base sm:text-lg font-mono font-medium text-[#8A1C1C] dark:text-[#f87171]">
                  {activeWord.jyutping}
                </span>
                <span className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#252429] px-2 py-0.5 rounded">
                  Yale: {activeWord.yale}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                {activeWord.def}
              </p>
              <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                💡 {activeWord.note}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => playTTS(activeWord.hanzi)}
                disabled={isPlaying}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#fdf2f2] dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] border border-[#fecaca] dark:border-[#8A1C1C]/40 hover:bg-[#fee2e2] transition-colors cursor-pointer active:scale-95"
              >
                <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-bounce' : ''}`} />
                <span>真人發音試聽</span>
              </button>
              <button
                onClick={() => onSelectTab('extension')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#262529] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#323136] transition-colors cursor-pointer"
              >
                <span>在擴展中劃詞體驗</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Ecosystem Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">
            一站式粵語學習生態
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            以開源瀏覽器擴展為旗艦核心，未來將陸續聯動在線詞典與名師精品課。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pillar 1: Extension (Active Flagship) */}
          <div 
            onClick={() => onSelectTab('extension')}
            className="group rounded-2xl border-2 border-[#8A1C1C]/30 dark:border-[#8A1C1C]/40 bg-white dark:bg-[#1c1b1e] p-7 shadow-sm hover:border-[#8A1C1C] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#8A1C1C] dark:text-[#f87171] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Puzzle className="w-6 h-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#8A1C1C] dark:group-hover:text-[#f87171] transition-colors">
                  粵語懸浮詞典 (Browser Extension)
                </h3>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/30">
                  已上線 · Chrome / Edge
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                專為網頁閱讀設計的懸浮助手。雙擊或選中任何漢字即刻彈出發音與詳細粵典釋義，自帶生詞本與 AI 語境問答。
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8A1C1C] dark:text-[#f87171]">
              <span>進入擴展專屬頁面</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Pillar 2: Roadmap Learning Hub (Active) */}
          <div 
            onClick={() => onSelectTab('roadmap')}
            className="group rounded-2xl border-2 border-slate-200 dark:border-[#2e2c33] hover:border-[#8A1C1C] dark:hover:border-[#f87171] bg-white dark:bg-[#1c1b1e] p-7 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#8A1C1C] dark:group-hover:text-[#f87171] transition-colors">
                  粵語學習導航 (Learning Hub)
                </h3>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/30">
                  已上線 · 27+ 精選資源
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                精選香港中大、港教大、粵典、TypeDuck 等權威拼音教程、在線辭書、輸入法方案與聽讀語料。
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8A1C1C] dark:text-[#f87171]">
              <span>探索學習資源庫</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Pillar 3: Masterclasses & Video (Coming soon) */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#2e2c33] bg-white/70 dark:bg-[#1c1b1e]/70 p-7 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-5">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  名師專欄學堂 (Masterclasses)
                </h3>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-[#28272d] px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-[#35333a]">
                  籌備規劃中
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                攜手香港本土資深粵語導師與媒體人，提供零基礎發音、地道生活口語與商務粵語體系化視聽課程。
              </p>
            </div>
            <div className="text-xs text-slate-400 font-medium">
              ✨ 敬請期待後續版本開放
            </div>
          </div>

          {/* Pillar 4: Learning Tools (Coming soon) */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#2e2c33] bg-white/70 dark:bg-[#1c1b1e]/70 p-7 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-5">
                <Wrench className="w-6 h-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  粵拼學習工具箱 (Toolkit)
                </h3>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-[#28272d] px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-[#35333a]">
                  籌備規劃中
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                包含九聲六調聲調走勢互動盤、粵拼 ⇄ 耶魯拼音轉換器、多音字對照表與高頻粵語俗語歇後語庫。
              </p>
            </div>
            <div className="text-xs text-slate-400 font-medium">
              ✨ 敬請期待後續版本開放
            </div>
          </div>
        </div>
      </section>

      {/* 4. Quality & Open Ecosystem Values */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="rounded-2xl bg-slate-900 text-white p-8 sm:p-12 relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <Award className="w-4 h-4" /> 權威語料庫
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                嚴格收錄 Words.hk（粵典）與 CC-Canto 頂級開源詞典，釋義地道權威。
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <Volume2 className="w-4 h-4" /> 真人母語發音
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                集成 Google 官方真人母語粵語發音與單字多引擎降級保障，發音純正自然。
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4" /> 零追蹤 · 隱私安全
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                離線存儲優先，不收集任何個人瀏覽隱私，代碼完全透明開源。
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <Globe2 className="w-4 h-4" /> 國際多拼音支持
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                完整支持香港語言學學會粵拼 (Jyutping) 與海外廣泛使用的 Yale 耶魯拼音。
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
