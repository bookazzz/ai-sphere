import Link from 'next/link';
import type { BlogPost as BlogPostType } from '@/types/blog-post';
import { CATEGORY_LABELS } from '@/types/blog-post';
import MarkdownRenderer from './MarkdownRenderer';

interface Props {
  post: BlogPostType;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BlogPost({ post }: Props) {
  return (
    <article
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '40px 20px 80px',
      }}
    >
      {/* Хлебные крошки */}
      <nav
        style={{
          fontSize: 13,
          color: '#999',
          marginBottom: 24,
        }}
      >
        <Link
          href="/blog"
          style={{ color: '#0066ff', textDecoration: 'none' }}
        >
          Блог
        </Link>
        {' / '}
        <Link
          href={`/blog/${post.category}`}
          style={{ color: '#0066ff', textDecoration: 'none' }}
        >
          {CATEGORY_LABELS[post.category]}
        </Link>
        {' / '}
        <span style={{ color: '#666' }}>{post.title}</span>
      </nav>

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
      <h1
        style={{
          fontSize: 36,
          fontWeight: 700,
          lineHeight: 1.3,
          marginTop: 8,
          marginBottom: 16,
          color: '#000',
        }}
      >
        {post.title}
      </h1>

      {/* Метаинформация */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          fontSize: 14,
          color: '#999',
          marginBottom: 32,
          flexWrap: 'wrap',
        }}
      >
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        {post.readingTime && <span>{post.readingTime} мин чтения</span>}
        <span>Автор: {post.author}</span>
      </div>

      {/* Источники */}
      {post.sourceUrls && post.sourceUrls.length > 0 && (
        <div
          style={{
            fontSize: 13,
            color: '#999',
            marginBottom: 24,
            padding: '12px 16px',
            background: '#f8f8f8',
            borderRadius: 8,
          }}
        >
          <strong>Источники:</strong>{' '}
          {post.sourceUrls.map((url, i) => (
            <span key={url}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0066ff' }}
              >
                {new URL(url).hostname.replace('www.', '')}
              </a>
              {i < post.sourceUrls!.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Контент */}
      <MarkdownRenderer content={post.content} />

      {/* Теги */}
      {post.tags && post.tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginTop: 48,
            paddingTop: 32,
            borderTop: '1px solid #eee',
          }}
        >
          {post.tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: '4px 12px',
                background: '#f0f0f0',
                borderRadius: 16,
                fontSize: 12,
                color: '#666',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <div
        style={{
          marginTop: 48,
          padding: '32px',
          background: 'linear-gradient(135deg, #0066ff 0%, #0044cc 100%)',
          borderRadius: 16,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 12,
          }}
        >
          Попробуйте сами
        </p>
        <p
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.8)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Задайте вопрос любой нейросети прямо сейчас — без VPN и иностранной
          карты
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '14px 36px',
            background: '#fff',
            color: '#0066ff',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 16,
            textDecoration: 'none',
          }}
        >
          Начать чат
        </a>
      </div>
    </article>
  );
}
