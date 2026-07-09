// ─── Синхронизировано с бэкендом (53 модели) ───

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

export const categories: ModelCategory[] = [
  {
    name: 'DeepSeek',
    models: [
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V4 Flash', price: 2, popular: true },
      { id: 'deepseek/deepseek-chat-v3', name: 'DeepSeek V3', price: 3 },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', price: 6 },
      { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', price: 3 },
    ],
  },
  {
    name: 'Anthropic',
    models: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', price: 24, popular: true, vision: true },
      { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', price: 10, popular: true, vision: true },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', price: 3, vision: true },
      { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', price: 60, vision: true },
      { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', price: 40, vision: true },
    ],
  },
  {
    name: 'OpenAI',
    models: [
      { id: 'openai/gpt-4o', name: 'GPT-4o', price: 26, popular: true, vision: true },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', price: 2, popular: true, vision: true },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1', price: 32, vision: true },
      { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', price: 6, vision: true },
      { id: 'openai/o4-mini', name: 'o4-mini', price: 18, vision: true },
      { id: 'openai/o3-mini', name: 'o3-mini', price: 18 },
      { id: 'openai/gpt-5-mini', name: 'GPT-5', price: 4, popular: true, vision: true },
      { id: 'openai/gpt-5.4-nano', name: 'GPT-5.4 Nano', price: 2 },
      { id: 'openai/gpt-5-image-mini', name: 'GPT-5 Image Mini', price: 3, vision: true },
    ],
  },
  {
    name: 'Google',
    models: [
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', price: 22, vision: true },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', price: 5, vision: true },
      { id: 'google/gemini-3.1-flash-lite-image', name: 'Gemini 3.1 Flash Lite Image', price: 3, vision: true },
      { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', price: 18, vision: true },
      { id: 'google/gemini-3.1-pro', name: 'Gemini 3.1 Pro', price: 48, vision: true },
    ],
  },
  {
    name: 'Meta',
    models: [
      { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', price: 2, popular: true, vision: true },
      { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', price: 1, vision: true },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', price: 2 },
      { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', price: 3 },
      { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', price: 1 },
      { id: 'meta-llama/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', price: 1 },
      { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', price: 1, vision: true },
    ],
  },
  {
    name: 'Mistral',
    models: [
      { id: 'mistralai/mistral-large', name: 'Mistral Large', price: 12 },
      { id: 'mistralai/mistral-nemo', name: 'Mistral Nemo', price: 1 },
      { id: 'mistralai/mistral-saba-2502', name: 'Mistral Saba', price: 1 },
      { id: 'mistralai/mistral-medium-3-5', name: 'Mistral Medium 3.5', price: 30 },
      { id: 'mistralai/mistral-small-2603', name: 'Mistral Small', price: 2 },
    ],
  },
  {
    name: 'Cohere',
    models: [
      { id: 'cohere/command-a', name: 'Command A', price: 18 },
      { id: 'cohere/command-r-08-2024', name: 'Command R', price: 2 },
      { id: 'cohere/command-r7b-12-2024', name: 'Command R 7B', price: 1 },
    ],
  },
  {
    name: 'Qwen',
    models: [
      { id: 'qwen/qwen3-235b-a22b', name: 'Qwen 3 235B', price: 5 },
      { id: 'qwen/qwen-plus', name: 'Qwen Plus', price: 2 },
      { id: 'qwen/qwen3.7-max', name: 'Qwen 3.7 Max', price: 15 },
      { id: 'qwen/qwen3-coder-next', name: 'Qwen 3 Coder Next', price: 3 },
    ],
  },
  {
    name: 'Amazon',
    models: [
      { id: 'amazon/nova-pro-v1:0', name: 'Nova Pro 1.0', price: 8, vision: true },
      { id: 'amazon/nova-lite-v1:0', name: 'Nova Lite 1.0', price: 1, vision: true },
      { id: 'amazon/nova-micro-v1:0', name: 'Nova Micro 1.0', price: 1 },
    ],
  },
  {
    name: 'Nous Research',
    models: [
      { id: 'nousresearch/hermes-3-llama-3.1-405b', name: 'Hermes 3 405B', price: 3 },
    ],
  },
  {
    name: 'Microsoft',
    models: [
      { id: 'microsoft/phi-4', name: 'Phi-4', price: 1 },
    ],
  },
  {
    name: 'MiniMax',
    models: [
      { id: 'minimax/minimax-01', name: 'MiniMax-01', price: 2 },
    ],
  },
  {
    name: 'xAI',
    models: [
      { id: 'x-ai/grok-4.5', name: 'Grok 4.5', price: 24 },
      { id: 'x-ai/grok-4.20', name: 'Grok 4.20', price: 10 },
      { id: 'x-ai/grok-4.3', name: 'Grok 4.3', price: 6 },
    ],
  },
];

export const allModels: ModelItem[] = categories.flatMap(cat => cat.models);
export const DEFAULT_MODEL_ID = 'deepseek/deepseek-chat';

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
