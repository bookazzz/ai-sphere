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
import { getMe, logoutUser, saveSession, deleteSessionApi, prepareRegenerateMessages, recordProductEvent } from '@/lib/api';
import type { ChatMessage, ContentPart, EnsembleResponse, TaskRunContext } from '@/lib/api';

const PENDING_TASK_KEY = 'ai_sphere_pending_task';
let activeStorageUserId: string | null = null;

function userStorageKey(suffix: string): string | null {
  return activeStorageUserId ? `ai_sphere_user_${activeStorageUserId}_${suffix}` : null;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

function dedupeSessions(items: ChatSession[]): ChatSession[] {
  const byId = new Map<string, ChatSession>();
  for (const item of items) {
    const firstUser = item.messages.find(message => message.role === 'user') as (ChatMessage & { message_id?: string }) | undefined;
    const key = firstUser?.message_id ? `message:${firstUser.message_id}` : `id:${item.id}`;
    const previous = byId.get(key);
    if (!previous || item.updatedAt >= previous.updatedAt) byId.set(key, item);
  }
  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

function loadSessions(): ChatSession[] {
  try {
    const key = userStorageKey('sessions');
    const raw = key ? localStorage.getItem(key) : null;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return raw ? (JSON.parse(raw) as ChatSession[]).filter(session => session.updatedAt >= cutoff) : [];
  } catch { return []; }
}

function saveSessions(s: ChatSession[]) {
  const key = userStorageKey('sessions');
  if (key) localStorage.setItem(key, JSON.stringify(s));
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
    const unique = dedupeSessions(merged);
    saveSessions(unique);
    return unique;
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
    const key = userStorageKey('current_session');
    return key ? localStorage.getItem(key) : null;
  } catch { return null; }
}

function saveCurrentSessionId(id: string) {
  const key = userStorageKey('current_session');
  if (key) localStorage.setItem(key, id);
}

export default function HomeClient() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatActive, setChatActive] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  sendingRef.current = sending;
  const [thinkingText, setThinkingText] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [chatSectionKey, setChatSectionKey] = useState(0);

  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const sessionsRef = useRef<ChatSession[]>([]);
  sessionsRef.current = sessions;

  const currentSessionIdRef = useRef<string | null>(null);

  const [selectedModelId, setSelectedModelId] = useState('auto');
  const selectedModelIdRef = useRef(selectedModelId);
  selectedModelIdRef.current = selectedModelId;

  useEffect(() => {
    void recordProductEvent({ event_name: 'landing_view', metadata: { viewport: `${window.innerWidth}x${window.innerHeight}` } });
  }, []);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load sessions from server (or localStorage fallback) when authenticated
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isLoggedIn) return;
    syncSessionsFromServer().then(stored => {
      setSessions(stored);
      sessionsRef.current = stored;

      const sessionId = loadCurrentSessionId();
      if (sessionId) {
        const session = stored.find(s => s.id === sessionId);
        // Authentication and the restored pending task can complete while this
        // request is in flight. Never replace a live/newer conversation with a
        // snapshot that was loaded just before the first assistant token.
        if (session && session.messages.length > 0 && messagesRef.current.length === 0 && !sendingRef.current) {
          setMessages(session.messages);
          setChatActive(true);
          currentSessionIdRef.current = sessionId;
        }
      }
    });
  }, [isLoggedIn]);

  // Restore the HttpOnly-cookie session (also handles OAuth redirects).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('auth_token');
    getMe().then((u) => {
      activeStorageUserId = String(u.id);
      setUser(u);
      setIsLoggedIn(true);
    }).catch(() => {
      setUser(null);
      setIsLoggedIn(false);
    });
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const toggleAuth = useCallback(() => {
    setSidebarOpen(false);
    setAuthOpen(prev => !prev);
  }, [setSidebarOpen, setAuthOpen]);

  const handleLogin = useCallback((userData: any) => {
    activeStorageUserId = String(userData.id);
    setUser(userData);
    setIsLoggedIn(true);
    // Load user's sessions from server after login
    syncSessionsFromServer().then(stored => {
      setSessions(stored);
      sessionsRef.current = stored;
    });
  }, []);

  const handleLogout = useCallback(() => {
    const sessionsKey = userStorageKey('sessions');
    const currentKey = userStorageKey('current_session');
    void logoutUser().catch(() => {});
    setUser(null);
    setIsLoggedIn(false);
    setMessages([]);
    setChatActive(false);
    setSessions([]);
    sessionsRef.current = [];
    currentSessionIdRef.current = null;
    saveCurrentSessionId('');
    if (sessionsKey) localStorage.removeItem(sessionsKey);
    if (currentKey) localStorage.removeItem(currentKey);
    const flushKey = userStorageKey('sessions_flush');
    if (flushKey) localStorage.removeItem(flushKey);
    activeStorageUserId = null;
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

  const handleSendMessage = useCallback(async (text: string, attachedFiles?: any[], context?: TaskRunContext) => {
    if (!isLoggedIn) {
      try { sessionStorage.setItem(PENDING_TASK_KEY, JSON.stringify({ text, context })); } catch { /* storage can be disabled */ }
      void recordProductEvent({
        event_name: 'auth_prompted', template_id: context?.templateId || null,
        task_type: context?.taskType || '', model: selectedModelIdRef.current,
        metadata: { source: 'task_submit' },
      }).catch(() => undefined);
      setAuthOpen(true);
      return;
    }

    void recordProductEvent({
      event_name: 'task_started', template_id: context?.templateId || null,
      task_type: context?.taskType || 'text', model: selectedModelIdRef.current,
      metadata: { source: 'composer' },
    }).catch(() => undefined);

    const currentMessages = messagesRef.current;

    // Build a structured multimodal message. Extracted document text is sent as
    // text, while image/video bytes use OpenRouter-compatible content parts.
    let userContent: string | ContentPart[];
    if (attachedFiles && attachedFiles.length > 0) {
      const parts: ContentPart[] = [{ type: 'text', text: text || '' }];
      for (const file of attachedFiles) {
        if (file.dataUrl?.startsWith('data:image/')) {
          parts.push({ type: 'image_url', image_url: { url: file.dataUrl } });
        } else if (file.dataUrl?.startsWith('data:video/')) {
          parts.push({ type: 'video_url', video_url: { url: file.dataUrl } });
        } else if (file.extractedText) {
          parts.push({ type: 'text', text: `\n\nФайл «${file.name}»:\n${file.extractedText}` });
        }
      }
      userContent = parts;
    } else {
      userContent = text;
    }

    const userMsg: ChatMessage = { role: 'user', content: userContent, message_id: generateId(), requested_model: selectedModelIdRef.current };
    const updated = [...currentMessages, userMsg];
    setMessages(updated);
    setChatActive(true);
    setThinkingText('Анализирую запрос…');
    setSending(true);

    try {
      const { streamChat } = await import('@/lib/api');

      let routedModel = selectedModelIdRef.current;
      let routedModelName = '';
      let firstTokenTracked = false;
      await streamChat(selectedModelIdRef.current, updated, {
        onRoute: (route) => {
          routedModel = route.effective_model;
          routedModelName = route.effective_model_name;
          setThinkingText(`Подбираю модель: ${route.effective_model_name}`);
        },
        onToken: (token: string) => {
          if (!firstTokenTracked && token) {
            firstTokenTracked = true;
            void recordProductEvent({
              event_name: 'first_token', template_id: context?.templateId || null,
              task_type: context?.taskType || 'text', model: routedModel,
            });
          }
          setThinkingText(''); // очищаем thinking при первом контенте
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant') {
              const newContent = String(last.content) + token;
              copy[copy.length - 1] = { ...last, content: newContent };
            } else {
              copy.push({ role: 'assistant', content: token, message_id: generateId(), requested_model: selectedModelIdRef.current, effective_model: routedModel, effective_model_name: routedModelName });
            }
            return copy;
          });
        },
        onDone: (creditsSpent: number) => {
          if (creditsSpent > 0 && userRef.current) {
            setUser({ ...userRef.current, credits: Math.max(0, userRef.current.credits - creditsSpent) });
          }
          setSending(false);
          void recordProductEvent({
            event_name: 'first_result', template_id: context?.templateId || null,
            task_type: context?.taskType || 'text', model: routedModel,
            metadata: { result_kind: context?.taskType || 'chat' },
          }).catch(() => undefined);
          setThinkingText(''); // очищаем при завершении (на случай если контента не было)
        },
        onThinking: (text: string) => {
          setThinkingText(text);
        },
        onGeneration: (generation) => {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '',
            message_id: generateId(),
            requested_model: generation.requested_model,
            effective_model: generation.effective_model,
            effective_model_name: generation.effective_model_name,
            generation,
          }]);
        },
        onError: (errorMessage) => {
          void recordProductEvent({
            event_name: 'generation_failed', template_id: context?.templateId || null,
            task_type: context?.taskType || 'text', model: routedModel,
            metadata: { error_code: 'provider_error' },
          }).catch(() => undefined);
          setMessages(prev => prev[prev.length - 1]?.generation?.status === 'failed' ? prev : [
            ...prev,
            { role: 'assistant', content: `❌ Ошибка: ${errorMessage}`, message_id: generateId(), effective_model: selectedModelIdRef.current },
          ]);
        },
      }, {
        sessionId: currentSessionIdRef.current,
        templateId: context?.templateId,
        taskType: context?.taskType,
        mediaPreferences: context?.mediaPreferences,
      });
    } catch (err: any) {
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

  useEffect(() => {
    if (!isLoggedIn) return;
    try {
      const raw = sessionStorage.getItem(PENDING_TASK_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PENDING_TASK_KEY);
      const pending = JSON.parse(raw) as { text?: string; context?: TaskRunContext };
      if (pending.text) void handleSendMessage(pending.text, [], pending.context);
    } catch { /* invalid or unavailable session storage */ }
  }, [isLoggedIn, handleSendMessage]);

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

  const handleRegenerate = useCallback(async () => {
    const current = messagesRef.current;
    if (current.length === 0) return;
    const msgs = prepareRegenerateMessages(current);
    setMessages(msgs);
    setThinkingText('Проверяю запрос и готовлю новый ответ…');
    setSending(true);

    try {
      const { streamChat } = await import('@/lib/api');
      await streamChat(selectedModelIdRef.current, msgs, {
        onToken: (token: string) => {
          setThinkingText('');
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
          setThinkingText('');
        },
        onThinking: (text: string) => {
          setThinkingText(text);
        },
        onGeneration: (generation) => {
          setMessages(prev => [...prev, {
            role: 'assistant', content: '', message_id: generateId(), generation,
            requested_model: generation.requested_model,
            effective_model: generation.effective_model,
            effective_model_name: generation.effective_model_name,
          }]);
        },
        onError: (message: string) => {
          setMessages(prev => [...prev, { role: 'assistant', content: `❌ Ошибка: ${message}` }]);
        },
      }, { sessionId: currentSessionIdRef.current });
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Ошибка: ${err?.message || 'не удалось повторить запрос'}` }]);
      setSending(false);
    }
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
    const now = Date.now();
    const firstContent = msgs[0]?.content;
    const title = typeof firstContent === 'string'
      ? firstContent.slice(0, 60)
      : (Array.isArray(firstContent)
        ? (firstContent.find(p => p.type === 'text')?.text || 'Новый чат').slice(0, 60)
        : 'Новый чат');

    const reservedId = currentSessionIdRef.current || generateId();
    if (!currentSessionIdRef.current) {
      currentSessionIdRef.current = reservedId;
      saveCurrentSessionId(reservedId);
    }

    setSessions(prev => {
      let updated: ChatSession[];
      // Read the ref inside the functional update. Multiple streamed message
      // updates can queue saves in the same render; reading it outside here
      // allowed each queued updater to see null and create a duplicate row.
      const id = reservedId;
      const sessionId = reservedId;
      if (id && prev.some(s => s.id === id)) {
        updated = prev.map(s =>
          s.id === id ? { ...s, messages: msgs, title, updatedAt: now } : s
        );
      } else {
        const newSession: ChatSession = {
          id: reservedId,
          title,
          messages: msgs,
          createdAt: now,
          updatedAt: now,
        };
        updated = [...prev, newSession];
      }
      saveSessions(updated);
      const sid = sessionId || '';
      const saveWithRetry = (retries = 2) => {
        saveSession(sid, title, msgs).catch(() => {
          if (retries > 0) {
            setTimeout(() => saveWithRetry(retries - 1), 1000);
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
        const key = userStorageKey('sessions_flush');
        if (!key) return;
        localStorage.setItem(key, JSON.stringify({
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
          const uniqueMerged = dedupeSessions(merged);

          // Skip re-render if nothing changed (by id + updatedAt)
          if (uniqueMerged.length === prev.length &&
              uniqueMerged.every((s, i) => s.id === prev[i].id && s.updatedAt === prev[i].updatedAt)) {
            return prev;
          }

          saveSessions(uniqueMerged);

          // If the currently viewed session has new messages from another device, update the view
          const curId = currentSessionIdRef.current;
          if (curId) {
            const updated = serverMap.get(curId);
            if (updated) {
              const localSession = prev.find(s => s.id === curId);
              if (localSession && updated.messages.length > localSession.messages.length) {
                // Only auto-update if this device isn't currently sending
                if (!sendingRef.current) {
                  setMessages(updated.messages);
                }
              }
            }
          }

          return uniqueMerged;
        });

        // Push local/newer sessions to the server (catch save failures from previous sessions)
        for (const s of sessionsToPush) {
          const title = typeof s.messages[0]?.content === 'string'
            ? s.messages[0].content.slice(0, 60)
            : 'Новый чат';
          saveSession(s.id, title, s.messages).catch(() => {});
        }
      } catch {
        // Polling errors are non-critical — ignore silently
      }
    };

    const intervalId = setInterval(poll, POLL_MS);
    return () => { active = false; clearInterval(intervalId); };
  }, [isLoggedIn]);

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
    deleteSessionApi(sessionId).catch(() => {});
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
          onRegenerate={handleRegenerate}
          currentSessionId={currentSessionIdRef.current}
          userCredits={user?.credits}
          onOpenPricing={handleOpenPricing}
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
      </div>

      {!isLoggedIn && <Footer />}

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
        onSuccess={(_credits) => {
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
