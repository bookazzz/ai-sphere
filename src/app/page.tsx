"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
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
import { setToken, clearToken, isAuthenticated, getMe, type ChatMessage } from '@/lib/api';

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem('ai_sphere_sessions');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(s: ChatSession[]) {
  localStorage.setItem('ai_sphere_sessions', JSON.stringify(s));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function loadCurrentSessionId(): string | null {
  try {
    return localStorage.getItem('ai_sphere_current_session');
  } catch { return null; }
}

function saveCurrentSessionId(id: string) {
  localStorage.setItem('ai_sphere_current_session', id);
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [vkAuthOpen, setVkAuthOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatActive, setChatActive] = useState(false);
  const [sending, setSending] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const sessionsRef = useRef<ChatSession[]>([]);
  sessionsRef.current = sessions;

  const currentSessionIdRef = useRef<string | null>(null);

  const [selectedModelId, setSelectedModelId] = useState('deepseek/deepseek-chat');
  const selectedModelIdRef = useRef(selectedModelId);
  selectedModelIdRef.current = selectedModelId;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const stored = loadSessions();
    setSessions(stored);
    sessionsRef.current = stored;

    const sessionId = loadCurrentSessionId();
    if (sessionId) {
      const session = stored.find(s => s.id === sessionId);
      if (session && session.messages.length > 0) {
        setMessages(session.messages);
        setChatActive(true);
        currentSessionIdRef.current = sessionId;
      }
    }
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const storedToken = isAuthenticated();
    console.log('[Auth] URL token:', token ? 'found' : 'none', '| localStorage token:', storedToken ? 'found' : 'none');
    
    if (token) {
      console.log('[Auth] Setting token from URL');
      setToken(token);
      window.history.replaceState({}, '', window.location.pathname);
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

  const handleSendMessage = useCallback(async (text: string, attachedFiles?: any[]) => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }

    const currentMessages = messagesRef.current;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const updated = [...currentMessages, userMsg];
    setMessages(updated);
    setChatActive(true);
    setSending(true);

    try {
      const { sendMessage } = await import('@/lib/api');
      const resp = await sendMessage(selectedModelIdRef.current, updated);
      const assistantMsg: ChatMessage = { role: 'assistant', content: resp.content };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('[Chat] Error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Ошибка: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  }, [isLoggedIn]);

  const handleNewChat = useCallback(() => {
    currentSessionIdRef.current = null;
    saveCurrentSessionId('');
    setMessages([]);
    setChatActive(true);
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    const session = sessionsRef.current.find(s => s.id === sessionId);
    if (session) {
      currentSessionIdRef.current = sessionId;
      saveCurrentSessionId(sessionId);
      setMessages(session.messages);
      setChatActive(true);
      if (isMobile) setSidebarOpen(false);
    }
  }, [isMobile]);

  // Auto-save session after messages change
  useEffect(() => {
    if (messages.length === 0) return;

    const id = currentSessionIdRef.current;
    const now = Date.now();
    const title = messages[0]?.content?.slice(0, 60) || 'Новый чат';

    setSessions(prev => {
      let updated: ChatSession[];
      if (id && prev.some(s => s.id === id)) {
        updated = prev.map(s =>
          s.id === id ? { ...s, messages, title, updatedAt: now } : s
        );
      } else {
        const newSession: ChatSession = {
          id: generateId(),
          title,
          messages,
          createdAt: now,
          updatedAt: now,
        };
        currentSessionIdRef.current = newSession.id;
        saveCurrentSessionId(newSession.id);
        updated = [...prev, newSession];
      }
      saveSessions(updated);
      return updated;
    });
  }, [messages]);

  const handleOpenPricing = useCallback(() => {
    // TODO: open pricing
  }, []);

  const handleUpdateModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    selectedModelIdRef.current = modelId;
  }, []);

  const handleDeleteChat = useCallback(() => {
    currentSessionIdRef.current = null;
    saveCurrentSessionId('');
    setMessages([]);
    setChatActive(false);
  }, []);

  const handleShareChat = useCallback(() => {
    const text = messagesRef.current.map(m => `${m.role === 'user' ? 'Я' : 'AI'}: ${m.content}`).join('\n\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  // Mobile: content full-width, sidebar as overlay
  const contentClass = isMobile
    ? 'content content--fullwidth'
    : `content ${sidebarOpen ? '' : 'content--sidebar-collapsed'}`;

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        isMobile={isMobile}
        isLoggedIn={isLoggedIn}
        userName={user?.name || user?.email}
        userCredits={user?.credits}
        sessions={sessions}
        currentSessionId={currentSessionIdRef.current}
        onToggle={toggleSidebar}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
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
          messages={messages}
          sending={sending}
          chatActive={chatActive}
          onDeleteChat={handleDeleteChat}
          onShareChat={handleShareChat}
        />

        {!chatActive && (
          <>
            <DocumentsSection onSelect={handleSendMessage} />
            <FeaturesSection />
            <HowItWorksSection />
            <WhyUsSection />
            <ModelsGridSection />
            <FileSupportSection />
            <FAQSection />
            <CTASection onOpenAuth={toggleAuth} />
            <Footer />
          </>
        )}
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
