"use client";

import { useState, useCallback, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import ChatSection from '@/components/ChatSection';
import DocumentsSection from '@/components/DocumentsSection';
import FeaturesSection from '@/components/FeaturesSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import WhyUsSection from '@/components/WhyUsSection';
import ModelsGridSection from '@/components/ModelsGridSection';
import FileSupportSection from '@/components/FileSupportSection';
import FAQSection from '@/components/FAQSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [isLoggedIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const toggleAuth = useCallback(() => setAuthOpen(prev => !prev), []);

  const contentClass = isMobile
    ? 'content content--fullwidth'
    : `content ${sidebarOpen ? '' : 'content--sidebar-collapsed'}`;

  const handleSendMessage = useCallback((text: string) => {
    if (!isLoggedIn) {
      setAuthOpen(true);
    }
  }, [isLoggedIn]);

  const handleNewChat = useCallback(() => {
    // TODO: create new chat
  }, []);

  const handleOpenPricing = useCallback(() => {
    // TODO: open pricing
  }, []);

  const handleUpdateModel = useCallback((modelId: string) => {
    // TODO: update model
  }, []);

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        isLoggedIn={isLoggedIn}
        isMobile={isMobile}
        onToggle={toggleSidebar}
        onNewChat={handleNewChat}
        onOpenAuth={toggleAuth}
        onOpenPricing={handleOpenPricing}
      />

      <div className={`sidebar-overlay ${(isMobile && sidebarOpen) ? 'sidebar-overlay--visible' : ''}`} onClick={toggleSidebar} />

      <div className={contentClass}>
        <ChatSection
          sidebarOpen={sidebarOpen}
          isMobile={isMobile}
          onSendMessage={handleSendMessage}
          onOpenAuth={toggleAuth}
          onToggleSidebar={toggleSidebar}
          onUpdateModel={handleUpdateModel}
        />

        <DocumentsSection onSelect={handleSendMessage} />
        <FeaturesSection />
        <HowItWorksSection />
        <WhyUsSection />
        <ModelsGridSection />
        <FileSupportSection />
        <FAQSection />
        <CTASection onOpenAuth={toggleAuth} />
        <Footer />
      </div>

      <AuthModal isOpen={authOpen} onClose={toggleAuth} />
    </>
  );
}
