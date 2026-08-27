import Link from 'next/link';
import type { NewsArticle, NewsCategory } from '@/types/news';
import { NEWS_CATEGORY_LABELS } from '@/types/news';

interface Props {
  articles: NewsArticle[];
  categories: NewsCategory[];
  page: number;
  totalPages: number;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function NewsArchive({ articles, categories, page, totalPages }: Props) {
  const pageHref = (value: number) => value === 1 ? '/news/' : `/news/page/${value}/`;
  return (
    <main className="news-archive" style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 80px' }}>
      <div className="news-archive__eyebrow">AI SPHERE / NEWSROOM</div>
      <h1 className="news-archive__title" style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>
        {page === 1 ? 'Новости искусственного интеллекта' : `Новости искусственного интеллекта — страница ${page}`}
      </h1>
      <p className="news-archive__intro" style={{ fontSize: 16, color: '#666', marginBottom: 32, lineHeight: 1.5 }}>
        Проверенные новости о нейросетях, языковых моделях, AI-агентах и инструментах генерации контента.
      </p>
      <nav className="news-tabs" aria-label="Категории новостей" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 40 }}>
        <Link href="/news/" style={{ padding: '6px 14px', background: '#0066ff', color: '#fff', borderRadius: 20, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Все</Link>
        {categories.map((category) => (
          <Link key={category} href={`/news/category/${category}/`} style={{ padding: '6px 14px', background: '#f0f0f0', color: '#333', borderRadius: 20, fontSize: 13, textDecoration: 'none' }}>
            {NEWS_CATEGORY_LABELS[category]}
          </Link>
        ))}
      </nav>
      {articles.map((article) => (
        <article key={article.slug} className="news-card" style={{ padding: '24px 0', borderBottom: '1px solid #eee' }}>
          <div className="news-card__category" style={{ fontSize: 12, color: '#0066ff', fontWeight: 600, marginBottom: 4 }}>{NEWS_CATEGORY_LABELS[article.category]}</div>
          <Link href={`${article.url}/`} className="news-card__link" style={{ textDecoration: 'none' }}>
            <h2 className="news-card__title" style={{ fontSize: 20, fontWeight: 700, color: '#000', marginBottom: 8, lineHeight: 1.3 }}>{article.title}</h2>
          </Link>
          <p className="news-card__description" style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 8 }}>{article.description}</p>
          <div className="news-card__meta" style={{ fontSize: 12, color: '#999', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <time dateTime={article.datePublished}>{formatDate(article.datePublished)}</time>
            <span>{article.author}</span>
            <span>{article.readingTime} мин чтения</span>
          </div>
        </article>
      ))}
      {totalPages > 1 && (
        <nav className="news-pagination" aria-label="Страницы новостей" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 40 }}>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((value) => (
            <Link key={value} href={pageHref(value)} aria-current={value === page ? 'page' : undefined} style={{ minWidth: 40, padding: '8px 12px', textAlign: 'center', borderRadius: 8, textDecoration: 'none', background: value === page ? '#0066ff' : '#f0f0f0', color: value === page ? '#fff' : '#333' }}>
              {value}
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}
