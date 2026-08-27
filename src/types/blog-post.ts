export type BlogCategory = 'guides' | 'reviews' | 'analysis' | 'cases';
export type BlogStatus = 'draft' | 'review' | 'ready';

export interface BlogPostMeta {
  title: string;
  seoTitle?: string;
  h1?: string;
  slug: string;
  category: BlogCategory;
  description: string;
  date: string;
  updatedAt?: string;
  verifiedAt?: string;
  author: string;
  image?: string;
  tags?: string[];
  status: BlogStatus;
  index: boolean;
  canonical?: string;
  relatedSeoPages?: string[];
  relatedPosts?: string[];
  sourceUrls?: string[];
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  searchIntent?: 'commercial' | 'informational' | 'navigational';
  imageAlt?: string;
}

export interface BlogPost extends BlogPostMeta {
  url: string;
  content: string;
  readingTime?: number;
}

export const CATEGORY_LABELS: Record<BlogCategory, string> = {
  guides: 'Гайды',
  reviews: 'Обзоры',
  analysis: 'Аналитика',
  cases: 'Кейсы',
};

export const CATEGORY_DESCRIPTIONS: Record<BlogCategory, string> = {
  guides: 'Пошаговые инструкции по работе с нейросетями: выбор модели, создание текстов и изображений, анализ документов и решение рабочих задач.',
  reviews: 'Подробные обзоры и сравнения популярных нейросетей, их возможностей, ограничений, стоимости и подходящих пользовательских сценариев.',
  analysis: 'Разбор ключевых трендов AI-индустрии, развития языковых моделей, рынка генеративного ИИ и практического влияния новых технологий.',
  cases: 'Практические примеры применения нейросетей в работе, бизнесе и повседневных задачах с понятным процессом и разбором результата.',
};

/** Schema.org тип по категории */
export function getSchemaType(category: BlogCategory): string {
  switch (category) {
    case 'guides': return 'Article';
    case 'reviews': return 'Article';
    case 'analysis': return 'Article';
    case 'cases': return 'Article';
  }
}
