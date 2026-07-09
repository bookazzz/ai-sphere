const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://ai-sphere.ru/api';

function getToken(): string | null {
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
  type: 'text' | 'image_url' | 'file';
  text?: string;
  image_url?: { url: string };
  file?: { url: string; name?: string };
}

export interface ChatMessage {
  role: string;
  content: string | ContentPart[];
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  credits_spent: number;
  finish_reason: string;
}

export async function sendMessage(
  model: string,
  messages: ChatMessage[],
): Promise<ChatResponse> {
  return apiCall<ChatResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model, messages }),
  });
}

// ──────────────── Files ────────────────

export async function uploadFile(file: File): Promise<{
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/chat/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}
