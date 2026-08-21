'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { NewsArticle } from '@/types/news';
import { NEWS_CATEGORY_LABELS } from '@/types/news';

interface Props {
  title?: string;
  categories?: string[];
  models?: string[];
  limit?: number;
}

export default function RelatedNews({ title = 'Последние новости', categories = [], models = [], limit = 4 }: Props) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (categories.length) params.set('categories', categories.join(','));
    if (models.length) params.set('models', models.join(','));
    params.set('limit', String(limit));

    fetch(`/api/news?${params.toString()}`)
      .then(r => r.json())
      .then(data => setArticles(Array.isArray(data) ? data.slice(0, limit) : []))
      .catch(() => setArticles([]));
  }, [categories.join(','), models.join(','), limit]);

  if (articles.length === 0) return null;

  return (
    <div style={{ marginTop: 48, padding: '24px 0', borderTop: '1px solid #eee' }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#000' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {articles.map(a => (
          <Link
            key={a.slug}
            href={a.url}
            style={{ textDecoration: 'none', display: 'block', padding: '12px 16px', borderRadius: 8, background: '#f8f8f8', transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f8f8f8')}
          >
            <div style={{ fontSize: 12, color: '#0066ff', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {NEWS_CATEGORY_LABELS[a.category] || a.category}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#222', lineHeight: 1.4 }}>
              {a.title}
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              {new Date(a.datePublished).toLocaleDateString('ru-RU')} · {a.readingTime} мин
            </div>
          </Link>
        ))}
      </div>
      <Link href="/news/"
        style={{ display: 'inline-block', marginTop: 12, fontSize: 14, color: '#0066ff', fontWeight: 600, textDecoration: 'none' }}>
        Все новости →
      </Link>
    </div>
  );
}
