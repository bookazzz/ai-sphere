import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAllNews } from '@/lib/news/get-news';
import { site } from '@/config/site';
import Link from 'next/link';
import { NEWS_CATEGORY_LABELS } from '@/types/news';
import type { NewsCategory } from '@/types/news';

export const metadata: Metadata = {
  title: 'Новости AI | AI-Sphere',
  description: 'Последние новости из мира искусственного интеллекта, нейросетей, языковых моделей и AI-технологий.',
  robots: { index: true, follow: true, 'max-image-preview': 'large' as const },
  openGraph: {
    title: 'Новости AI | AI-Sphere',
    description: 'Последние новости из мира искусственного интеллекта, нейросетей, языковых моделей и AI-технологий.',
    url: `${site.url}/news`,
    siteName: 'AI-Sphere',
    locale: 'ru_RU',
    type: 'website',
  },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function NewsListPage() {
  const articles = getAllNews('ready');
  const categories = [...new Set(articles.map(a => a.category))] as NewsCategory[];

  return (
    <>
      <Header />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 80px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>Новости AI</h1>
        <p style={{ fontSize: 16, color: '#666', marginBottom: 32, lineHeight: 1.5 }}>
          Последние новости из мира искусственного интеллекта, нейросетей и AI-технологий
        </p>

        {/* Category filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 40 }}>
          <span style={{
            padding: '6px 14px', background: '#0066ff', color: '#fff', borderRadius: 20,
            fontSize: 13, fontWeight: 600,
          }}>
            Все
          </span>
          {categories.map(cat => (
            <Link key={cat} href={`/news/category/${cat}`} style={{
              padding: '6px 14px', background: '#f0f0f0', color: '#333', borderRadius: 20,
              fontSize: 13, textDecoration: 'none',
            }}>
              {NEWS_CATEGORY_LABELS[cat]}
            </Link>
          ))}
        </div>

        {/* Articles list */}
        {articles.length === 0 && (
          <p style={{ color: '#999', fontSize: 16 }}>Новости скоро появятся</p>
        )}

        {articles.map(article => (
          <article key={article.slug} style={{
            padding: '24px 0', borderBottom: '1px solid #eee',
          }}>
            <div style={{ fontSize: 12, color: '#0066ff', fontWeight: 600, marginBottom: 4 }}>
              {NEWS_CATEGORY_LABELS[article.category]}
            </div>
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

        {/* Link to main blog */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <Link href="/blog" style={{ color: '#0066ff', fontSize: 14 }}>
            Перейти в блог →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
