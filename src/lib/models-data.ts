import { apiCall } from '@/lib/api';

// ─── Модели AI-Sphere ───
// Единственный источник каталога — /api/public/models. Массивы заполняются
// после монтирования клиента и обновляются без перезагрузки страницы.

export interface ModelItem {
  id: string;
  name: string;
  price: number | string;
  popular?: boolean;
  vision?: boolean;
  inputModalities?: string[];
  outputModalities?: string[];
  supportedParameters?: Record<string, unknown>;
  autoRouteEnabled?: boolean;
}

export interface ModelCategory {
  name: string;
  models: ModelItem[];
}

export const categories: ModelCategory[] = [];
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
  return model?.vision === true || model?.inputModalities?.includes('image') === true;
}

export function filterVisionModels(): ModelItem[] {
  return allModels.filter(m => m.vision === true);
}

// ─── API-загрузка (клиентская, заменяет статические данные при монтировании) ───

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
    const data = await apiCall<any[]>('/public/models');

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
        inputModalities: Array.isArray(m.input_modalities) ? m.input_modalities : ['text'],
        outputModalities: Array.isArray(m.output_modalities) ? m.output_modalities : ['text'],
        supportedParameters: m.supported_parameters || {},
        autoRouteEnabled: m.auto_route_enabled === true,
      });
    }

    // Первую модель каждой категории помечаем popular
    const cats: ModelCategory[] = Object.entries(grouped).map(([name, models]) => ({
      name,
      models: models.map((m, idx) => ({ ...m, popular: idx === 0 })),
    }));

    const models = cats.flatMap(c => c.models);

    // Обновляем общие массивы "на лету"
    categories.length = 0;
    categories.push(...cats);
    allModels.length = 0;
    allModels.push(...models);
    _notifyListeners();
  } catch { /* Static catalog remains available when the API is offline. */ }
}

/** Hook для React-компонентов: возвращает категории, все модели, статус загрузки */
// NOTE: useModels lives in src/hooks/useModels.ts — import from there for hook usage.
// The loader function here is shared between hook and direct usage.
let _loadPromise: Promise<void> | null = null;

export function getLoadPromise(): Promise<void> {
  if (!_loadPromise) _loadPromise = loadModelsFromApi();
  return _loadPromise;
}
