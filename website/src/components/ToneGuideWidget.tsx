'use client';

import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';

interface ToneItem {
  toneNum: number;
  toneName: string;
  contour: string;
  char: string;
  jyutping: string;
  pinyinType: string;
  desc: string;
  badgeClass: string;
}

const TONES_DATA: ToneItem[] = [
  { toneNum: 1, toneName: '陰平', contour: '55 / 53', char: '詩', jyutping: 'si1', pinyinType: '高平 / 高降', desc: '高而平直，如普通話第一聲', badgeClass: 'tone-badge-1' },
  { toneNum: 2, toneName: '陰上', contour: '35', char: '史', jyutping: 'si2', pinyinType: '中升', desc: '由中音升至高音，如普通話第二聲', badgeClass: 'tone-badge-2' },
  { toneNum: 3, toneName: '陰去', contour: '33', char: '試', jyutping: 'si3', pinyinType: '中平', desc: '平穩中音，不高不低', badgeClass: 'tone-badge-3' },
  { toneNum: 4, toneName: '陽平', contour: '21 / 11', char: '時', jyutping: 'si4', pinyinType: '低降 / 低平', desc: '深沉低沈，由中低降至極低', badgeClass: 'tone-badge-4' },
  { toneNum: 5, toneName: '陽上', contour: '13 / 23', char: '市', jyutping: 'si5', pinyinType: '低升', desc: '由極低音向上微揚', badgeClass: 'tone-badge-5' },
  { toneNum: 6, toneName: '陽去', contour: '22', char: '事', jyutping: 'si6', pinyinType: '低平', desc: '低而平穩，沈靜平直', badgeClass: 'tone-badge-6' },
  { toneNum: 7, toneName: '上陰入', contour: '5', char: '識', jyutping: 'sik1', pinyinType: '高促 (短)', desc: '入聲短促收尾，調值對應陰平', badgeClass: 'tone-badge-1' },
  { toneNum: 8, toneName: '下陰入', contour: '3', char: '錫', jyutping: 'sek3', pinyinType: '中促 (短)', desc: '入聲短促收尾，調值對應陰去', badgeClass: 'tone-badge-3' },
  { toneNum: 9, toneName: '陽入', contour: '2', char: '食', jyutping: 'sik6', pinyinType: '低促 (短)', desc: '入聲短促收尾，調值對應陽去', badgeClass: 'tone-badge-6' },
];

export const ToneGuideWidget: React.FC = () => {
  const [activeTone, setActiveTone] = useState<number>(1);
  const [playingTone, setPlayingTone] = useState<number | null>(null);

  const playToneSound = (char: string, toneNum: number) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(char);
      utterance.lang = 'zh-HK';
      utterance.rate = 0.85;
      setPlayingTone(toneNum);
      utterance.onend = () => setPlayingTone(null);
      utterance.onerror = () => setPlayingTone(null);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <section id="tones" className="py-16 md:py-24 bg-slate-50/70 dark:bg-[#151417] border-b border-slate-200/80 dark:border-[#2e2c33]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">
            粵語「九聲六調」互動對照表
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
            經典字例「詩、史、試、時、市、事、識、錫、食」。點擊任意聲調卡片即刻發音試聽。
          </p>
        </div>

        {/* Tone Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TONES_DATA.map((item) => {
            const isPlaying = playingTone === item.toneNum;
            const isSelected = activeTone === item.toneNum;

            return (
              <div
                key={item.toneNum}
                onClick={() => {
                  setActiveTone(item.toneNum);
                  playToneSound(item.char, item.toneNum);
                }}
                className={`rounded-xl p-4 border transition-all cursor-pointer bg-white dark:bg-[#1c1b1e] ${
                  isSelected
                    ? 'border-[#8A1C1C] dark:border-[#e05353] shadow-sm'
                    : 'border-slate-200 dark:border-[#2e2c33] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${item.badgeClass}`}>
                      第 {item.toneNum} 聲
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {item.toneName}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playToneSound(item.char, item.toneNum);
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      isPlaying
                        ? 'bg-[#8A1C1C] text-white'
                        : 'text-slate-400 hover:text-[#8A1C1C] hover:bg-rose-50 dark:hover:bg-[#271616]'
                    }`}
                    title="播放發音"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-baseline gap-2.5 mb-1.5">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {item.char}
                  </span>
                  <span className="font-mono text-xs font-semibold text-[#8A1C1C] dark:text-[#f87171]">
                    {item.jyutping}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    調值 {item.contour}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
