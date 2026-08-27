'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiCall } from '@/lib/api';

interface PageData {
  slug: string;
  page_type: string;
  title: string;
  h1: string;
  subtitle: string;
  content: any;
  author: string | null;
  meta_title: string;
  meta_description: string;
  cta_text: string;
  cta_link: string;
  published_at: string | null;
  updated_at: string | null;
}

interface Props {
  slug: string;
  /** Показать CTA-блок внизу */
  showCta?: boolean;
  /** Кастомный fallback-контент, если API недоступен */
  fallback?: React.ReactNode;
  /** Показать автора и дату */
  showMeta?: boolean;
}

function isJsonContent(str: string): boolean {
  const t = str.trim();
  return t.startsWith('[') || t.startsWith('{');
}

function renderContent(content: any): React.ReactNode {
  if (!content) return null;

  // HTML from Quill editor
  if (typeof content === 'string') {
    // Try JSON sections (backward compat with old SEO articles)
    if (isJsonContent(content)) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed.map((section: any, i: number) => {
            if (section.type === 'text' || section.type === 'paragraph') {
              return <p key={i} style={{ marginBottom: 16, lineHeight: 1.8 }}>{section.content || section.text || ''}</p>;
            }
            if (section.type === 'heading' || section.type === 'h2') {
              return <h2 key={i} style={{ marginTop: 32, marginBottom: 16, fontSize: 24 }}>{section.content || section.text || ''}</h2>;
            }
            if (section.type === 'list') {
              return <ul key={i} style={{ marginBottom: 16, paddingLeft: 24 }}>{(section.items || []).map((item: string, j: number) => <li key={j} style={{ marginBottom: 8 }}>{item}</li>)}</ul>;
            }
            if (section.type === 'image') {
              return <img key={i} src={section.url || section.src} alt={section.alt || ''} style={{ maxWidth: '100%', borderRadius: 8, margin: '16px 0' }} />;
            }
            return null;
          });
        }
        if (typeof parsed === 'object' && parsed.text) {
          return <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{parsed.text}</p>;
        }
      } catch {}
    }
    // Plain HTML from Quill
    return <div dangerouslySetInnerHTML={{ __html: content }} style={{ lineHeight: 1.8 }} />;
  }

  // Array of sections (already parsed)
  if (Array.isArray(content)) {
    return content.map((section: any, i: number) => {
      if (section.type === 'text' || section.type === 'paragraph') {
        return <p key={i} style={{ marginBottom: 16, lineHeight: 1.8 }}>{section.content || section.text || ''}</p>;
      }
      if (section.type === 'heading' || section.type === 'h2') {
        return <h2 key={i} style={{ marginTop: 32, marginBottom: 16, fontSize: 24 }}>{section.content || section.text || ''}</h2>;
      }
      if (section.type === 'list') {
        return <ul key={i} style={{ marginBottom: 16, paddingLeft: 24 }}>{(section.items || []).map((item: string, j: number) => <li key={j} style={{ marginBottom: 8 }}>{item}</li>)}</ul>;
      }
      return null;
    });
  }

  return null;
}

export default function PublicPageContent({ slug, showCta = true, fallback, showMeta = false }: Props) {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiCall<PageData>(`/public/pages/${encodeURIComponent(slug)}`)
      .then(d => {
        if (!cancelled) { setData(d); setLoading(false); }
      })
      .catch(e => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <section className="page-loading" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>Загрузка...</p>
      </section>
    );
  }

  if (error || !data) {
    if (fallback) return <>{fallback}</>;
    return (
      <section className="page-error" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>{error || 'Страница не найдена'}</p>
      </section>
    );
  }

  const h1 = data.h1 || data.title;

  return (
    <>
      {/* Hero */}
      <section className="page-hero" style={{
        padding: '60px 20px', textAlign: 'center',
        background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
      }}>
        <div className="page-hero__container" style={{ maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
            {h1}
          </h1>
          {data.subtitle && (
            <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 600, margin: '0 auto' }}>
              {data.subtitle}
            </p>
          )}
          {showMeta && data.author && (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 16 }}>
              {data.author}{data.updated_at ? ` • ${new Date(data.updated_at).toLocaleDateString('ru-RU')}` : ''}
            </p>
          )}
        </div>
      </section>

      {/* Content */}
      <section className="page-content" style={{
        padding: '40px 20px 60px',
      }}>
        <div className="page-content__container" style={{
          maxWidth: 800, margin: '0 auto',
          fontSize: 16, color: 'var(--text-primary)',
        }}>
          {renderContent(data.content)}
        </div>
      </section>

      {/* CTA */}
      {showCta && (
        <section className="page-cta" style={{
          padding: '60px 20px', textAlign: 'center',
          background: 'linear-gradient(135deg, var(--accent-dark) 0%, var(--accent) 100%)',
          color: '#fff',
        }}>
          <div className="page-cta__container" style={{ maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
              {data.cta_text || 'Попробуйте прямо сейчас'}
            </h2>
            <p style={{ fontSize: 16, opacity: 0.9, marginBottom: 24, lineHeight: 1.6 }}>
              Зарегистрируйтесь и получите 10 бесплатных кредитов на старте.
              Никаких подписок — платите только за то, что используете.
            </p>
            <Link href={data.cta_link || '/'} style={{
              display: 'inline-block', padding: '14px 36px', borderRadius: 8,
              background: '#fff', color: 'var(--accent-dark)', fontWeight: 600,
              fontSize: 16, textDecoration: 'none', transition: 'transform 0.2s',
            }}>
              {data.cta_text || 'Перейти в чат'}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
