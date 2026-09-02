'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  ExternalLink,
  Sparkles,
  Compass,
  BookOpen,
  Wrench,
  Keyboard,
  Headphones,
  Film,
  PlusCircle,
  Globe,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import {
  ROADMAP_RESOURCES,
  CATEGORIES,
  RoadmapResource,
  ResourceCategory,
} from '@/data/roadmapResources';

interface RoadmapTabProps {
  onOpenFeedback: () => void;
}

const getCategoryIcon = (category: 'all' | ResourceCategory) => {
  switch (category) {
    case 'phonetics':
      return <Sparkles className="w-3.5 h-3.5" />;
    case 'dictionary':
      return <BookOpen className="w-3.5 h-3.5" />;
    case 'tool':
      return <Wrench className="w-3.5 h-3.5" />;
    case 'input':
      return <Keyboard className="w-3.5 h-3.5" />;
    case 'reading':
      return <Headphones className="w-3.5 h-3.5" />;
    case 'media':
      return <Film className="w-3.5 h-3.5" />;
    default:
      return <Layers className="w-3.5 h-3.5" />;
  }
};

const getBadgeStyle = (category: ResourceCategory) => {
  switch (category) {
    case 'phonetics':
      return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40';
    case 'dictionary':
      return 'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40';
    case 'tool':
      return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40';
    case 'input':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40';
    case 'reading':
      return 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40';
    case 'media':
      return 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
};

const getCategoryLabel = (category: ResourceCategory) => {
  switch (category) {
    case 'phonetics':
      return '拼音入門';
    case 'dictionary':
      return '權威辭書';
    case 'tool':
      return '實用工具';
    case 'input':
      return '粵拼輸入';
    case 'reading':
      return '聽讀進階';
    case 'media':
      return '影視文化';
    default:
      return category;
  }
};

export const RoadmapTab: React.FC<RoadmapTabProps> = ({ onOpenFeedback }) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | ResourceCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  // Filter resources based on category and search query
  const filteredResources = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ROADMAP_RESOURCES.filter((item) => {
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      if (!matchCategory) return false;

      if (!query) return true;

      const titleHk = item.title['zh-HK'].toLowerCase();
      const titleCn = item.title['zh-CN'].toLowerCase();
      const titleEn = item.title.en.toLowerCase();
      const descHk = item.desc['zh-HK'].toLowerCase();
      const descCn = item.desc['zh-CN'].toLowerCase();
      const keywords = item.keywords.toLowerCase();
      const domain = item.domain.toLowerCase();

      return (
        titleHk.includes(query) ||
        titleCn.includes(query) ||
        titleEn.includes(query) ||
        descHk.includes(query) ||
        descCn.includes(query) ||
        keywords.includes(query) ||
        domain.includes(query)
      );
    });
  }, [selectedCategory, searchQuery]);

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ROADMAP_RESOURCES.length };
    ROADMAP_RESOURCES.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, []);

  const handleImageError = (id: string) => {
    setImageErrorMap((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="animate-fadeIn pb-20">
      {/* 1. Hero Header */}
      <section className="relative pt-12 pb-10 sm:pt-16 sm:pb-14 border-b border-slate-200/80 dark:border-[#2e2c33] bg-gradient-to-b from-white to-slate-50/50 dark:from-[#121214] dark:to-[#17161a]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#fdf2f2] dark:bg-[#271616] border border-[#fecaca] dark:border-[#8A1C1C]/40 text-[#8A1C1C] dark:text-[#f87171] mb-5 shadow-xs">
            <Compass className="w-3.5 h-3.5" />
            <span>精選開源與權威資源矩陣</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            粵語學習導航
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
            嚴選權威拼音教程、查詞辭書、輸入法與聽讀語料，助你系統掌握地道粵語。
          </p>

          {/* Search Box & Recommend Button */}
          <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋資源名稱、關鍵字、網站域名..."
                className="w-full pl-11 pr-10 py-3 rounded-full border border-slate-200 dark:border-[#333138] bg-white dark:bg-[#1c1b1e] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#8A1C1C]/20 dark:focus:ring-[#f87171]/20 focus:border-[#8A1C1C] dark:focus:border-[#f87171] shadow-xs transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={onOpenFeedback}
              className="shrink-0 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[#8A1C1C] dark:text-[#f87171] bg-[#fdf2f2] dark:bg-[#271616] hover:bg-[#fae6e6] dark:hover:bg-[#341b1b] border border-[#fecaca] dark:border-[#8A1C1C]/40 rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>推薦優質資源</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Filter Pills and Count */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-[#2e2c33]">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#8A1C1C] text-white shadow-sm dark:bg-[#8A1C1C]'
                      : 'bg-white dark:bg-[#1c1b1e] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#333138] hover:bg-slate-50 dark:hover:bg-[#252429] hover:border-slate-300'
                  }`}
                >
                  {getCategoryIcon(cat.id)}
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-[#2e2c33] text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Result Count */}
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
            共 <span className="font-bold text-slate-800 dark:text-slate-200">{filteredResources.length}</span> 個精選資源
          </div>
        </div>
      </section>

      {/* 3. Resource Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {filteredResources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredResources.map((item) => {
              const hasImgError = imageErrorMap[item.id];
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-[#1c1b1e] border border-slate-200/80 dark:border-[#2e2c33] hover:border-[#8A1C1C]/40 dark:hover:border-[#f87171]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div>
                    {/* Top Row: Icon, Title & Category Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-[#252429] border border-slate-100 dark:border-[#333138] p-2 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden shadow-2xs">
                          {!hasImgError ? (
                            <img
                              src={item.icon}
                              alt={item.title['zh-HK']}
                              className="w-full h-full object-contain"
                              onError={() => handleImageError(item.id)}
                            />
                          ) : (
                            <Globe className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white group-hover:text-[#8A1C1C] dark:group-hover:text-[#f87171] transition-colors leading-snug">
                            {item.title['zh-HK']}
                          </h3>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border shrink-0 ${getBadgeStyle(
                          item.category
                        )}`}
                      >
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 mb-4">
                      {item.desc['zh-HK']}
                    </p>
                  </div>

                  {/* Footer: Domain and Arrow */}
                  <div className="pt-3 border-t border-slate-100 dark:border-[#27252c] flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                    <span className="truncate max-w-[200px] font-mono text-[11px] group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                      {item.domain}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-slate-400 group-hover:text-[#8A1C1C] dark:group-hover:text-[#f87171] transition-colors font-medium text-[11px]">
                      <span>訪問</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="py-16 text-center bg-white dark:bg-[#1c1b1e] rounded-2xl border border-slate-200/80 dark:border-[#2e2c33] p-8 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#252429] flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              未找到匹配的學習資源
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              請嘗試使用其他關鍵字或切換分類篩選標籤
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#252429] hover:bg-slate-200 dark:hover:bg-[#2e2c33] rounded-lg transition-colors cursor-pointer"
              >
                重置篩選條件
              </button>
              <button
                onClick={onOpenFeedback}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#8A1C1C] hover:bg-[#B42929] rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                推薦此資源
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4. Bottom Community Banner */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
        <div className="rounded-2xl border border-slate-200/80 dark:border-[#2e2c33] bg-gradient-to-r from-[#fdf2f2] via-white to-slate-50 dark:from-[#211515] dark:via-[#1c1b1e] dark:to-[#171619] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
          <div className="text-center sm:text-left">
            <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center justify-center sm:justify-start gap-2">
              <Sparkles className="w-4 h-4 text-[#8A1C1C] dark:text-[#f87171]" />
              <span>發現了更多優質粵語學習站點？</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              歡迎分享你收藏的網站、辭書或工具，我們審核後將收錄進導航庫！
            </p>
          </div>

          <button
            onClick={onOpenFeedback}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white rounded-lg bg-[#8A1C1C] hover:bg-[#B42929] shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>提交資源推薦</span>
          </button>
        </div>
      </section>
    </div>
  );
};
