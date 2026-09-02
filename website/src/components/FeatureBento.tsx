'use client';

import React from 'react';
import { BookOpen, Volume2, Palette, GraduationCap, Bot } from 'lucide-react';

export const FeatureBento: React.FC = () => {
  return (
    <section id="features" className="py-16 md:py-24 border-b border-slate-200/80 dark:border-[#2e2c33]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">
            核心特色功能
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
            為粵語學習者與閱讀者量身定制的專業工具集。
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Words.hk 權威粵典 (Col-span 2) */}
          <div className="md:col-span-2 bg-white dark:bg-[#1c1b1e] rounded-xl border border-slate-200 dark:border-[#2e2c33] p-6 shadow-sm hover:border-[#8A1C1C]/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#fdf2f2] dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] flex items-center justify-center border border-[#fecaca] dark:border-[#8A1C1C]/40">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Words.hk 粵典 ＆ CC-Canto 雙詞庫</h3>
                <span className="text-xs text-slate-500">權威收錄超 53,000+ 地道詞條</span>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
              深度整合香港 Words.hk（粵典）權威資料庫與 CC-Canto、CC-CEDICT 綜合詞庫，精確區分口語、書面語與俚語，提供地道英中雙語解釋與生動例句。
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#262529] text-slate-700 dark:text-slate-300">
                📚 40,000+ 釋義擴充
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#262529] text-slate-700 dark:text-slate-300">
                🔥 12,900+ 純粵語俚語
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#262529] text-slate-700 dark:text-slate-300">
                🌏 英中雙語對照
              </span>
            </div>
          </div>

          {/* Card 2: 多引擎真發音 */}
          <div className="bg-white dark:bg-[#1c1b1e] rounded-xl border border-slate-200 dark:border-[#2e2c33] p-6 shadow-sm hover:border-[#8A1C1C]/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#fdf2f2] dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] flex items-center justify-center border border-[#fecaca] dark:border-[#8A1C1C]/40">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">多引擎真人發音</h3>
                <span className="text-xs text-slate-500">立體多重語音容災</span>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
              支持 Google 官方真人粵語 TTS、Edge TTS 高清人聲與本機離線系統音，支持無極變速與字音連讀。
            </p>
            <span className="inline-block text-[11px] font-semibold text-[#8A1C1C] dark:text-[#f87171] bg-rose-50 dark:bg-[#271616] px-2 py-0.5 rounded border border-rose-200 dark:border-[#8A1C1C]/30">
              全新接入 Google 官方粵語 TTS
            </span>
          </div>

          {/* Card 3: 九聲六調色彩拆解 */}
          <div className="bg-white dark:bg-[#1c1b1e] rounded-xl border border-slate-200 dark:border-[#2e2c33] p-6 shadow-sm hover:border-[#8A1C1C]/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#fdf2f2] dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] flex items-center justify-center border border-[#fecaca] dark:border-[#8A1C1C]/40">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">九聲六調色彩標註</h3>
                <span className="text-xs text-slate-500">聲母、韻母、調值拆解</span>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
              標準拆解聲韻母，配合 6 種經典聲調顏色標籤與 Yale 耶魯拼音對照，一眼看清調值高低。
            </p>
            <div className="flex gap-1 flex-wrap text-xs font-mono font-semibold">
              <span className="tone-badge-1 px-1.5 py-0.5 rounded">1 陰平</span>
              <span className="tone-badge-2 px-1.5 py-0.5 rounded">2 陰上</span>
              <span className="tone-badge-3 px-1.5 py-0.5 rounded">3 陰去</span>
              <span className="tone-badge-4 px-1.5 py-0.5 rounded">4 陽平</span>
              <span className="tone-badge-5 px-1.5 py-0.5 rounded">5 陽上</span>
              <span className="tone-badge-6 px-1.5 py-0.5 rounded">6 陽去</span>
            </div>
          </div>

          {/* Card 4: 生詞本與拼寫練習 */}
          <div className="bg-white dark:bg-[#1c1b1e] rounded-xl border border-slate-200 dark:border-[#2e2c33] p-6 shadow-sm hover:border-[#8A1C1C]/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#fdf2f2] dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] flex items-center justify-center border border-[#fecaca] dark:border-[#8A1C1C]/40">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">生詞本與拼寫填空</h3>
                <span className="text-xs text-slate-500">隨時收藏與復習鞏固</span>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
              一鍵收藏生詞，支持文件夾分組歸類、盲聽辨詞測試與粵拼填空拼寫練習，全方位鞏固生詞記憶。
            </p>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ✦ 拼寫填空測試模式已全面上線
            </span>
          </div>

          {/* Card 5: AI 智能翻譯與語境 */}
          <div className="bg-white dark:bg-[#1c1b1e] rounded-xl border border-slate-200 dark:border-[#2e2c33] p-6 shadow-sm hover:border-[#8A1C1C]/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#fdf2f2] dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] flex items-center justify-center border border-[#fecaca] dark:border-[#8A1C1C]/40">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">AI 智能語境翻譯</h3>
                <span className="text-xs text-slate-500">大模型深度解析倒裝句</span>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
              支持自定義 OpenAI / Claude / Gemini / DeepSeek 接口，深度解析複雜粵語俚語與語境文化內涵。
            </p>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ✦ 雙擊長句一鍵直譯
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
