"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import ChatSection from '@/components/ChatSection';
import Sidebar from '@/components/Sidebar';
import AuthModal from '@/components/AuthModal';
import PromoModal from '@/components/PromoModal';
import PricingModal from '@/components/PricingModal';
import TicketModal from '@/components/TicketModal';
import DocumentsSection from '@/components/sections/DocumentsSection';
import FeaturesSection from '@/components/sections/FeaturesSection';
import HowItWorksSection from '@/components/sections/HowItWorksSection';
import WhyUsSection from '@/components/sections/WhyUsSection';
import ModelsGridSection from '@/components/sections/ModelsGridSection';
import FileSupportSection from '@/components/sections/FileSupportSection';
import FAQSection from '@/components/sections/FAQSection';
import CTASection from '@/components/sections/CTASection';
import Footer from '@/components/Footer';
import { getToken, clearToken, setToken, getMe, isAuthenticated, saveSession, deleteSessionApi } from '@/lib/api';
import { DEFAULT_MODEL_ID } from '@/lib/models-data';
import type { ChatMessage, ContentPart, EnsembleResponse } from '@/lib/api';

const SESSIONS_KEY = 'ai_sphere_sessions';

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
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(s));
}

async function syncSessionsFromServer(): Promise<ChatSession[]> {
  if (typeof window === 'undefined') return [];
  try {
    const { fetchSessions } = await import('@/lib/api');
    const server = await fetchSessions();
    if (!Array.isArray(server)) {
      return loadSessions();
    }
    const local = server.map(s => ({
      id: s.id,
      title: s.title,
      messages: s.messages as ChatMessage[],
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
      updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
    }));
    // Merge: server sessions + local-only sessions (don't overwrite)
    const stored = loadSessions();
    const serverIds = new Set(local.map(s => s.id));
    // Merge: keep newest by updatedAt when session exists in both
    const merged = [...local];
    for (const st of stored) {
      if (!serverIds.has(st.id)) {
        merged.push(st);
      } else {
        const srv = local.find(s => s.id === st.id)!;
        if (st.updatedAt > srv.updatedAt) {
          const idx = merged.findIndex(m => m.id === st.id);
          if (idx !== -1) merged[idx] = st;
        }
      }
    }
    saveSessions(merged);
    return merged;
  } catch {
    // fallback to localStorage
  }
  return loadSessions();
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
  const [showPricing, setShowPricing] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const [authLoading, setAuthLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatActive, setChatActive] = useState(false);
  const [sending, setSending] = useState(false);
  const [thinkingText, setThinkingText] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [chatSectionKey, setChatSectionKey] = useState(0);

  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const sessionsRef = useRef<ChatSession[]>([]);
  sessionsRef.current = sessions;

  const currentSessionIdRef = useRef<string | null>(null);

  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const selectedModelIdRef = useRef(selectedModelId);
  selectedModelIdRef.current = selectedModelId;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load sessions from server (or localStorage fallback) when authenticated
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasToken = !!localStorage.getItem('auth_token');
    if (!hasToken) return;
    syncSessionsFromServer().then(stored => {
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
    });
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
        // Load sessions from server after OAuth login
        syncSessionsFromServer().then(stored => {
          setSessions(stored);
          sessionsRef.current = stored;
        });
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
        // Load sessions from server after token validation
        syncSessionsFromServer().then(stored => {
          setSessions(stored);
          sessionsRef.current = stored;
        });
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
  const toggleAuth = useCallback(() => {
    setSidebarOpen(false);
    setAuthOpen(prev => !prev);
  }, [setSidebarOpen, setAuthOpen]);

  const handleLogin = useCallback((userData: any) => {
    setUser(userData);
    setIsLoggedIn(true);
    // Load user's sessions from server after login
    syncSessionsFromServer().then(stored => {
      setSessions(stored);
      sessionsRef.current = stored;
    });
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
    setIsLoggedIn(false);
    setMessages([]);
    setChatActive(false);
    setSessions([]);
    sessionsRef.current = [];
    currentSessionIdRef.current = null;
    saveCurrentSessionId('');
  }, []);

  const handleNewChat = useCallback(() => {
    // Save current session before clearing
    const msgs = messagesRef.current;
    const sid = currentSessionIdRef.current;
    if (sid && msgs.length > 0) {
      const firstContent = msgs[0]?.content;
      const title = typeof firstContent === 'string'
        ? firstContent.slice(0, 60)
        : 'Новый чат';
      setSessions(prev => prev.map(s =>
        s.id === sid ? { ...s, messages: msgs, title, updatedAt: Date.now() } : s
      ));
      saveSession(sid, title, msgs).catch(() => {});
    }
    currentSessionIdRef.current = null;
    saveCurrentSessionId('');
    setMessages([]);
    setChatActive(false);
    if (isMobile) setSidebarOpen(false);
    setChatSectionKey(k => k + 1);
  }, [isMobile, setSidebarOpen]);

  const handleSendMessage = useCallback(async (text: string, attachedFiles?: any[]) => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }

    const currentMessages = messagesRef.current;

    // Build user message: content array if files attached, string otherwise
    let userContent: string | ContentPart[];
    if (attachedFiles && attachedFiles.length > 0) {
      const imageParts: ContentPart[] = attachedFiles
        .filter((f: any) => f.dataUrl && f.dataUrl.startsWith('data:image/'))
        .map((f: any) => ({
          type: 'image_url',
          image_url: { url: f.dataUrl },
        }));
      userContent = [
        { type: 'text', text: text || '' },
        ...imageParts,
      ];
    } else {
      userContent = text;
    }

    const userMsg: ChatMessage = { role: 'user', content: userContent };
    const updated = [...currentMessages, userMsg];
    setMessages(updated);
    setChatActive(true);
    setSending(true);

    try {
      const { streamChat } = await import('@/lib/api');

      await streamChat(selectedModelIdRef.current, updated, {
        onToken: (token: string) => {
          setThinkingText(''); // очищаем thinking при первом контенте
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant') {
              copy[copy.length - 1] = { ...last, content: last.content + token };
            } else {
              copy.push({ role: 'assistant', content: token });
            }
            return copy;
          });
        },
        onDone: (creditsSpent: number) => {
          if (creditsSpent > 0 && userRef.current) {
            setUser({ ...userRef.current, credits: Math.max(0, userRef.current.credits - creditsSpent) });
          }
          setSending(false);
          setThinkingText(''); // очищаем при завершении (на случай если контента не было)
        },
        onThinking: (text: string) => {
          setThinkingText(text);
        },
      });
    } catch (err: any) {
      console.error('[Chat] Error:', err);
      // Replace empty placeholder with error message, or append if no placeholder
      setMessages(prev => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        if (lastIdx >= 0 && copy[lastIdx].role === 'assistant' && copy[lastIdx].content === '') {
          copy[lastIdx] = { role: 'assistant', content: `❌ Ошибка: ${err.message}` };
        } else {
          copy.push({ role: 'assistant', content: `❌ Ошибка: ${err.message}` });
        }
        return copy;
      });
      setSending(false);
    }
  }, [isLoggedIn]);

  const handleActivateChat = useCallback(() => {
    setChatActive(true);
  }, []);

  const handleEnsembleResult = useCallback((text: string, attachedFiles: any[] | undefined, result: EnsembleResponse) => {
    // Build user message (same format as handleSendMessage)
    let userContent: string | ContentPart[];
    if (attachedFiles && attachedFiles.length > 0) {
      const imageParts: ContentPart[] = attachedFiles
        .filter((f: any) => f.dataUrl && f.dataUrl.startsWith('data:image/'))
        .map((f: any) => ({
          type: 'image_url',
          image_url: { url: f.dataUrl },
        }));
      userContent = [
        { type: 'text', text: text || '' },
        ...imageParts,
      ];
    } else {
      userContent = text;
    }

    const userMsg: ChatMessage = { role: 'user', content: userContent };
    const newMessages: ChatMessage[] = [userMsg];

    // Consensus as the main assistant message
    newMessages.push({
      role: 'assistant',
      content: `🧠 **Консенсус 3-х моделей (${result.credits_spent} кр.)**\n\n${result.consensus}`,
    });

    // Each model response as a separate message
    for (const m of result.models) {
      if (m.content) {
        newMessages.push({
          role: 'assistant',
          content: `🤖 **${m.model_name}**\n\n${m.content}`,
        });
      } else {
        newMessages.push({
          role: 'assistant',
          content: `⚠️ **${m.model_name}** — ошибка: ${m.error || 'нет ответа'}`,
        });
      }
    }

    setMessages(prev => [...prev, ...newMessages]);
    setChatActive(true);
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    if (!isLoggedIn) {
      toggleAuth();
      return;
    }
    const session = sessionsRef.current.find(s => s.id === sessionId);
    if (session) {
      currentSessionIdRef.current = sessionId;
      saveCurrentSessionId(sessionId);
      setMessages(session.messages);
      setChatActive(true);
      if (isMobile) setSidebarOpen(false);
      }
      setChatSectionKey(k => k + 1);
      }, [isMobile, isLoggedIn, toggleAuth, setSidebarOpen]);

      // ─────── Session save logic (throttled, not debounced) ───────
  // During streaming tokens arrive every ~50-200ms.
  // A debounce would keep resetting and never fire until streaming stops.
  // Throttle saves at fixed intervals so partial responses persist on page reload.
  const lastSaveTimeRef = useRef(0);
  const saveThrottleMs = 1500; // max 1.5s between saves during streaming
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const doSave = useCallback((msgs: ChatMessage[]) => {
    const id = currentSessionIdRef.current;
    const now = Date.now();
    const firstContent = msgs[0]?.content;
    const title = typeof firstContent === 'string'
      ? firstContent.slice(0, 60)
      : (Array.isArray(firstContent)
        ? (firstContent.find(p => p.type === 'text')?.text || 'Новый чат').slice(0, 60)
        : 'Новый чат');

    setSessions(prev => {
      let updated: ChatSession[];
      let sessionId = id;
      if (id && prev.some(s => s.id === id)) {
        updated = prev.map(s =>
          s.id === id ? { ...s, messages: msgs, title, updatedAt: now } : s
        );
      } else {
        const newSession: ChatSession = {
          id: generateId(),
          title,
          messages: msgs,
          createdAt: now,
          updatedAt: now,
        };
        sessionId = newSession.id;
        currentSessionIdRef.current = newSession.id;
        saveCurrentSessionId(newSession.id);
        updated = [...prev, newSession];
      }
      saveSessions(updated);
      const sid = sessionId || '';
      const saveWithRetry = (retries = 2) => {
        saveSession(sid, title, msgs).catch((e: Error) => {
          console.warn(`[Sync] Failed (retries left=${retries}): ${e.message}`);
          if (retries > 0) {
            setTimeout(() => saveWithRetry(retries - 1), 1000);
          } else {
            console.error('[Sync] Failed to save session to server after retries:', e.message);
          }
        });
      };
      saveWithRetry();
      return updated;
    });
    lastSaveTimeRef.current = now;
  }, []);

  // Throttled auto-save: fires at fixed intervals regardless of token speed
  useEffect(() => {
    if (messages.length === 0) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    const elapsed = Date.now() - lastSaveTimeRef.current;
    if (elapsed >= saveThrottleMs) {
      doSave(messages);
    } else {
      // Schedule what's left of the throttle window to avoid tight loop
      saveTimeoutRef.current = setTimeout(() => doSave(messages), saveThrottleMs - elapsed);
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [messages, doSave]);

  // Force save when streaming ends (sending transitions true → false)
  const prevSendingRef = useRef(sending);
  useEffect(() => {
    const wasSending = prevSendingRef.current;
    prevSendingRef.current = sending;
    if (wasSending && !sending && messages.length > 0) {
      doSave(messages);
    }
  }, [sending, messages, doSave]);

  // Flush to localStorage on page unload (catches mid-stream refresh)
  useEffect(() => {
    const onUnload = () => {
      const msgs = messagesRef.current;
      if (msgs.length === 0) return;
      try {
        localStorage.setItem('ai_sphere_sessions_flush', JSON.stringify({
          messages: msgs,
          sessionId: currentSessionIdRef.current,
          timestamp: Date.now(),
        }));
      } catch { /* ignore quota errors */ }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // ─────── Cross-device session sync (polling every 3s) ───────
  useEffect(() => {
    if (!isLoggedIn || typeof window === 'undefined') return;

    const POLL_MS = 3000;
    let active = true;

    const poll = async () => {
      try {
        const { fetchSessions, saveSession } = await import('@/lib/api');
        const serverRaw = await fetchSessions();
        if (!serverRaw || !active) return;

        let sessionsToPush: ChatSession[] = [];

        setSessions(prev => {
          const serverMap = new Map<string, ChatSession>();
          for (const s of serverRaw) {
            serverMap.set(s.id, {
              id: s.id,
              title: s.title,
              messages: s.messages as ChatMessage[],
              createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
              updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
            });
          }

          // Merge: for sessions on both — keep newest by updatedAt
          const serverIds = new Set(serverMap.keys());
          sessionsToPush = [];
          const merged: ChatSession[] = [];

          // Start with server sessions
          for (const s of serverMap.values()) merged.push(s);

          // Merge in local sessions
          for (const local of prev) {
            if (!serverIds.has(local.id)) {
              // Local-only — keep and push to server
              merged.push(local);
              sessionsToPush.push(local);
            } else {
              // Exists on both — keep whichever is newer
              const srv = serverMap.get(local.id)!;
              if (local.updatedAt > srv.updatedAt) {
                // Local is newer — replace server entry
                const idx = merged.findIndex(m => m.id === local.id);
                if (idx !== -1) {
                  merged[idx] = local;
                  sessionsToPush.push(local);
                }
              }
            }
          }
          // Sort by updatedAt desc
          merged.sort((a, b) => b.updatedAt - a.updatedAt);

          // Skip re-render if nothing changed (by id + updatedAt)
          if (merged.length === prev.length &&
              merged.every((s, i) => s.id === prev[i].id && s.updatedAt === prev[i].updatedAt)) {
            return prev;
          }

          saveSessions(merged);

          // If the currently viewed session has new messages from another device, update the view
          const curId = currentSessionIdRef.current;
          if (curId) {
            const updated = serverMap.get(curId);
            if (updated) {
              const localSession = prev.find(s => s.id === curId);
              if (localSession && updated.messages.length > localSession.messages.length) {
                // Only auto-update if this device isn't currently sending
                if (!sending) {
                  setMessages(updated.messages);
                }
              }
            }
          }

          return merged;
        });

        // Push local/newer sessions to the server (catch save failures from previous sessions)
        for (const s of sessionsToPush) {
          const title = typeof s.messages[0]?.content === 'string'
            ? s.messages[0].content.slice(0, 60)
            : 'Новый чат';
          saveSession(s.id, title, s.messages).catch((e: Error) =>
            console.warn('[Sync] Failed to push local session to server:', e.message)
          );
        }
      } catch {
        // Polling errors are non-critical — ignore silently
      }
    };

    const intervalId = setInterval(poll, POLL_MS);
    return () => { active = false; clearInterval(intervalId); };
  }, [isLoggedIn, sending]);

  const handleOpenPricing = useCallback(() => {
    setShowPricing(true);
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

  const handleDeleteSession = useCallback((sessionId: string) => {
    // Delete from server (fire-and-forget)
    deleteSessionApi(sessionId).catch((e: Error) =>
      console.warn('[Sync] Failed to delete session on server:', e.message)
    );
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      saveSessions(updated);
      return updated;
    });
    if (currentSessionIdRef.current === sessionId) {
      currentSessionIdRef.current = null;
      saveCurrentSessionId('');
      setMessages([]);
      setChatActive(false);
    }
  }, []);

  const handleRenameSession = useCallback((sessionId: string, title: string) => {
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === sessionId ? { ...s, title, updatedAt: Date.now() } : s
      );
      saveSessions(updated);
      return updated;
    });
  }, []);

  // Mobile: content full-width, sidebar as overlay
  const contentClass = isMobile
    ? 'content content--fullwidth'
    : `content ${sidebarOpen ? '' : 'content--sidebar-collapsed'}`;

  return (
    <>
      {/* JSON-LD: главная страница — WebApplication */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'AI-Sphere',
            url: 'https://ai-sphere.ru',
            description: 'ИИ-чат с доступом к ChatGPT, Claude, Gemini, DeepSeek и другим моделям. Без VPN, с оплатой в рублях.',
            applicationCategory: 'AIApplication',
            operatingSystem: 'All',
            browserRequirements: 'JavaScript',
            offers: {
              '@type': 'Offer',
              price: '99',
              priceCurrency: 'RUB',
              priceValidUntil: '2027-12-31',
              availability: 'https://schema.org/InStock',
            },
          }),
        }}
      />
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
        onOpenPromo={() => { setPromoOpen(true); }}
        onOpenSupport={() => { setSupportOpen(true); }}
        onLogout={handleLogout}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
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
          key={chatSectionKey}
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          isLoggedIn={isLoggedIn}
          onSendMessage={handleSendMessage}
          onOpenAuth={toggleAuth}
          onToggleSidebar={toggleSidebar}
          onUpdateModel={handleUpdateModel}
          messages={messages}
          sending={sending}
          thinkingText={thinkingText}
          chatActive={chatActive}
          onDeleteChat={handleDeleteChat}
          onShareChat={handleShareChat}
          onEnsembleResult={handleEnsembleResult}
          onActivateChat={handleActivateChat}
          currentSessionId={currentSessionIdRef.current}
        />

        {!isLoggedIn && (
          <>
            <DocumentsSection onSelect={handleSendMessage} />
            <FeaturesSection />
            <HowItWorksSection />
            <WhyUsSection />
            <ModelsGridSection />
            <FileSupportSection />
            <FAQSection />
            <CTASection onOpenAuth={toggleAuth} />
          </>
        )}
        {!isLoggedIn && <Footer />}
      </div>

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        isLoggedIn={isLoggedIn}
        onTopUp={() => { setShowPricing(false); setAuthOpen(true); }}
        onSuccess={() => {
          // Refresh user data after payment
          getMe().then(u => setUser(u)).catch(() => {});
        }}
      />

      <AuthModal
        isOpen={authOpen}
        onClose={toggleAuth}
        onLogin={handleLogin}
      />

      <PromoModal
        isOpen={promoOpen}
        onClose={() => setPromoOpen(false)}
        onSuccess={(credits) => {
          getMe().then(u => setUser(u)).catch(() => {});
        }}
      />

      <TicketModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        onSuccess={() => {
          getMe().then(u => setUser(u)).catch(() => {});
        }}
      />
    </>
  );
}
