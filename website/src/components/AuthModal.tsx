'use client';

import React, { useState } from 'react';
import { X, Mail, Lock, Sparkles, CheckCircle2, User } from 'lucide-react';
import { GithubIcon } from './Icons';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login for preview
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-[#1c1b1e] border border-slate-200 dark:border-[#2e2c33] rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#28272d] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#8A1C1C] dark:text-[#f87171] flex items-center justify-center mx-auto mb-2">
            <User className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {mode === 'login' ? '登入 jyut.hk 粵語學堂' : '註冊新學員帳號'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            解鎖名師視頻課程、雲端同步生詞本與學習打卡進度
          </p>
        </div>

        {/* Success Alert */}
        {isSuccess ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              登入成功！正在進入學習空間...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                電子郵件 (Email)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#181719] border border-slate-300 dark:border-[#333138] text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8A1C1C]/30"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                密碼 (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#181719] border border-slate-300 dark:border-[#333138] text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8A1C1C]/30"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-[#8A1C1C] hover:bg-[#B42929] shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              {mode === 'login' ? '立即登入' : '完成註冊'}
            </button>

            {/* Toggle Mode */}
            <div className="text-center text-xs text-slate-500 pt-1">
              {mode === 'login' ? (
                <span>
                  還沒有帳號？{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-[#8A1C1C] dark:text-[#f87171] font-semibold hover:underline cursor-pointer"
                  >
                    立即免費註冊
                  </button>
                </span>
              ) : (
                <span>
                  已有學員帳號？{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-[#8A1C1C] dark:text-[#f87171] font-semibold hover:underline cursor-pointer"
                  >
                    返回直接登入
                  </button>
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
