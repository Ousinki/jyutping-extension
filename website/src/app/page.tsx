'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { HomeTab } from '@/components/tabs/HomeTab';
import { ExtensionTab } from '@/components/tabs/ExtensionTab';
import { RoadmapTab } from '@/components/tabs/RoadmapTab';
import { Footer } from '@/components/Footer';
import { FeedbackModal } from '@/components/FeedbackModal';
import { AuthModal } from '@/components/AuthModal';

export default function Home() {
  const [currentTab, setCurrentTab] = useState<'home' | 'extension' | 'roadmap'>('home');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    // Read hash on mount (e.g. #extension, #roadmap)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (['home', 'extension', 'roadmap'].includes(hash)) {
        setCurrentTab(hash as 'home' | 'extension' | 'roadmap');
      }
    }
  }, []);

  const handleSelectTab = (tabId: string) => {
    const targetTab = (['home', 'extension', 'roadmap'].includes(tabId) ? tabId : 'home') as
      | 'home'
      | 'extension'
      | 'roadmap';
    setCurrentTab(targetTab);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `#${targetTab}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#121214] text-slate-900 dark:text-white">
      {/* Top Navbar with Home, Extension and Roadmap Tabs */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenFeedback={() => setFeedbackOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
      />

      <main className="flex-1">
        {currentTab === 'home' && <HomeTab onSelectTab={handleSelectTab} />}
        {currentTab === 'extension' && <ExtensionTab />}
        {currentTab === 'roadmap' && <RoadmapTab onOpenFeedback={() => setFeedbackOpen(true)} />}
      </main>

      {/* Persistent Footer */}
      <Footer onOpenFeedback={() => setFeedbackOpen(true)} />

      {/* Self-Hosted Multi-Image Feedback Modal */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* User Login & Register Modal */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
