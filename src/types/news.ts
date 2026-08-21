export type NewsCategory = 'openai' | 'anthropic' | 'google-gemini' | 'llm' | 'ai-agents' | 'image-generation' | 'video-generation' | 'research' | 'general';

export type NewsStatus = 'draft' | 'review' | 'ready' | 'blocked';

export const NEWS_CATEGORIES: NewsCategory[] = [
  'openai', 'anthropic', 'google-gemini', 'llm',
  'ai-agents', 'image-generation', 'video-generation', 'research', 'general'
];

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'google-gemini': 'Google / Gemini',
  'llm': 'LLM',
  'ai-agents': 'AI-агенты',
  'image-generation': 'Генерация изображений',
  'video-generation': 'Генерация видео',
  'research': 'Исследования',
  'general': 'Все новости',
};

export interface NewsSection {
  title: string;
  content: string;
  type?: 'text' | 'table' | 'quote' | 'list';
}

export interface NewsArticleMeta {
  /** Уникальный slug */
  slug: string;
  /** Заголовок H1 */
  title: string;
  /** Meta description */
  description: string;
  /** Дата публикации (ISO) */
  datePublished: string;
  /** Дата обновления (ISO) */
  dateModified?: string;
  /** Автор */
  author: string;
  /** Категория */
  category: NewsCategory;
  /** Теги */
  tags: string[];
  /** Ссылки на источники */
  sourceUrls: string[];
  /** Основной источник (первый URL) */
  primarySourceUrl?: string;
  /** Связанные модели */
  relatedModels?: string[];
  /** Связанные компании */
  relatedCompanies?: string[];
  /** Связанные страницы */
  relatedPages?: string[];
  /** Изображение */
  image?: string;
  /** Alt текст изображения */
  imageAlt?: string;
  /** Статус */
  status: NewsStatus;
  /** Индексировать */
  index: boolean;
  /** Канонический URL */
  canonical?: string;
  /** Research-статья (препринт) */
  isResearch?: boolean;
  /** Поддиректория относительно news/ (пустая для корня, research/ для research) */
  subdir?: string;
}

export interface NewsArticle extends NewsArticleMeta {
  /** Полный URL */
  url: string;
  /** Краткое резюме (2-3 предложения) */
  summary: string;
  /** Секции контента */
  sections: NewsSection[];
  /** Полный markdown-контент */
  content: string;
  /** Время чтения */
  readingTime: number;
}
