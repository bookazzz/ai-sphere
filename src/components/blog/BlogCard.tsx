'use client';

import Link from 'next/link';
import type { BlogPost } from '@/types/blog-post';
import { CATEGORY_LABELS } from '@/types/blog-post';

interface Props {
  post: BlogPost;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BlogCard({ post }: Props) {
  return (
    <article
      style={{
        background: 'var(--bg-secondary, #fff)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
    >
      <Link
        href={post.url}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div style={{ padding: 24 }}>
          {/* Категория */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              color: '#0066ff',
              letterSpacing: 1,
            }}
          >
            {CATEGORY_LABELS[post.category]}
          </span>

          {/* Заголовок */}
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginTop: 8,
              marginBottom: 8,
              lineHeight: 1.4,
              color: 'var(--text-primary, #000)',
            }}
          >
            {post.title}
          </h2>

          {/* Описание */}
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-secondary, #666)',
              lineHeight: 1.6,
              marginBottom: 16,
            }}
          >
            {post.description}
          </p>

          {/* Мета */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              color: '#999',
            }}
          >
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.readingTime && (
              <span>{post.readingTime} мин чтения</span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
