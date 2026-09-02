'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_LIST: FaqItem[] = [
  {
    q: '粵語懸浮詞典是免費的嗎？需要付費訂閱嗎？',
    a: '本擴展完全免費、開源且無任何廣告！所有核心功能（Words.hk 權威詞庫、Google 官方真人粵語發音、Edge TTS、九聲六調色彩拆解、生詞本與拼寫練習）均永久免費開放使用。',
  },
  {
    q: '如何在網頁瀏覽中觸發查詞與發音？',
    a: '支持多種靈活觸發方式：① 鼠標劃詞選擇文本即可即時彈出；② 雙擊單字或詞語自動識別；③ 在設置中開啟「按住 Shift + 鼠標懸停」快速觸發，兼顧閱讀流暢度與查詞便捷性。',
  },
  {
    q: '支持哪些語音發音引擎？發音不清晰怎麼辦？',
    a: '擴展內置了三層立體發音引擎：① Google 官方真人粵語 TTS（發音純正自然）；② Edge TTS 高清人聲（可調節語速）；③ 系統本地 Web Speech 離線容災。在擴展設置頁中可自由切換默認發音引擎。',
  },
  {
    q: '擴展會收集或上傳我的網頁瀏覽隱私嗎？',
    a: '絕對不會！詞典數據庫（包含 240MB+ 詞條與字音）完全離線運行在您的瀏覽器本地，查詞完全在本地完成，絕不向任何第三方服務器上傳您的瀏覽歷史或敏感數據。',
  },
  {
    q: '如何使用 AI 智能翻譯與深度語境釋義？',
    a: '在設置頁面中填入您的 AI API Key（支持 OpenAI / Claude / Gemini / DeepSeek 等兼容接口），在查詞浮窗中點擊「AI」標誌即可一鍵獲取針對地道粵語倒裝句、俚語與文化內涵的深度解析。',
  },
  {
    q: '生詞本支持在不同設備上複習嗎？',
    a: '支持！在生詞本中可以按文件夾分類歸檔、進行聽音辨詞測試與拼寫填空測試。未來官網還將上線全端同步能力，方便您隨時隨地背詞鞏固。',
  },
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section id="faq" className="py-16 md:py-24 border-b border-slate-200/80 dark:border-[#2e2c33]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">
            常見問題解答
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            關於安裝、發音配置、快捷鍵與隱私保護的常見問題。
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_LIST.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-xl border border-slate-200 dark:border-[#2e2c33] bg-white dark:bg-[#1c1b1e] overflow-hidden"
              >
                <button
                  onClick={() => toggle(index)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#8A1C1C] dark:text-[#f87171]' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-[#2e2c33] pt-3.5">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
