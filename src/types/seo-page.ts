/** Тип SEO-страницы по интенту */
export type SeoPageType =
  | 'model'
  | 'tool'
  | 'use-case'
  | 'guide'
  | 'comparison';

/** Типы секций, доступные для рендера */
export type SectionType =
  | 'introduction'
  | 'capabilities'
  | 'limitations'
  | 'howToRun'
  | 'useCases'
  | 'modelComparison'
  | 'stepByStep'
  | 'promptExamples'
  | 'resultExamples'
  | 'supportedFormats'
  | 'methodology'
  | 'ratingTable'
  | 'recommendations'
  | 'troubleshooting'
  | 'tableOfContents'
  | 'recommendedModels'
  | 'textBlock'
  | 'ctaBlock';

/** Базовая секция */
export interface SeoSection {
  type: SectionType;
  title?: string;
}

/** Текстовая секция (введение, возможности, ограничения и т.д.) */
export interface TextSection extends SeoSection {
  type: 'introduction' | 'capabilities' | 'limitations' | 'howToRun' | 'textBlock';
  title: string;
  text: string;
  items?: string[];
}

/** Список сценариев использования */
export interface UseCasesSection extends SeoSection {
  type: 'useCases';
  title: string;
  cases: { name: string; description: string; models?: string[] }[];
}

/** Сравнение моделей */
export interface ModelComparisonSection extends SeoSection {
  type: 'modelComparison';
  title: string;
  models: { name: string; pros: string[]; cons: string[]; bestFor: string }[];
}

/** Пошаговая инструкция */
export interface StepByStepSection extends SeoSection {
  type: 'stepByStep';
  title: string;
  steps: { title: string; description: string; tip?: string }[];
}

/** Примеры промптов */
export interface PromptExamplesSection extends SeoSection {
  type: 'promptExamples';
  title: string;
  examples: { prompt: string; result: string; note?: string }[];
}

/** Примеры результатов */
export interface ResultExamplesSection extends SeoSection {
  type: 'resultExamples';
  title: string;
  results: { label: string; description: string }[];
}

/** Поддерживаемые форматы */
export interface SupportedFormatsSection extends SeoSection {
  type: 'supportedFormats';
  title: string;
  formats: string[];
  note?: string;
}

/** Методология сравнения */
export interface MethodologySection extends SeoSection {
  type: 'methodology';
  title: string;
  criteria: { name: string; description: string; weight?: number }[];
}

/** Рейтинговая таблица */
export interface RatingTableSection extends SeoSection {
  type: 'ratingTable';
  title: string;
  entries: { name: string; rating: number; pros: string; cons: string; price: string }[];
}

/** Рекомендации */
export interface RecommendationsSection extends SeoSection {
  type: 'recommendations';
  title: string;
  scenarios: { scenario: string; choice: string; reason: string }[];
}

/** Диагностика/ошибки */
export interface TroubleshootingSection extends SeoSection {
  type: 'troubleshooting';
  title: string;
  issues: { problem: string; solution: string }[];
}

/** CTA-блок внутри контента (не путать с глобальным CTA) */
export interface CTABlockSection extends SeoSection {
  type: 'ctaBlock';
  text: string;
  buttonLabel: string;
  buttonHref: string;
}

/** Содержание гайда */
export interface TableOfContentsSection extends SeoSection {
  type: 'tableOfContents';
  items: { label: string; anchor: string }[];
}

/** Рекомендуемые модели */
export interface RecommendedModelsSection extends SeoSection {
  type: 'recommendedModels';
  title: string;
  models: { name: string; description: string; link?: string }[];
}

export type AnySection =
  | TextSection
  | UseCasesSection
  | ModelComparisonSection
  | StepByStepSection
  | PromptExamplesSection
  | ResultExamplesSection
  | SupportedFormatsSection
  | MethodologySection
  | RatingTableSection
  | RecommendationsSection
  | TroubleshootingSection
  | CTABlockSection
  | TableOfContentsSection
  | RecommendedModelsSection;

export interface SeoPageFAQ {
  question: string;
  answer: string;
}

export interface SeoPageHero {
  /** Заголовок для Hero-блока (обычно совпадает с h1) */
  title: string;
  /** Подзаголовок / текст под заголовком */
  text: string;
  /** Текст кнопки CTA */
  ctaText: string;
  /** ID модели для быстрого запуска (опционально) */
  modelId?: string;
}

export interface SeoPageContent {
  slug: string;
  type: SeoPageType;
  title: string;
  description: string;

  // ─── SEO & разметка ───
  /** H1 (если не указан, используется hero.title или title) */
  h1?: string;
  /** Канонический URL (если не указан, site.url + slug) */
  canonical?: string;
  /** Разрешить индексацию (по умолчанию true) */
  index?: boolean;
  /** Родительский slug для хлебных крошек */
  parent?: string;
  /** Хлебные крошки (если не указаны, строятся автоматически) */
  breadcrumbs?: Array<{ title: string; url: string }>;
  /** Дата последнего обновления (ISO) */
  updatedAt?: string;
  /** Автор материала */
  author?: string;

  // ─── Hero-блок (новая структура) ───
  hero?: SeoPageHero;

  // ─── Устаревшие поля (backward compat) ───
  /** @deprecated Используйте hero.title */
  subtitle?: string;
  /** @deprecated Используйте hero.ctaText */
  cta?: string;
  /** @deprecated */
  ctaLink?: string;
  /** @deprecated */
  ctaText?: string;
  ogTitle?: string;

  /** Переопределение Schema.org-типа для JSON-LD (по умолчанию: model→Product, guide→Article и т.д.) */
  schemaType?: 'webPage' | 'article' | 'softwareApplication' | 'product' | 'report' | 'howTo';

  /** Статус готовности контента:
   * draft  → noindex (черновик)
   * review → noindex (на ревью)
   * ready  → index разрешён (согласно полю `index`) */
  contentStatus?: 'draft' | 'review' | 'ready';

  sections: AnySection[];
  faq: SeoPageFAQ[];

  // ─── Связанные страницы ───
  /** Массив slug связанных страниц (новый формат) */
  relatedPages?: string[];
  /** @deprecated Используйте relatedPages */
  related?: Record<string, string>;

  clusterSlug?: string;
  datePublished?: string;
  dateModified?: string;
  category?: string;
}

/** Карта обязательных секций по типу страницы */
export const requiredSections: Record<SeoPageType, SectionType[]> = {
  model: ['capabilities', 'modelComparison', 'limitations', 'howToRun', 'promptExamples'],
  tool: ['stepByStep', 'resultExamples', 'supportedFormats'],
  'use-case': ['useCases', 'promptExamples', 'recommendedModels'],
  guide: ['tableOfContents', 'stepByStep', 'troubleshooting'],
  comparison: ['methodology', 'ratingTable', 'recommendations'],
};
