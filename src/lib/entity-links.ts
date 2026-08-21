/**
 * Entity link resolver — маппинг entity → реальный URL на сайте.
 * Используется для построения сущностного графа (entity graph).
 */

export interface EntityLink {
  label: string;
  href: string;
  description?: string;
}

/** Компании — ведут на страницу компании */
const COMPANY_LINKS: Record<string, EntityLink> = {
  openai: { label: 'OpenAI', href: '/company/openai/', description: 'OpenAI — модели, продукты и новости' },
  anthropic: { label: 'Anthropic', href: '/company/anthropic/', description: 'Anthropic (Claude) — модели, продукты и новости' },
  'google-deepmind': { label: 'Google DeepMind', href: '/company/google-deepmind/', description: 'Google DeepMind — модели, продукты и новости' },
  'meta-ai': { label: 'Meta AI', href: '/company/meta-ai/', description: 'Meta AI — модели, продукты и новости' },
  mistral: { label: 'Mistral AI', href: '/company/mistral-ai/', description: 'Mistral AI — модели, продукты и новости' },
  xai: { label: 'xAI', href: '/company/xai/', description: 'xAI (Grok) — модели, продукты и новости' },
  amazon: { label: 'Amazon', href: '/prices/#amazon', description: 'Модели Amazon Bedrock' },
  microsoft: { label: 'Microsoft', href: '/prices/#microsoft', description: 'Модели Microsoft Azure' },
  nvidia: { label: 'Nvidia', href: '/prices/#nvidia', description: 'Модели Nvidia' },
  cohere: { label: 'Cohere', href: '/prices/#cohere', description: 'Модели Cohere' },
  qwen: { label: 'Qwen', href: '/prices/#qwen', description: 'Модели Qwen (Alibaba)' },
};
/** Модели — ведут на страницу с ценами (с якорем) или категорию новостей */
const MODEL_LINKS: Record<string, EntityLink> = {
  'gpt-5': { label: 'GPT-5', href: '/prices/#openai', description: 'Цены на GPT-5' },
  'gpt-5-image-mini': { label: 'GPT-5 Image Mini', href: '/prices/#openai', description: 'Цены на GPT-5 Image Mini' },
  'gpt-4o': { label: 'GPT-4o', href: '/prices/#openai', description: 'Цены на GPT-4o' },
  'claude-opus-5': { label: 'Claude Opus 5', href: '/prices/#anthropic', description: 'Цены на Claude Opus 5' },
  'claude-sonnet-4': { label: 'Claude Sonnet 4', href: '/prices/#anthropic', description: 'Цены на Claude Sonnet 4' },
  'claude-haiku-4': { label: 'Claude Haiku 4', href: '/prices/#anthropic', description: 'Цены на Claude Haiku 4' },
  'gemini-3': { label: 'Gemini 3', href: '/prices/#google', description: 'Цены на Gemini 3' },
  'gemini-3.1': { label: 'Gemini 3.1', href: '/prices/#google', description: 'Цены на Gemini 3.1' },
  'gemini-3-pro': { label: 'Gemini 3 Pro', href: '/prices/#google', description: 'Цены на Gemini 3 Pro' },
  'gemini-2.5': { label: 'Gemini 2.5', href: '/prices/#google', description: 'Цены на Gemini 2.5' },
  'deepseek-v3': { label: 'DeepSeek V3', href: '/prices/#deepseek', description: 'Цены на DeepSeek V3' },
  'deepseek-v4-flash': { label: 'DeepSeek V4 Flash', href: '/prices/#deepseek', description: 'Цены на DeepSeek V4 Flash' },
  'deepseek-r1': { label: 'DeepSeek R1', href: '/prices/#deepseek', description: 'Цены на DeepSeek R1' },
  'llama-4': { label: 'Llama 4', href: '/prices/#meta', description: 'Цены на Llama 4' },
  'mistral-large': { label: 'Mistral Large', href: '/prices/#mistral', description: 'Цены на Mistral Large' },
};

/** Категории для связанных страниц (ссылки на разные типы контента) */
const PAGE_LINKS: Record<string, EntityLink> = {
  'sravneniya-nejrosetej': { label: 'Сравнения нейросетей', href: '/comparisons/', description: 'Сравнение AI-моделей' },
  'chat-nejroset': { label: 'Чат с нейросетью', href: '/', description: 'Задать вопрос любой нейросети' },
  'ceny-na-nejroseti': { label: 'Цены на нейросети', href: '/prices/', description: 'Стоимость API моделей' },
  'instrukcii-nejroseti': { label: 'Инструкции по нейросетям', href: '/blog/', description: 'Гайды и инструкции' },
};

/**
 * Получить ссылку на связанную сущность (модель).
 * Если модель не найдена, возвращает ссылку на общую страницу моделей.
 */
export function getModelLink(key: string): EntityLink {
  const lower = key.toLowerCase();
  return MODEL_LINKS[lower] ?? {
    label: key,
    href: '/prices/',
    description: 'Цены на AI-модели',
  };
}

/**
 * Получить ссылку на связанную компанию.
 * Если компания не найдена, возвращает ссылку на /news/category/general/.
 */
export function getCompanyLink(key: string): EntityLink {
  const lower = key.toLowerCase();
  return COMPANY_LINKS[lower] ?? {
    label: key,
    href: `/news/category/general/`,
    description: `Новости ${key}`,
  };
}

/**
 * Получить ссылку на связанную страницу.
 */
export function getPageLink(key: string): EntityLink {
  const lower = key.toLowerCase();
  return PAGE_LINKS[lower] ?? {
    label: key,
    href: '/',
    description: key,
  };
}

/**
 * Получить ссылку на category-страницу из entity-ключа.
 * Используется когда нужно найти все новости по сущности.
 */
export function getNewsCategoryLink(entity: string): string | null {
  const lower = entity.toLowerCase();
  const validCategories = ['openai', 'anthropic', 'google-gemini', 'llm', 'ai-agents', 'image-generation', 'video-generation', 'general'];
  if (validCategories.includes(lower)) return `/news/category/${lower}/`;
  return null;
}

/** Все зарегистрированные компании (для авто-подсказок) */
export const ALL_COMPANIES = Object.keys(COMPANY_LINKS);

/** Все зарегистрированные модели (для авто-подсказок) */
export const ALL_MODELS = Object.keys(MODEL_LINKS);
