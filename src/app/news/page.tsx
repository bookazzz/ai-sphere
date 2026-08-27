import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NewsArchive from '@/components/news/NewsArchive';
import { getNewsArchive, getNewsPage } from '@/lib/news/pagination';
import { site } from '@/config/site';
import type { NewsCategory } from '@/types/news';

const description = 'Проверенные новости об искусственном интеллекте, нейросетях, языковых моделях, AI-агентах и инструментах генерации контента.';

export const metadata: Metadata = {
  title: 'Новости искусственного интеллекта и нейросетей | AI-Sphere',
  description,
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  alternates: { canonical: `${site.url}/news/` },
  openGraph: { title: 'Новости искусственного интеллекта и нейросетей | AI-Sphere', description, url: `${site.url}/news/`, siteName: site.name, locale: site.locale, type: 'website' },
};

export default function NewsListPage() {
  const archive = getNewsPage(1);
  const categories = [...new Set(getNewsArchive().map((article) => article.category))] as NewsCategory[];
  return <><Header /><NewsArchive {...archive} categories={categories} /><Footer /></>;
}
