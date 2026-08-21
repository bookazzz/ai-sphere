// ─── Модели AI-Sphere ───
// Статические данные для билда (static export). При монтировании на клиенте
// перезагружаются с API /api/public/models.
// Обновлено: 2026-07-15 (синхронизация с OpenRouter: 342 модели)

export interface ModelItem {
  id: string;
  name: string;
  price: number | string;
  popular?: boolean;
  vision?: boolean;
}

export interface ModelCategory {
  name: string;
  models: ModelItem[];
}

// Статический fallback для билда и первичного рендера
export const categories: ModelCategory[] = [
  {
    name: 'DeepSeek',
    models: [
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', price: 2 },
      { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', price: 2, popular: true },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', price: 9 },
      { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', price: 3 },
    ],
  },
  {
    name: 'Anthropic',
    models: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', price: 44, popular: true, vision: true },
      { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', price: 16, popular: true, vision: true },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', price: 4, vision: true },
      { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', price: 20, vision: true },
    ],
  },
  {
    name: 'OpenAI',
    models: [
      { id: 'openai/gpt-4o', name: 'GPT-4o', price: 42, popular: true, vision: true },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', price: 2, popular: true, vision: true },
      { id: 'openai/o4-mini', name: 'o4-mini', price: 18, vision: true },
      { id: 'openai/o3-mini', name: 'o3-mini', price: 18 },
    ],
  },
  {
    name: 'Google',
    models: [
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', price: 31, vision: true },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', price: 6, vision: true },
    ],
  },
  {
    name: 'Meta',
    models: [
      { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', price: 2, popular: true, vision: true },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', price: 2 },
    ],
  },
  {
    name: 'Mistral',
    models: [
      { id: 'mistralai/mistral-large', name: 'Mistral Large', price: 20 },
      { id: 'mistralai/mistral-nemo', name: 'Mistral Nemo', price: 1 },
    ],
  },
  {
    name: 'Qwen',
    models: [
      { id: 'qwen/qwen-plus', name: 'Qwen Plus', price: 7 },
      { id: 'qwen/qwen3.7-max', name: 'Qwen 3.7 Max', price: 15 },
    ],
  },
  {
    name: 'xAI',
    models: [
      { id: 'x-ai/grok-4.5', name: 'Grok 4.5', price: 24 },
      { id: 'x-ai/grok-4.20', name: 'Grok 4.20', price: 10 },
    ],
  },
];

export const allModels: ModelItem[] = categories.flatMap(cat => cat.models);
export const DEFAULT_MODEL_ID = 'deepseek/deepseek-v4-flash';

export function getModelById(id: string): ModelItem | undefined {
  return allModels.find(m => m.id === id);
}

export function getCategoryByModelId(id: string): string | undefined {
  for (const cat of categories) {
    if (cat.models.some(m => m.id === id)) return cat.name;
  }
  return undefined;
}

export function isVisionCapable(modelId: string): boolean {
  const model = allModels.find(m => m.id === modelId);
  return model?.vision === true;
}

export function filterVisionModels(): ModelItem[] {
  return allModels.filter(m => m.vision === true);
}

// ─── API-загрузка (клиентская, заменяет статические данные при монтировании) ───

let _apiCategories: ModelCategory[] = [];
let _apiAllModels: ModelItem[] = [];

/** Слушатели обновления моделей */
const _listeners: Set<() => void> = new Set();
export function subscribeToModelsUpdates(cb: () => void): () => void {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}
function _notifyListeners() {
  _listeners.forEach(cb => cb());
}

/**
 * Форматирует цену модели для отображения на странице цен.
 * Если input и output отличаются — показывает "от X".
 */
function _format_model_price(m: any): string {
  const inVal = m.credits_in_1k ?? 0;
  const outVal = m.credits_out_1k ?? 0;
  const unitVal = m.price_unit ?? 0;
  
  if (inVal > 0 && outVal > 0 && inVal !== outVal) {
    return `от ${Math.min(inVal, outVal)}`;
  }
  if (unitVal > 0) return String(unitVal);
  if (outVal > 0) return String(outVal);
  if (inVal > 0) return String(inVal);
  return String(m.price_output ?? 1);
}

/**
 * Загружает модели с /api/public/models и обновляет статические массивы.
 * При каждом вызове получает свежие данные, уведомляет подписчиков.
 */
export async function loadModelsFromApi(): Promise<void> {
  try {
    const res = await fetch('/api/public/models');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Группируем по провайдеру (из or_model_id)
    const grouped: Record<string, ModelItem[]> = {};
    for (const m of data) {
      if (m.is_visible === false) continue;
      const parts = (m.id || '').split('/');
      const provider = parts.length > 1
        ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
        : 'Other';
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push({
        id: m.id,
        name: m.name,
        price: _format_model_price(m),
        vision: m.vision ?? false,
      });
    }

    // Первую модель каждой категории помечаем popular
    const cats: ModelCategory[] = Object.entries(grouped).map(([name, models]) => ({
      name,
      models: models.map((m, idx) => ({ ...m, popular: idx === 0 })),
    }));

    _apiCategories = cats;
    _apiAllModels = cats.flatMap(c => c.models);

    // Обновляем статические массивы "на лету"
    categories.length = 0;
    categories.push(...cats);
    allModels.length = 0;
    allModels.push(..._apiAllModels);
    _notifyListeners();
  } catch (e) {
    console.warn('Failed to load models from API, using static fallback:', e);
  }
}

/** Hook для React-компонентов: возвращает категории, все модели, статус загрузки */
// NOTE: useModels lives in src/hooks/useModels.ts — import from there for hook usage.
// The loader function here is shared between hook and direct usage.
let _loadPromise: Promise<void> | null = null;

export function getLoadPromise(): Promise<void> {
  if (!_loadPromise) _loadPromise = loadModelsFromApi();
  return _loadPromise;
}
