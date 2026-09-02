'use client';

import React, { useState } from 'react';
import { Volume2, ArrowRight, CheckCircle2, Bookmark } from 'lucide-react';
import { ChromeIcon } from './Icons';

export const HeroSection: React.FC = () => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const playDemoAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('得閒飲茶');
      utterance.lang = 'zh-HK';
      utterance.rate = 0.9;
      setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <section className="relative pt-12 pb-16 md:pt-16 md:pb-24 border-b border-slate-200/80 dark:border-[#2e2c33]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Version Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#fdf2f2] dark:bg-[#271616] border border-[#fecaca] dark:border-[#8A1C1C]/40 text-[#8A1C1C] dark:text-[#f87171] mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8A1C1C] dark:bg-[#f87171]" />
          <span>v1.5.8 現已發布：Google 官方真人粵語發音 ＆ Words.hk 權威收錄</span>
        </div>

        {/* Main H1 Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-5 leading-tight">
          網頁上的專業粵語懸浮詞典
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
          瀏覽網頁時雙擊或劃詞，即顯標準<strong className="text-slate-900 dark:text-white font-semibold">九聲六調粵拼</strong>與英中雙語釋義。權威收錄 Words.hk 粵典與 CC-Canto 雙詞庫，支持多引擎真發音、生詞本與 AI 語境解析。
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
          <a
            href="https://chromewebstore.google.com/detail/jyutping-hover-dictionary/nkghannminfkihhnkebcjhodfcoamkkm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#8A1C1C] hover:bg-[#B42929] shadow-sm active:scale-95 transition-all"
          >
            <ChromeIcon className="w-4 h-4 text-white" />
            <span>免費安裝 Chrome 擴展</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <a
            href="#live-demo"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-lg bg-white dark:bg-[#1c1b1e] border border-slate-300 dark:border-[#333138] hover:bg-slate-50 dark:hover:bg-[#262529] shadow-sm active:scale-95 transition-all"
          >
            <span>在線劃詞體驗</span>
          </a>
        </div>

        {/* 1:1 Authentic Browser Mockup & Popup */}
        <div className="relative max-w-xl mx-auto text-left">
          {/* Simulated Browser Card */}
          <div className="rounded-xl border border-slate-200 dark:border-[#2e2c33] bg-white dark:bg-[#1c1b1e] p-6 shadow-md">
            {/* Top Browser Bar */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-[#2e2c33] text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
                <span className="ml-2 font-mono text-[11px] text-slate-400">粵語維基百科示例</span>
              </div>
              <span className="text-[11px] text-[#8A1C1C] dark:text-[#f87171] font-medium">
                詞典已就緒
              </span>
            </div>

            {/* Simulated paragraph text */}
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base mb-5">
              廣東人好重視「飲茶」文化，朋友見面或者聚會，經常會講一句：
              <span className="inline-block font-semibold text-slate-900 dark:text-white bg-[#fef9c3] dark:bg-amber-950/60 px-1 py-0.2 rounded border border-[#fde047] dark:border-amber-700/60">
                得閒飲茶
              </span>
              ，意思係有空嗰陣一齊去茶樓飲茶傾偈。
            </p>

            {/* Authentic 1:1 Jyutping Popup (Matching popup.css) */}
            <div className="rounded-lg border border-slate-300 dark:border-[#333138] bg-white dark:bg-[#1c1b1e] p-4 shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    得閒飲茶
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-slate-100 dark:bg-[#262529] text-slate-600 dark:text-slate-300">
                    常用語
                  </span>
                </div>
                <button
                  onClick={playDemoAudio}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                    isPlayingAudio
                      ? 'bg-[#8A1C1C] text-white'
                      : 'bg-slate-100 dark:bg-[#262529] text-[#8A1C1C] dark:text-[#f87171] hover:bg-[#8A1C1C] hover:text-white'
                  }`}
                  title="點擊朗讀"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isPlayingAudio ? '朗讀中...' : '粵語發音'}</span>
                </button>
              </div>

              {/* Jyutping & Yale */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs bg-slate-50 dark:bg-[#121214] p-2 rounded border border-slate-100 dark:border-[#2e2c33]">
                <span className="text-slate-400 font-medium">粵拼:</span>
                <span className="font-mono font-semibold tone-badge-1 px-1.5 py-0.2 rounded text-xs">dak1</span>
                <span className="font-mono font-semibold tone-badge-4 px-1.5 py-0.2 rounded text-xs">haan4</span>
                <span className="font-mono font-semibold tone-badge-2 px-1.5 py-0.2 rounded text-xs">jam2</span>
                <span className="font-mono font-semibold tone-badge-4 px-1.5 py-0.2 rounded text-xs">caa4</span>
                <span className="text-slate-300 dark:text-slate-600 mx-1">|</span>
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">Yale: dāk hàahn yám chàh</span>
              </div>

              {/* Definition */}
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <div className="flex items-start gap-1.5">
                  <span className="text-[11px] font-bold text-[#b8860b] dark:text-[#fbbf24] shrink-0">[粵]</span>
                  <p className="leading-normal">有空時一起喝茶（常作客套話或聚會約定）。</p>
                </div>
                <p className="text-[11px] text-slate-400 pl-5">Let&apos;s have tea together when you&apos;re free.</p>
              </div>

              {/* Footer info */}
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-[#2e2c33] flex items-center justify-between text-[11px] text-slate-400">
                <span>Words.hk 粵典權威收錄</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> 可一鍵加入生詞本
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
