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
import VkAuthOverlay from '@/components/VkAuthOverlay';
import { setToken, clearToken, isAuthenticated, getMe } from '@/lib/api';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [vkAuthOpen, setVkAuthOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Handle OAuth callback: extract token from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const storedToken = isAuthenticated();
    console.log('[Auth] URL token:', token ? 'found' : 'none', '| localStorage token:', storedToken ? 'found' : 'none');
    
    if (token) {
      console.log('[Auth] Setting token from URL');
      setToken(token);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Load user
      getMe().then((u) => {
        console.log('[Auth] getMe OK:', u);
        setUser(u);
        setIsLoggedIn(true);
      }).catch((err) => {
        console.log('[Auth] getMe FAIL:', err);
        clearToken();
      }).finally(() => setAuthLoading(false));
    } else if (storedToken) {
      console.log('[Auth] Found token in localStorage, fetching user...');
      getMe().then((u) => {
        console.log('[Auth] getMe OK:', u.email || u.name);
        setUser(u);
        setIsLoggedIn(true);
      }).catch((err) => {
        console.log('[Auth] getMe FAIL:', err.message, '— clearing token');
        clearToken();
      }).finally(() => setAuthLoading(false));
    } else {
      console.log('[Auth] No token found, showing login');
      setAuthLoading(false);
    }
  }, []);

  // Desktop: open sidebar by default
  useEffect(() => {
    if (!isMobile) setSidebarOpen(true);
  }, [isMobile]);

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const toggleAuth = useCallback(() => setAuthOpen(prev => !prev), []);

  const handleLogin = useCallback((userData: any) => {
    setUser(userData);
    setIsLoggedIn(true);
  }, []);

  const handleOpenVkAuth = useCallback(() => {
    setAuthOpen(false);
    setVkAuthOpen(true);
  }, []);

  const handleCloseVkAuth = useCallback(() => {
    setVkAuthOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
    setIsLoggedIn(false);
  }, []);

  // Mobile: content full-width, sidebar as overlay
  // Desktop: content has padding-left based on sidebar state
  const contentClass = isMobile
    ? 'content content--fullwidth'
    : `content ${sidebarOpen ? '' : 'content--sidebar-collapsed'}`;

  const handleSendMessage = useCallback((text: string, attachedFiles?: any[]) => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    console.log('[Chat] Send:', text, 'Files:', attachedFiles?.length || 0);
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
        isMobile={isMobile}
        isLoggedIn={isLoggedIn}
        userName={user?.name || user?.email}
        userCredits={user?.credits}
        onToggle={toggleSidebar}
        onNewChat={handleNewChat}
        onOpenAuth={toggleAuth}
        onOpenPricing={handleOpenPricing}
        onLogout={handleLogout}
      />

      {/* Overlay for mobile sidebar */}
      {isMobile && (
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'sidebar-overlay--visible' : ''}`}
          onClick={toggleSidebar}
        />
      )}

      <div className={contentClass}>
        <ChatSection
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          isLoggedIn={isLoggedIn}
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

      <AuthModal
        isOpen={authOpen}
        onClose={toggleAuth}
        onLogin={handleLogin}
        onOpenVkAuth={handleOpenVkAuth}
      />

      {vkAuthOpen && (
        <VkAuthOverlay
          onLogin={handleLogin}
          onClose={handleCloseVkAuth}
        />
      )}
    </>
  );
}
