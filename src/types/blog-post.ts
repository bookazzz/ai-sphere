export type BlogCategory = 'guides' | 'reviews' | 'analysis' | 'cases';
export type BlogStatus = 'draft' | 'review' | 'ready';

export interface BlogPostMeta {
  title: string;
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
  guides: 'Пошаговые инструкции и гайды по работе с AI-моделями',
  reviews: 'Сравнения и обзоры популярных нейросетей',
  analysis: 'Глубокий анализ трендов и развития AI-индустрии',
  cases: 'Реальные кейсы использования нейросетей в бизнесе и жизни',
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
