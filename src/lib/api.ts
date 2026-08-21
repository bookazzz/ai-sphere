const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://ai-sphere.ru/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export function setToken(token: string) {
  localStorage.setItem('auth_token', token);
}

export function clearToken() {
  localStorage.removeItem('auth_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getTokenHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiCall<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getTokenHeader(),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ──────────────── Auth ────────────────

export async function loginUser(email: string, password: string) {
  const data = await apiCall<{ access_token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  return data;
}

export async function registerUser(email: string, password: string, name?: string) {
  const data = await apiCall<{ access_token: string; user: any }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  setToken(data.access_token);
  return data;
}

export async function getMe() {
  return apiCall<any>('/auth/me');
}

// ──────────────── Chat ────────────────

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  credits_spent: number;
  finish_reason: string | null;
}

export async function sendChat(model: string, messages: ChatMessage[]): Promise<ChatResponse> {
  return apiCall<ChatResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model, messages }),
  });
}

/** @deprecated Use sendChat instead */
export const sendMessage = sendChat;

/**
 * Stream chat completions via SSE. Calls onToken for each content chunk,
 * onDone when complete (with credits_spent).
 */
export async function streamChat(
  model: string,
  messages: ChatMessage[],
  callbacks: {
    onToken: (token: string) => void;
    onDone: (creditsSpent: number) => void;
    onThinking?: (text: string) => void;
  },
): Promise<void> {
  const url = `${API_BASE}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getTokenHeader(),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const data = JSON.parse(dataStr);
          if (data.type === 'content') {
            console.debug('[streamChat] SSE content:', data.content.slice(0, 200));
            callbacks.onToken(data.content);
          } else if (data.type === 'thinking') {
            callbacks.onThinking?.(data.text);
          } else if (data.type === 'done') {
            callbacks.onDone(data.credits_spent);
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  // Гарантированно выключаем индикатор печати, даже если стрим закрылся без type: done
  callbacks.onDone(0);
}

export async function uploadFile(file: File): Promise<{ id: string; name: string; size: number; type: string; url: string }> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/chat/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ──────────────── Fact Check ────────────────

export interface FactCheckClaim {
  claim: string;
  status: 'correct' | 'incorrect' | 'uncertain';
  correction: string | null;
}

export interface FactCheckResult {
  errors: FactCheckClaim[];
  confidence: number;
  verified_claims: FactCheckClaim[];
  details: string;
}

export async function checkFacts(model: string, prompt: string, response: string): Promise<FactCheckResult> {
  return apiCall<FactCheckResult>('/chat/factcheck', {
    method: 'POST',
    body: JSON.stringify({ model_id: model, prompt, response }),
  });
}

// ──────────────── Session Sync (cross-device) ────────────────

export interface ServerSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string | null;
  updatedAt: string | null;
}

export async function fetchSessions(): Promise<ServerSession[]> {
  return apiCall<ServerSession[]>('/chat/sessions');
}

export async function saveSession(id: string, title: string, messages: ChatMessage[]): Promise<void> {
  await apiCall('/chat/sessions', {
    method: 'PUT',
    body: JSON.stringify({ id, title, messages }),
  });
}

export async function deleteSessionApi(sessionId: string): Promise<void> {
  await apiCall(`/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function punctuateText(text: string): Promise<string> {
  const data = await apiCall<{ result: string }>('/chat/voice/punctuate', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return data.result;
}

// ──────────────── Ensemble ────────────────

export interface EnsembleModelResponse {
  model_name: string;
  model_id: string;
  content: string | null;
  error?: string | null;
}

export interface EnsembleResponse {
  models: EnsembleModelResponse[];
  consensus: string;
  credits_spent: number;
}

export async function ensembleChat(modelTier: string, messages: ChatMessage[], signal?: AbortSignal): Promise<EnsembleResponse> {
  return apiCall<EnsembleResponse>('/chat/ensemble', {
    method: 'POST',
    body: JSON.stringify({ model_tier: modelTier, messages }),
    signal,
  });
}

// ──────────────── Message Feedback ────────────────

export interface MessageFeedback {
  session_id: string;
  message_index: number;
  feedback_type: 'like' | 'dislike' | 'regenerate';
  model: string;
}

export async function sendFeedback(feedback: MessageFeedback): Promise<void> {
  await apiCall('/chat/feedback', {
    method: 'POST',
    body: JSON.stringify(feedback),
  });
}

// ──────────────── Regenerate ────────────────

/**
 * Prepare messages for regeneration: remove the last assistant message
 * so the API re-generates a new response.
 */
export function prepareRegenerateMessages(messages: ChatMessage[]): ChatMessage[] {
  const msgs = [...messages];
  // Remove the last assistant message(s) — usually the last message
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant') {
      msgs.splice(i, 1);
      break;
    }
  }
  return msgs;
}
