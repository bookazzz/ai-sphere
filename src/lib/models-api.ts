// ─── API-based model data source ───
// Fetches models from the backend API at runtime.
// Used by client components to get live model data.

export interface ModelItem {
  id: string;
  name: string;
  price: number;
  popular?: boolean;
  vision?: boolean;
}

export interface ModelCategory {
  name: string;
  models: ModelItem[];
}

const API_BASE = '';

function groupModels(models: ModelItem[]): ModelCategory[] {
  const grouped: Record<string, ModelItem[]> = {};
  for (const m of models) {
    const parts = m.id.split('/');
    const provider = parts.length > 1 ? parts[0] : 'Other';
    const label = provider.charAt(0).toUpperCase() + provider.slice(1);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(m);
  }
  return Object.entries(grouped).map(([name, models]) => ({ name, models }));
}

export async function fetchModels(): Promise<{
  categories: ModelCategory[];
  allModels: ModelItem[];
}> {
  const res = await fetch(`${API_BASE}/api/public/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = await res.json();

  const allModels: ModelItem[] = data.map((m: any) => ({
    id: m.id,
    name: m.name,
    price: m.price_unit ?? m.price_output ?? 1,
    vision: m.vision ?? false,
  }));

  const categories = groupModels(allModels);

  // Mark first model as popular (fallback logic)
  for (const cat of categories) {
    if (cat.models.length > 0 && !cat.models[0].popular) {
      cat.models[0].popular = true;
    }
  }

  return { categories, allModels };
}

export const DEFAULT_MODEL_ID = 'deepseek/deepseek-v4-flash';

export async function getModelById(id: string): Promise<ModelItem | undefined> {
  const { allModels } = await fetchModels();
  return allModels.find(m => m.id === id);
}

export async function getCategoryByModelId(id: string): Promise<string | undefined> {
  const { categories } = await fetchModels();
  for (const cat of categories) {
    if (cat.models.some(m => m.id === id)) return cat.name;
  }
  return undefined;
}

export async function isVisionCapable(modelId: string): Promise<boolean> {
  const { allModels } = await fetchModels();
  const model = allModels.find(m => m.id === modelId);
  return model?.vision === true;
}

export async function filterVisionModels(): Promise<ModelItem[]> {
  const { allModels } = await fetchModels();
  return allModels.filter(m => m.vision === true);
}
