'use client';

import React from 'react';
import { HeroSection } from '@/components/HeroSection';
import { LiveDemoWidget } from '@/components/LiveDemoWidget';
import { FeatureBento } from '@/components/FeatureBento';
import { ToneGuideWidget } from '@/components/ToneGuideWidget';
import { FaqSection } from '@/components/FaqSection';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { ChromeIcon, EdgeIcon } from '@/components/Icons';

export const ExtensionTab: React.FC = () => {
  return (
    <div className="animate-fadeIn space-y-0">
      {/* Extension Hero Section */}
      <HeroSection />

      {/* Live Interactive Playground */}
      <LiveDemoWidget />

      {/* Feature Bento Grid */}
      <FeatureBento />

      {/* Nine Tones Interactive Chart */}
      <ToneGuideWidget />

      {/* Installation Section */}
      <section id="install" className="py-16 md:py-24 border-b border-slate-200/80 dark:border-[#2e2c33]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="rounded-2xl border border-slate-200 dark:border-[#2e2c33] bg-white dark:bg-[#1c1b1e] p-8 sm:p-12 shadow-sm">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#fdf2f2] dark:bg-[#271616] border border-[#fecaca] dark:border-[#8A1C1C]/40 text-[#8A1C1C] dark:text-[#f87171] mb-4">
              <span>永久免費 · 開源無廣告 · 純本地離線運行</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">
              立即開啟母語級粵語閱讀體驗
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed">
              無需複雜配置，一鍵添加至瀏覽器，雙擊或劃詞即享權威粵典釋義與真人發音。
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 max-w-md mx-auto">
              <a
                href="https://chromewebstore.google.com/detail/jyutping-hover-dictionary/nkghannminfkihhnkebcjhodfcoamkkm"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#8A1C1C] hover:bg-[#B42929] shadow-sm active:scale-95 transition-all"
              >
                <ChromeIcon className="w-4 h-4" />
                <span>添加至 Chrome 瀏覽器</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://microsoftedge.microsoft.com/addons"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-lg bg-white dark:bg-[#1c1b1e] border border-slate-300 dark:border-[#333138] hover:bg-slate-50 dark:hover:bg-[#262529] shadow-sm active:scale-95 transition-all"
              >
                <EdgeIcon className="w-4 h-4" />
                <span>Edge 商店獲取</span>
              </a>
            </div>

            <div className="pt-6 mt-8 border-t border-slate-100 dark:border-[#2e2c33] flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 支持 Chrome / Edge / Brave / Arc
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 離線詞庫保障隱私安全
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 5 種系統語言自適應
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FaqSection />
    </div>
  );
};
