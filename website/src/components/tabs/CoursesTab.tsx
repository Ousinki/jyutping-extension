'use client';

import React, { useState } from 'react';
import { 
  GraduationCap, 
  Play, 
  Clock, 
  BookOpen, 
  Users, 
  Star, 
  Sparkles, 
  CheckCircle2, 
  Lock, 
  ChevronDown, 
  ChevronUp,
  Video,
  Award
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  subtitle: string;
  teacher: string;
  teacherTitle: string;
  teacherAvatar: string;
  level: '零基礎' | '初級進階' | '中高級實戰';
  duration: string;
  lessonsCount: number;
  studentsCount: number;
  rating: number;
  badge: string;
  description: string;
  chapters: { title: string; duration: string; isFree: boolean }[];
}

const COURSES_DATA: Course[] = [
  {
    id: 'phonetics-101',
    title: '零基礎粵語發音與九聲六調通關營',
    subtitle: '告別發音不準，掌握香港標準粵拼體系與聲調辨析技巧',
    teacher: '陳芷晴 老師',
    teacherTitle: '香港中文大學語言學碩士 · 10 年+ 粵語教學資歷',
    teacherAvatar: '👩‍🏫',
    level: '零基礎',
    duration: '6.5 小時',
    lessonsCount: 24,
    studentsCount: 3280,
    rating: 4.9,
    badge: '熱門入門',
    description: '從聲母、韻母、入聲字（-p, -t, -k）到九聲六調的音高走勢，通過科學口型示範與對比辨音，建立純正的粵語語音底層肌肉記憶。',
    chapters: [
      { title: '第 1 講：粵語語音總覽與粵拼 (Jyutping) 快速上手', duration: '15:20', isFree: true },
      { title: '第 2 講：九聲六調全景圖解：六個基本調值與音高走向', duration: '22:15', isFree: true },
      { title: '第 3 講：陰平、陰上、陰去（1/2/3聲）精準發音與對比練習', duration: '18:40', isFree: false },
      { title: '第 4 講：陽平、陽上、陽去（4/5/6聲）常見偏誤糾正', duration: '20:10', isFree: false },
      { title: '第 5 講：三個入聲調（陰入/中入/陽入）的塞音技巧', duration: '25:00', isFree: false },
      { title: '第 6 講：常見粵語變調現象與口語連讀規律', duration: '19:30', isFree: false },
    ],
  },
  {
    id: 'daily-colloquial',
    title: '地道港式生活口語與日常必備 500 句',
    subtitle: '拒絕書面腔，沉浸式掌握香港人每天都在用的高頻俚語與表達',
    teacher: '林子峰 導師',
    teacherTitle: '香港資深傳媒人 · 港劇台詞顧問與口語文化研習者',
    teacherAvatar: '👨‍💼',
    level: '初級進階',
    duration: '8.0 小時',
    lessonsCount: 30,
    studentsCount: 2150,
    rating: 4.95,
    badge: '口碑力薦',
    description: '涵蓋茶餐廳點餐、乘車出行、逛街購物、社交寒暄、情緒表達等全場景地道表達，傳授香港本土特有的語氣詞（啫/喇/咩/喎）微妙語感。',
    chapters: [
      { title: '第 1 講：茶餐廳文化實戰：點餐術語與黑話全解（例：走甜/反蛋）', duration: '18:00', isFree: true },
      { title: '第 2 講：社交寒暄必備：點解/唔該/麻煩晒的精準用法', duration: '21:30', isFree: true },
      { title: '第 3 講：香港交通與出行地道說法（搭車/轉線/過海）', duration: '16:45', isFree: false },
      { title: '第 4 講：購物與殺價：平靚正/度縮/找錢的情景表達', duration: '23:10', isFree: false },
      { title: '第 5 講：粵語靈魂語氣詞大解密：吖/啦/㗎/咩/喎/囉', duration: '26:50', isFree: false },
    ],
  },
  {
    id: 'business-cantonese',
    title: '大灣區商務粵語與職場溝通實戰',
    subtitle: '專為外企高管與跨界從業者打造，提升商務談判與職場交流效率',
    teacher: '黃嘉敏 顧問',
    teacherTitle: '前跨國諮詢機構合夥人 · 大灣區商務溝通認證培訓師',
    teacherAvatar: '👩‍💼',
    level: '中高級實戰',
    duration: '10.5 小時',
    lessonsCount: 36,
    studentsCount: 1420,
    rating: 4.88,
    badge: '職場首選',
    description: '聚焦商務會議發言、合約談判、職場溝通郵件、電話會議與商務宴請禮儀，掌握得體、專業且具親和力的商務粵語表達範式。',
    chapters: [
      { title: '第 1 講：商務自我介紹與商務破冰寒暄技巧', duration: '16:15', isFree: true },
      { title: '第 2 講：會議主持與觀點陳述：得體表達贊同與保留意見', duration: '24:00', isFree: false },
      { title: '第 3 講：商務電話與即時通訊溝通禮儀（粵語專業用詞）', duration: '22:30', isFree: false },
      { title: '第 4 講：價格談判與商業博弈的委婉措辭', duration: '28:10', isFree: false },
    ],
  },
];

export const CoursesTab: React.FC = () => {
  const [selectedCourseId, setSelectedCourseId] = useState('phonetics-101');
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  const currentCourse = COURSES_DATA.find((c) => c.id === selectedCourseId) || COURSES_DATA[0];

  return (
    <div className="animate-fadeIn max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* 1. Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30">
          <GraduationCap className="w-4 h-4 text-amber-600" />
          <span>香港名師親授 · 系統化視聽學習體系</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
          名師粵語視聽課堂
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          攜手香港本地語言學碩士與資深媒體人，為各階段學習者量身打造的進階視聽課程。
        </p>
      </div>

      {/* 2. Course Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {COURSES_DATA.map((course) => {
          const isSelected = course.id === selectedCourseId;
          return (
            <div
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              className={`rounded-2xl p-6 border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-white dark:bg-[#1c1b1e] border-[#8A1C1C] dark:border-[#8A1C1C] shadow-md ring-2 ring-[#8A1C1C]/15'
                  : 'bg-white/80 dark:bg-[#181719] border-slate-200 dark:border-[#2e2c33] hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/50 text-[#8A1C1C] dark:text-[#f87171] border border-red-200/50 dark:border-red-900/30">
                    {course.badge}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">{course.level}</span>
                </div>

                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                  {course.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {course.subtitle}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-[#2b2a30] flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="text-base">{course.teacherAvatar}</span>
                  <span>{course.teacher}</span>
                </div>
                <div className="flex items-center gap-1 text-amber-600 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{course.rating}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Active Course Detail & Video Player Mockup */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#2e2c33] bg-white dark:bg-[#1c1b1e] p-6 sm:p-8 shadow-sm space-y-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-between">
          {/* Left: Video Player Mockup */}
          <div className="w-full lg:w-7/12 space-y-4">
            <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner group">
              {/* Fake Video Preview Background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-[#382424] opacity-80" />
              
              <div className="relative z-10 text-center space-y-3 px-4">
                <div className="w-16 h-16 rounded-full bg-[#8A1C1C]/90 text-white flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 group-hover:bg-[#B42929] transition-transform cursor-pointer">
                  <Play className="w-7 h-7 fill-white translate-x-0.5" />
                </div>
                <div className="text-white font-semibold text-sm drop-shadow-sm">
                  免費試看：{currentCourse.chapters[0].title}
                </div>
                <div className="text-[11px] text-slate-400">
                  時長：{currentCourse.chapters[0].duration} · 點擊直接預覽體驗
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 pt-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 總時長 {currentCourse.duration}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> {currentCourse.lessonsCount} 節課
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {currentCourse.studentsCount} 位學員已加入
                </span>
              </div>
            </div>
          </div>

          {/* Right: Teacher Profile & Course Info */}
          <div className="w-full lg:w-5/12 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1 text-xs font-semibold text-[#8A1C1C] dark:text-[#f87171] mb-1">
                <Award className="w-3.5 h-3.5" /> 主講名師
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{currentCourse.teacherAvatar}</span>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {currentCourse.teacher}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {currentCourse.teacherTitle}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {currentCourse.description}
            </p>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#262529] border border-slate-100 dark:border-[#2e2c33] space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                ✨ 課程包含特權：
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 高清視頻隨時回放（支持手機/平板/電腦）
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 配套專屬講義 PDF 與逐課單詞音檔下載
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 專屬學習社群答疑與名師發音糾偏指導
                </li>
              </ul>
            </div>

            <button
              onClick={() => alert('帳號系統正在籌備升級中，即將開放正式預約！')}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#8A1C1C] hover:bg-[#B42929] shadow-sm active:scale-95 transition-all cursor-pointer text-center"
            >
              預約學習本課程（免費領取試聽講義）
            </button>
          </div>
        </div>

        {/* 4. Course Syllabus Accordion */}
        <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-[#2b2a30]">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">
            課程章節大綱 ({currentCourse.chapters.length} 講)
          </h3>

          <div className="divide-y divide-slate-100 dark:divide-[#2e2c33] border border-slate-200 dark:border-[#2e2c33] rounded-xl overflow-hidden bg-white dark:bg-[#181719]">
            {currentCourse.chapters.map((chap, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#201f23] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    chap.isFree ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-[#2b2a30] dark:text-slate-400'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {chap.title}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <span className="text-slate-400 font-mono">{chap.duration}</span>
                  {chap.isFree ? (
                    <span className="px-2 py-0.5 rounded font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/30 flex items-center gap-1">
                      <Play className="w-3 h-3 fill-emerald-600" /> 免費試看
                    </span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> 需解鎖
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
