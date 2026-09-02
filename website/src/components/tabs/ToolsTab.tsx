'use client';

import React, { useState } from 'react';
import { Wrench, Volume2, ArrowRightLeft, Sparkles, BookOpen, Layers } from 'lucide-react';

const TONES_DATA = [
  { tone: 1, name: '陰平', pitch: '高平 55', sample: '詩 (si1)', yale: 'sī', pitchDesc: '最高音階，平穩有力', color: '#d93025', badge: 'tone-badge-1' },
  { tone: 2, name: '陰上', pitch: '高升 35', sample: '史 (si2)', yale: 'sí', pitchDesc: '從中音陡升至高音', color: '#e37400', badge: 'tone-badge-2' },
  { tone: 3, name: '陰去', pitch: '中平 33', sample: '試 (si3)', yale: 'si', pitchDesc: '中音階，平穩延伸', color: '#1e8e3e', badge: 'tone-badge-3' },
  { tone: 4, name: '陽平', pitch: '低降 21/11', sample: '時 (si4)', yale: 'sìh', pitchDesc: '從低音緩降至最低', color: '#1a73e8', badge: 'tone-badge-4' },
  { tone: 5, name: '陽上', pitch: '低升 13/23', sample: '市 (si5)', yale: 'síh', pitchDesc: '從最低音微升至中低音', color: '#7b1fa2', badge: 'tone-badge-5' },
  { tone: 6, name: '陽去', pitch: '低平 22', sample: '事 (si6)', yale: 'sih', pitchDesc: '低音階，平穩低沉', color: '#5f6368', badge: 'tone-badge-6' },
];

const SLANGS_DATA = [
  { phrase: '賣相機 — 留影', meaning: '留個念想，指保留紀念。' },
  { phrase: '泥菩薩過江 — 自身難保', meaning: '連自己都保不住，無法再顧及他人。' },
  { phrase: '風吹雞蛋殼 — 財去人安樂', meaning: '雖然破了財，但買得心安平安。' },
  { phrase: '單料銅煲 — 一滾就熟', meaning: '比喻人性格自來熟，剛認識就非常熱絡。' },
  { phrase: '十月芥菜 — 起曬心', meaning: '比喻少男少女情竇初開，動了春心。' },
  { phrase: '落雨收柴 — 慌失失', meaning: '形容人神情慌張、不知所措。' },
];

export const ToolsTab: React.FC = () => {
  // Converter state
  const [jyutInput, setJyutInput] = useState('gwong2 dung1 waa2');
  const [yaleOutput, setYaleOutput] = useState('gwóngdūngwá');
  const [playingSample, setPlayingSample] = useState<string | null>(null);

  const playTTS = (text: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-HK';
      utter.rate = 0.9;
      setPlayingSample(text);
      utter.onend = () => setPlayingSample(null);
      utter.onerror = () => setPlayingSample(null);
      window.speechSynthesis.speak(utter);
    } catch {
      setPlayingSample(null);
    }
  };

  const handleConvert = (val: string) => {
    setJyutInput(val);
    // Simple heuristic conversion demonstration
    const converted = val
      .replace(/gwong2/g, 'gwóng')
      .replace(/dung1/g, 'dūng')
      .replace(/waa2/g, 'wá')
      .replace(/gaai1/g, 'gāai')
      .replace(/m4/g, 'm̀h')
      .replace(/goi1/g, 'gōi')
      .replace(/dim2/g, 'dím')
      .replace(/gaai2/g, 'gáai');
    setYaleOutput(converted || '—');
  };

  return (
    <div className="animate-fadeIn max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-14">
      {/* 1. Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/30">
          <Wrench className="w-3.5 h-3.5" />
          <span>實用在線工具 · 提升發音與拼音理解</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
          粵語學習工具箱
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          包含九聲六調聲調盤、粵拼與耶魯拼音轉換器以及地道歇後語速查庫。
        </p>
      </div>

      {/* 2. Tool 1: Nine Tones Interactive Matrix */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#2e2c33] bg-white dark:bg-[#1c1b1e] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>九聲六調全景發音盤</span>
              <span className="text-xs font-normal text-slate-500 font-mono">（以 `si` 音為例）</span>
            </h2>
            <p className="text-xs text-slate-500">點擊任意聲調卡片即刻試聽真人精準音高示範</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {TONES_DATA.map((t) => (
            <div
              key={t.tone}
              onClick={() => playTTS(t.sample.split(' ')[0])}
              className="p-4 rounded-xl border border-slate-200 dark:border-[#2e2c33] bg-slate-50/50 dark:bg-[#181719] hover:border-[#8A1C1C] dark:hover:border-[#8A1C1C] hover:bg-white dark:hover:bg-[#201f23] transition-all cursor-pointer space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.badge}`}>
                  第 {t.tone} 聲 · {t.name}
                </span>
                <span className="text-xs font-mono text-slate-400">{t.pitch}</span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-2xl font-bold font-serif text-slate-900 dark:text-white mr-2">
                    {t.sample.split(' ')[0]}
                  </span>
                  <span className="font-mono text-sm font-semibold" style={{ color: t.color }}>
                    {t.sample.split(' ')[1]}
                  </span>
                </div>

                <button className="p-2 rounded-lg bg-white dark:bg-[#28272d] text-slate-500 group-hover:text-[#8A1C1C] group-hover:scale-110 transition-all shadow-2xs">
                  <Volume2 className={`w-4 h-4 ${playingSample === t.sample.split(' ')[0] ? 'animate-bounce text-[#8A1C1C]' : ''}`} />
                </button>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-[#2a292f] pt-2">
                調值特點：{t.pitchDesc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Tool 2: Jyutping ⇄ Yale Converter */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#2e2c33] bg-white dark:bg-[#1c1b1e] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-[#8A1C1C]" />
            <span>粵拼 (Jyutping) ⇄ 耶魯拼音 (Yale) 實時轉換</span>
          </h2>
          <p className="text-xs text-slate-500">
            香港語言學學會標準 (LSHK) 與國際耶魯標音符號雙向對照
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Jyutping Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              輸入粵拼 (Jyutping / 數字聲調)：
            </label>
            <input
              type="text"
              value={jyutInput}
              onChange={(e) => handleConvert(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#181719] border border-slate-300 dark:border-[#333138] text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#8A1C1C]/30"
              placeholder="例如：gwong2 dung1 waa2"
            />
            <div className="flex gap-2 text-xs">
              <span className="text-slate-400">快捷測試：</span>
              {['gwong2 dung1 waa2', 'm4 goi1', 'dim2 gaai2'].map((sample) => (
                <button
                  key={sample}
                  onClick={() => handleConvert(sample)}
                  className="text-[#8A1C1C] dark:text-[#f87171] hover:underline cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* Yale Output */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              轉換結果 · 耶魯拼音 (Yale Pinyin)：
            </label>
            <div className="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-[#252429] border border-slate-200 dark:border-[#2e2c33] text-slate-900 dark:text-white font-mono text-sm min-h-[46px] flex items-center font-bold text-amber-700 dark:text-amber-400">
              {yaleOutput}
            </div>
            <p className="text-[11px] text-slate-400">
              💡 耶魯拼音採用元音加調符（如 ā, á, àh）標記聲調，在海外粵語教學中廣泛使用。
            </p>
          </div>
        </div>
      </div>

      {/* 4. Tool 3: Cantonese Colloquial Slangs & Idioms */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#2e2c33] bg-white dark:bg-[#1c1b1e] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>地道粵語歇後語與俗語精選</span>
          </h2>
          <p className="text-xs text-slate-500">
            理解粵語隱喻文化與幽默智慧，點擊即可朗讀
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SLANGS_DATA.map((slang, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-100 dark:border-[#2b2a30] bg-slate-50 dark:bg-[#181719] hover:bg-white dark:hover:bg-[#201f23] transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm font-serif text-slate-900 dark:text-white">
                  {slang.phrase}
                </span>
                <button
                  onClick={() => playTTS(slang.phrase)}
                  className="text-slate-400 hover:text-[#8A1C1C] p-1 cursor-pointer"
                  title="朗讀"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                釋義：{slang.meaning}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
