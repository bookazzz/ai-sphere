const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8000/api' : '/api';

export async function apiCall<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(url, { ...options, headers, credentials: 'include' });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ──────────────── Auth ────────────────

export async function loginAdmin(email: string, password: string) {
  return apiCall<{ user: any }>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe() {
  return apiCall<any>('/auth/me');
}

export async function logoutUser(): Promise<void> {
  await apiCall('/auth/logout', { method: 'POST' });
}

// ──────────────── Chat ────────────────

export interface ContentPart {
  type: 'text' | 'image_url' | 'video_url' | 'file';
  text?: string;
  image_url?: { url: string };
  video_url?: { url: string };
  file?: { filename: string; file_data: string };
}

export interface GenerationAsset {
  id: string;
  type: 'image' | 'video';
  media_type: string;
  url: string;
}

export interface GenerationInfo {
  id: string;
  kind: 'image' | 'video';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  requested_model: string;
  effective_model: string;
  effective_model_name: string;
  parameters: Record<string, unknown>;
  assets: GenerationAsset[];
  error: string;
  credits_spent: number;
  expires_at: string | null;
  template_id?: number | null;
  task_type?: string;
}

export interface TaskTemplate {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: 'text' | 'document' | 'image' | 'video';
  task_type: string;
  prompt_template: string;
  example_input: string;
  example_output: string;
  required_input: string;
  preview_url: string;
  default_parameters: Record<string, unknown>;
  preferred_model: string;
  fallback_models: string[];
  estimated_credits_label: string;
  is_featured: boolean;
  usage_count: number;
}

export interface TaskEstimate {
  task_type: string;
  kind: 'text' | 'image' | 'video';
  effective_model: string;
  effective_model_name: string;
  credits_min: number;
  credits_max: number;
  exact: boolean;
  parameters: Record<string, unknown>;
  fallback_models: string[];
}

export interface TaskRunContext {
  templateId?: number | null;
  taskType?: string;
  mediaPreferences?: Record<string, unknown>;
}

export interface LibraryItem {
  id: string;
  type: 'chat' | 'image' | 'video' | 'document';
  title: string;
  prompt?: string;
  model?: string;
  status: string;
  assets?: GenerationAsset[];
  credits_spent?: number;
  is_favorite?: boolean;
  is_public?: boolean;
  allow_prompt?: boolean;
  share_slug?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UsageItem {
  id: number;
  amount: number;
  type: 'spend' | 'refund';
  description: string;
  created_at: string | null;
}

export interface Recipe {
  slug: string;
  title: string;
  steps: string[];
}

export interface Project {
  id: string;
  name: string;
  recipe_slug: string;
  status: 'draft' | 'active' | 'completed';
  current_step: number;
  data: Record<string, unknown>;
  is_public: boolean;
  allow_prompt: boolean;
  share_slug: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
  message_id?: string;
  requested_model?: string;
  effective_model?: string;
  effective_model_name?: string;
  generation?: GenerationInfo;
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
    onRoute?: (route: { intent: string; requested_model: string; effective_model: string; effective_model_name: string }) => void;
    onGeneration?: (generation: GenerationInfo) => void;
    onError?: (message: string) => void;
  },
  options: {
    sessionId?: string | null;
    intent?: 'auto' | 'text' | 'image' | 'video';
    templateId?: number | null;
    taskType?: string;
    mediaPreferences?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      intent: options.intent || 'auto',
      session_id: options.sessionId || null,
      template_id: options.templateId || null,
      task_type: options.taskType || '',
      media_preferences: options.mediaPreferences || {},
    }),
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  if (!res.body) throw new Error('Сервер вернул пустой поток');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneCalled = false;

  const handleEvent = (raw: string) => {
    const dataLine = raw.split(/\r?\n/).find(line => line.startsWith('data:'));
    if (!dataLine) return;
    const dataStr = dataLine.slice(5).trim();
    if (!dataStr || dataStr === '[DONE]') return;
    const data = JSON.parse(dataStr);
    if (data.type === 'content' || data.type === 'text_delta') {
      callbacks.onToken(String(data.content || data.text || ''));
    } else if (data.type === 'thinking') {
      callbacks.onThinking?.(String(data.text || ''));
    } else if (data.type === 'route') {
      callbacks.onRoute?.(data);
    } else if (data.type === 'generation') {
      callbacks.onGeneration?.(data.generation);
    } else if (data.type === 'error') {
      const message = String(data.content || 'Ошибка генерации');
      if (callbacks.onError) {
        callbacks.onError(message);
        if (!doneCalled) {
          doneCalled = true;
          callbacks.onDone(0);
        }
      } else throw new Error(message);
    } else if (data.type === 'done' && !doneCalled) {
      doneCalled = true;
      callbacks.onDone(Number(data.credits_spent || 0));
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || '';
    for (const event of events) {
      try {
        handleEvent(event);
      } catch (error) {
        if (error instanceof SyntaxError) throw new Error('Некорректный ответ сервера');
        throw error;
      }
    }
  }
  if (buffer.trim()) handleEvent(buffer);
  if (!doneCalled) throw new Error('Поток ответа завершился преждевременно');
}

export async function fetchTaskTemplates(category = ''): Promise<TaskTemplate[]> {
  return apiCall<TaskTemplate[]>(`/public/task-templates${category ? `?category=${encodeURIComponent(category)}` : ''}`);
}

export async function fetchPopularTemplates(): Promise<TaskTemplate[]> {
  return apiCall<TaskTemplate[]>('/public/popular');
}

export async function fetchPublicGallery(): Promise<LibraryItem[]> {
  return apiCall<LibraryItem[]>('/public/gallery');
}

export async function estimateTask(payload: {
  template_id?: number | null;
  task_type?: string;
  model?: string;
  prompt?: string;
  media_preferences?: Record<string, unknown>;
}): Promise<TaskEstimate> {
  return apiCall<TaskEstimate>('/tasks/estimate', { method: 'POST', body: JSON.stringify(payload) });
}

export async function recordProductEvent(event: {
  event_name: string;
  anonymous_id?: string;
  template_id?: number | null;
  task_type?: string;
  model?: string;
  metadata?: Record<string, string | number | boolean>;
  duration_ms?: number;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const identity = getAnalyticsIdentity();
  const payload = {
    ...event,
    event_id: crypto.randomUUID(),
    anonymous_id: event.anonymous_id || identity.anonymousId,
    visit_session_id: identity.visitSessionId,
    page: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    source: identity.source,
    device_type: identity.deviceType,
    experiment_variants: readJson<Record<string, string>>('ai_sphere_experiment_variants', {}),
  };
  window.dispatchEvent(new CustomEvent('ai-sphere-product-event', { detail: payload }));
  sendMetricaGoal(event.event_name, event.metadata);
  try {
    await flushProductEventQueue();
    await apiCall('/events', { method: 'POST', body: JSON.stringify(payload) });
  } catch {
    const queue = readJson<Record<string, unknown>[]>('ai_sphere_event_queue', []);
    localStorage.setItem('ai_sphere_event_queue', JSON.stringify([...queue, payload].slice(-100)));
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
}

export function getAnalyticsIdentity() {
  if (typeof window === 'undefined') return { anonymousId: '', visitSessionId: '', source: '', deviceType: 'desktop' };
  let anonymousId = localStorage.getItem('ai_sphere_anonymous_id');
  let visitSessionId = sessionStorage.getItem('ai_sphere_visit_session_id');
  if (!anonymousId) { anonymousId = crypto.randomUUID(); localStorage.setItem('ai_sphere_anonymous_id', anonymousId); }
  if (!visitSessionId) { visitSessionId = crypto.randomUUID(); sessionStorage.setItem('ai_sphere_visit_session_id', visitSessionId); }
  const params = new URLSearchParams(window.location.search);
  const incomingSource = params.get('utm_source') || (document.referrer ? new URL(document.referrer).hostname : 'direct');
  if (!localStorage.getItem('ai_sphere_first_source')) localStorage.setItem('ai_sphere_first_source', incomingSource);
  const width = window.innerWidth;
  return {
    anonymousId,
    visitSessionId,
    source: localStorage.getItem('ai_sphere_first_source') || incomingSource,
    deviceType: width < 768 ? 'mobile' : width < 1100 ? 'tablet' : 'desktop',
  };
}

async function flushProductEventQueue(): Promise<void> {
  const queue = readJson<Record<string, unknown>[]>('ai_sphere_event_queue', []);
  if (!queue.length) return;
  await apiCall('/events/batch', { method: 'POST', body: JSON.stringify({ events: queue }) });
  localStorage.removeItem('ai_sphere_event_queue');
}

function sendMetricaGoal(eventName: string, metadata?: Record<string, string | number | boolean>) {
  const goals: Record<string, string> = {
    auth_completed: 'registration', task_started: 'task_submit',
    checkout_started: 'payment_start', payment_succeeded: 'purchase',
    ...(eventName === 'payment_returned' && metadata?.status === 'success' ? { payment_returned: 'purchase' } : {}),
  };
  const goal = goals[eventName];
  if (!goal) return;
  const script = document.querySelector<HTMLScriptElement>('script[data-metrica-id]');
  const counterId = Number(script?.dataset.metricaId || '110850288');
  (window as typeof window & { ym?: (...args: unknown[]) => void }).ym?.(counterId, 'reachGoal', goal, metadata || {});
}

export interface ProgressData {
  xp: number; level: string; streak_days: number; monthly_bonus_credits: number; monthly_bonus_cap: number;
  missions: { id: number; code: string; title: string; description: string; target: number; current: number; completed: boolean; reward_credits: number; reward_xp: number }[];
  achievements: { code: string; title: string; description: string; icon: string }[];
}

export interface EngagementCampaign {
  id: number; delivery_id: number; placement: 'banner'|'card'|'popup'|'notification'; title: string; body: string;
  button_text: string; button_url: string; frequency_cap: number;
}

export interface EngagementSurvey {
  id: number; title: string; trigger_event: string; is_critical: boolean;
  questions: { id: number; prompt: string; type: string; options: string[] }[];
}

export interface ExperimentAssignment {
  experiment_id: number; variant_id: number; variant_key: string; payload: Record<string, unknown>; exposed: boolean;
}

export const fetchProgress = () => apiCall<ProgressData>('/progress');
export const fetchCampaigns = () => apiCall<EngagementCampaign[]>(`/engagement/campaigns?anonymous_id=${encodeURIComponent(getAnalyticsIdentity().anonymousId)}`);
export const campaignAction = (deliveryId: number, action: 'shown'|'opened'|'clicked'|'dismissed') => apiCall(`/engagement/campaigns/${deliveryId}/${action}?anonymous_id=${encodeURIComponent(getAnalyticsIdentity().anonymousId)}`, { method: 'POST' });
export const fetchSurveys = (triggerEvent = '') => apiCall<EngagementSurvey[]>(`/engagement/surveys?trigger_event=${encodeURIComponent(triggerEvent)}&anonymous_id=${encodeURIComponent(getAnalyticsIdentity().anonymousId)}`);
export const answerSurvey = (surveyId: number, questionId: number, answer: string) => {
  const identity = getAnalyticsIdentity();
  return apiCall(`/engagement/surveys/${surveyId}/responses`, { method: 'POST', body: JSON.stringify({ question_id: questionId, answer, anonymous_id: identity.anonymousId, visit_session_id: identity.visitSessionId }) });
};
export async function fetchExperimentAssignment(surface: string): Promise<ExperimentAssignment | null> {
  const identity = getAnalyticsIdentity();
  const result = await apiCall<{ assignment: ExperimentAssignment | null }>(`/experiments/assignments?surface=${encodeURIComponent(surface)}&anonymous_id=${encodeURIComponent(identity.anonymousId)}`);
  if (result.assignment) {
    const variants = readJson<Record<string, string>>('ai_sphere_experiment_variants', {});
    variants[surface] = result.assignment.variant_key;
    localStorage.setItem('ai_sphere_experiment_variants', JSON.stringify(variants));
  }
  return result.assignment;
}
export const exposeExperiment = (experimentId: number) => apiCall(`/experiments/assignments/${experimentId}/expose?anonymous_id=${encodeURIComponent(getAnalyticsIdentity().anonymousId)}`, { method: 'POST' });

export async function fetchLibrary(kind = 'all', favorite = false): Promise<LibraryItem[]> {
  return apiCall<LibraryItem[]>(`/library?kind=${encodeURIComponent(kind)}&favorite=${favorite}`);
}

export async function updateLibraryItem(id: string, changes: Partial<Pick<LibraryItem, 'is_favorite' | 'is_public' | 'allow_prompt'>>): Promise<LibraryItem> {
  return apiCall<LibraryItem>(`/library/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

export async function deleteLibraryItem(id: string): Promise<void> {
  await apiCall(`/library/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function reuseLibraryItem(id: string): Promise<void> {
  await apiCall(`/library/${encodeURIComponent(id)}/reuse`, { method: 'POST' });
}

export async function fetchBillingUsage(): Promise<UsageItem[]> {
  return apiCall<UsageItem[]>('/billing/usage');
}

export interface SupportTicketSummary {
  id: number; subject: string; category: string; status: string; priority: string;
  last_message_at: string | null; created_at: string | null;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  messages: { id: number; user_id: number; content: string; created_at: string | null }[];
}

export const fetchSupportTickets = () => apiCall<SupportTicketSummary[]>('/tickets');
export const fetchSupportTicket = (id: number) => apiCall<SupportTicketDetail>(`/tickets/${id}`);
export const createSupportTicket = (payload: { subject: string; category: string; priority: string; message: string }) =>
  apiCall<{ ok: boolean; ticket_id: number; status: string }>('/tickets', { method: 'POST', body: JSON.stringify(payload) });
export const replySupportTicket = (id: number, message: string) =>
  apiCall<{ ok: boolean; message_id: number }>(`/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ message }) });

export async function fetchRecipes(): Promise<Recipe[]> {
  return apiCall<Recipe[]>('/recipes');
}

export async function fetchProjects(): Promise<Project[]> {
  return apiCall<Project[]>('/projects');
}

export async function fetchPublicProjects(): Promise<Project[]> {
  return apiCall<Project[]>('/public/projects');
}

export async function createProject(name: string, recipeSlug: string): Promise<Project> {
  return apiCall<Project>('/projects', { method: 'POST', body: JSON.stringify({ name, recipe_slug: recipeSlug }) });
}

export async function updateProject(id: string, changes: Partial<Project>): Promise<Project> {
  return apiCall<Project>(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

export async function deleteProject(id: string): Promise<void> {
  await apiCall(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getGeneration(jobId: string): Promise<GenerationInfo> {
  return apiCall<GenerationInfo>(`/generations/${encodeURIComponent(jobId)}`);
}

export async function uploadFile(file: File, sessionId?: string | null): Promise<{ id: string; file_id: string; name: string; size: number; type: string; url: string; extracted_text?: string; expires_at: string; session_id?: string | null }> {
  const formData = new FormData();
  formData.append('file', file);
  if (sessionId) formData.append('session_id', sessionId);
  const res = await fetch(`${API_BASE}/chat/upload`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const data = await apiCall<{ result: string; applied: boolean }>('/chat/voice/punctuate', {
      method: 'POST',
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    return data.result;
  } finally {
    clearTimeout(timeoutId);
  }
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
