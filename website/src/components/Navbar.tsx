'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { MessageSquare, Menu, X, User } from 'lucide-react';
import { GithubIcon } from './Icons';
import { ThemeToggle } from './ThemeToggle';

export interface TabItem {
  id: string;
  label: string;
}

export const TABS: TabItem[] = [
  { id: 'home', label: '首頁' },
  { id: 'roadmap', label: '學習導航' },
  { id: 'extension', label: '懸浮擴展' },
];

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  onOpenFeedback: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenFeedback,
  onOpenAuth,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-[#121214]/95 border-b border-slate-200 dark:border-[#2e2c33] backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Left: Classic Luxury Brand Logo & Typography */}
        <div
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-3 sm:gap-3.5 group cursor-pointer select-none py-1"
        >
          {currentTab !== 'extension' ? (
            <>
              {/* Pure Transparent Bauhinia Flower Logo */}
              <Image
                src="/logo-flower.svg"
                alt="Bauhinia Flower Logo"
                width={54}
                height={54}
                className="w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] shrink-0 transition-transform duration-300 ease-out group-hover:scale-105"
              />

              {/* Brand Typography */}
              <div className="flex items-center gap-2">
                {/* Large JYUT in Cinzel Serif */}
                <span
                  style={{ fontFamily: 'var(--font-cinzel), "Times New Roman", serif' }}
                  className="font-bold text-3xl sm:text-[34px] tracking-wide text-slate-900 dark:text-white leading-none"
                >
                  JYUT
                </span>

                {/* Right: Stacked .HK on top and 粵語學習空間 on bottom */}
                <div className="flex flex-col justify-center">
                  <span
                    style={{ fontFamily: 'var(--font-cinzel), "Times New Roman", serif' }}
                    className="font-bold text-sm sm:text-[15px] text-amber-500 dark:text-amber-400 leading-none tracking-wider"
                  >
                    .HK
                  </span>
                  <span className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 font-medium leading-none tracking-tight whitespace-nowrap pt-1.5">
                    粵語學習空間
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3.5">
              <Image
                src="/icon_15.png"
                alt="Extension Logo"
                width={48}
                height={48}
                className="w-12 h-12 rounded-xl shrink-0 shadow-xs group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col">
                <span className="font-bold text-xl sm:text-[22px] text-slate-900 dark:text-white leading-tight tracking-tight">
                  粵語懸浮詞典
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wider uppercase">
                  JYUTPING EXTENSION & PORTAL
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Clean Minimalist 2 Tabs (首頁 / 懸浮擴展) */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          {TABS.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`py-1 transition-colors cursor-pointer relative ${
                  isActive
                    ? 'text-[#8A1C1C] dark:text-[#f87171] font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#8A1C1C] dark:hover:text-[#e05353]'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8A1C1C] dark:bg-[#f87171] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Feedback Button */}
          <button
            onClick={onOpenFeedback}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1d21] transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
            title="意見反饋"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Light / Dark Mode Toggle */}
          <ThemeToggle />

          {/* GitHub Repo */}
          <a
            href="https://github.com/Ousinki/jyutping-extension"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1d21] transition-colors"
            title="GitHub 原始碼"
          >
            <GithubIcon className="w-4 h-4" />
          </a>

          {/* User Login/Account Button */}
          <button
            onClick={onOpenAuth}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg bg-[#8A1C1C] hover:bg-[#B42929] shadow-sm active:scale-95 transition-all cursor-pointer ml-1"
          >
            <User className="w-3.5 h-3.5" />
            <span>登入 / 註冊</span>
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex md:hidden items-center gap-1.5">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1d21]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-[#1c1b1e] border-b border-slate-200 dark:border-[#2e2c33] px-4 py-4 space-y-2 shadow-lg animate-fadeIn">
          {TABS.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  onSelectTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full px-3 py-2 text-sm font-medium rounded-lg text-left transition-colors ${
                  isActive
                    ? 'bg-[#fdf2f2] dark:bg-[#271616] text-[#8A1C1C] dark:text-[#f87171] font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#252429]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}

          <div className="pt-2 border-t border-slate-200 dark:border-[#2e2c33] flex items-center justify-between">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenFeedback();
              }}
              className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 py-1"
            >
              <MessageSquare className="w-3.5 h-3.5" /> 意見反饋
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth();
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#8A1C1C] text-white"
            >
              登入 / 註冊
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
