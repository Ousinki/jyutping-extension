'use client';

import React from 'react';
import Image from 'next/image';
import { Heart, MessageSquare } from 'lucide-react';
import { GithubIcon } from './Icons';

interface FooterProps {
  onOpenFeedback: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenFeedback }) => {
  return (
    <footer className="bg-white dark:bg-[#121214] border-t border-slate-200 dark:border-[#2e2c33] text-slate-600 dark:text-slate-400 text-xs sm:text-sm py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Col 1: Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5 select-none">
              <Image src="/logo-flower.svg" alt="Bauhinia Flower Logo" width={32} height={32} className="shrink-0" />
              <div className="flex items-baseline gap-1">
                <span
                  style={{ fontFamily: 'var(--font-cinzel), "Times New Roman", serif' }}
                  className="font-bold text-xl tracking-wide text-slate-900 dark:text-white leading-none"
                >
                  JYUT
                </span>
                <span
                  style={{ fontFamily: 'var(--font-cinzel), "Times New Roman", serif' }}
                  className="font-bold text-xl tracking-wide text-amber-500 dark:text-amber-400 leading-none"
                >
                  HK
                </span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 leading-none tracking-tight">
                  粵語學習
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              專為粵語學習與閱讀打造的現代瀏覽器懸浮詞典。權威收錄 Words.hk 粵典與 CC-Canto 詞庫，支持 Google 官方真人粵語發音、九聲六調色彩拆解、生詞本與 AI 語境解析。
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href="https://github.com/Ousinki/jyutping-extension"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#1c1b1e] hover:bg-slate-200 transition-colors"
                title="GitHub"
              >
                <GithubIcon className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={onOpenFeedback}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-[#1c1b1e] text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                <span>意見反饋</span>
              </button>
            </div>
          </div>

          {/* Col 2: Navigation & Tools */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
              產品導航
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#features" className="hover:text-[#8A1C1C] dark:hover:text-[#f87171] transition-colors">
                  特色功能
                </a>
              </li>
              <li>
                <a href="#live-demo" className="hover:text-[#8A1C1C] dark:hover:text-[#f87171] transition-colors">
                  在線體驗
                </a>
              </li>
              <li>
                <a href="#tones" className="hover:text-[#8A1C1C] dark:hover:text-[#f87171] transition-colors">
                  九聲六調表
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-[#8A1C1C] dark:hover:text-[#f87171] transition-colors">
                  常見問題
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Data Sources & Credits */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
              開源致謝
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://words.hk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#8A1C1C] dark:hover:text-[#f87171] transition-colors"
                >
                  Words.hk (粵典)
                </a>
              </li>
              <li>
                <a
                  href="https://cc-canto.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#8A1C1C] dark:hover:text-[#f87171] transition-colors"
                >
                  CC-Canto 詞庫
                </a>
              </li>
              <li>
                <a
                  href="https://cc-cedict.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#8A1C1C] dark:hover:text-[#f87171] transition-colors"
                >
                  CC-CEDICT
                </a>
              </li>
              <li>
                <a
                  href="https://words.hk/base/hoifong/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#8A1C1C] dark:hover:text-[#f87171] transition-colors"
                >
                  Words.hk 開放資料協議
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 border-t border-slate-100 dark:border-[#2e2c33] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Jyutping Extension (粵語懸浮詞典). All rights reserved.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-[#8A1C1C] fill-[#8A1C1C]" /> for Cantonese learners & readers.
          </p>
        </div>
      </div>
    </footer>
  );
};
