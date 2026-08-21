import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getNewsByCategory, getActiveNewsCategories } from '@/lib/news/get-news';
import { site } from '@/config/site';
import { NEWS_CATEGORY_LABELS, NEWS_CATEGORIES } from '@/types/news';
import type { NewsCategory } from '@/types/news';
import Link from 'next/link';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getActiveNewsCategories().map(cat => ({ slug: cat }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!NEWS_CATEGORIES.includes(slug as NewsCategory)) return {};
  const label = NEWS_CATEGORY_LABELS[slug as NewsCategory];
  return {
    title: `Новости ${label} | AI-Sphere`,
    description: `Последние новости и обновления ${label}: релизы, обновления, тесты и события.`,
    robots: { index: true, follow: true },
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default async function NewsCategoryPage({ params }: Props) {
  const { slug } = await params;

  if (!NEWS_CATEGORIES.includes(slug as NewsCategory)) notFound();

  const category = slug as NewsCategory;
  const articles = getNewsByCategory(category);
  const label = NEWS_CATEGORY_LABELS[category];

  return (
    <>
      <Header />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 80px' }}>
        <nav style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>
          <Link href="/news" style={{ color: '#0066ff', textDecoration: 'none' }}>Новости</Link>
          {' / '}
          <span style={{ color: '#666' }}>{label}</span>
        </nav>

        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Новости {label}</h1>
        <p style={{ fontSize: 16, color: '#666', marginBottom: 32, lineHeight: 1.5 }}>
          Все новости и обновления по теме {label}
        </p>

        {articles.length === 0 && (
          <p style={{ color: '#999', fontSize: 16 }}>Новости в этой категории скоро появятся</p>
        )}

        {articles.map(article => (
          <article key={article.slug} style={{
            padding: '24px 0', borderBottom: '1px solid #eee',
          }}>
            <Link href={article.url} style={{ textDecoration: 'none' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000', marginBottom: 8, lineHeight: 1.3 }}>
                {article.title}
              </h2>
            </Link>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 8 }}>
              {article.description}
            </p>
            <div style={{ fontSize: 12, color: '#999', display: 'flex', gap: 12 }}>
              <span>{formatDate(article.datePublished)}</span>
              <span>{article.author}</span>
              <span>{article.readingTime} мин чтения</span>
            </div>
          </article>
        ))}
      </main>
      <Footer />
    </>
  );
}
