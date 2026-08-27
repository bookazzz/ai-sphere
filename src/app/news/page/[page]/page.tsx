import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NewsArchive from '@/components/news/NewsArchive';
import { getNewsArchive, getNewsPage, NEWS_PAGE_SIZE } from '@/lib/news/pagination';
import { site } from '@/config/site';
import type { NewsCategory } from '@/types/news';

interface Props { params: Promise<{ page: string }> }

export function generateStaticParams() {
  const total = Math.ceil(getNewsArchive().length / NEWS_PAGE_SIZE);
  return Array.from({ length: Math.max(0, total - 1) }, (_, index) => ({ page: String(index + 2) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = Number((await params).page);
  const total = Math.ceil(getNewsArchive().length / NEWS_PAGE_SIZE);
  if (!Number.isInteger(page) || page < 2 || page > total) return {};
  const canonical = `${site.url}/news/page/${page}/`;
  const description = `Архив проверенных новостей об искусственном интеллекте и нейросетях. Страница ${page} из ${total}: модели, компании, исследования и AI-инструменты.`;
  return {
    title: `Новости нейросетей — страница ${page} | AI-Sphere`,
    description,
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    alternates: { canonical },
    openGraph: { title: `Новости нейросетей — страница ${page}`, description, url: canonical, siteName: site.name, locale: site.locale, type: 'website' },
  };
}

export default async function NewsArchivePage({ params }: Props) {
  const requested = Number((await params).page);
  const archive = getNewsPage(requested);
  if (!Number.isInteger(requested) || requested < 2 || requested !== archive.page) notFound();
  const categories = [...new Set(getNewsArchive().map((article) => article.category))] as NewsCategory[];
  return <><Header /><NewsArchive {...archive} categories={categories} /><Footer /></>;
}
