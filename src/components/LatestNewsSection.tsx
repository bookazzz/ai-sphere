import { getAllNews } from '@/lib/news/get-news';
import { NEWS_CATEGORY_LABELS } from '@/types/news';
import Link from 'next/link';

export function LatestNewsSection() {
  const articles = getAllNews('ready').slice(0, 4);

  if (articles.length === 0) return null;

  return (
    <section style={{ padding: '40px 20px 60px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ borderTop: '1px solid #eee', paddingTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#000', margin: 0 }}>
            Последние новости AI
          </h2>
          <Link href="/news/"
            style={{ fontSize: 14, color: '#0066ff', fontWeight: 600, textDecoration: 'none' }}>
            Все новости →
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {articles.map(a => (
            <Link
              key={a.slug}
              href={a.url}
              style={{
                textDecoration: 'none',
                padding: 20,
                borderRadius: 12,
                background: '#f8f9fa',
                border: '1px solid #eee',
                transition: 'box-shadow 0.2s, transform 0.2s',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: 11, color: '#0066ff', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                {NEWS_CATEGORY_LABELS[a.category] || a.category}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#222', lineHeight: 1.4, marginBottom: 8 }}>
                {a.title}
              </div>
              <div style={{ fontSize: 13, color: '#888', lineHeight: 1.5, marginBottom: 12, flex: 1 }}>
                {a.description}
              </div>
              <div style={{ fontSize: 11, color: '#aaa' }}>
                {new Date(a.datePublished).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}{a.readingTime} мин
              </div>
            </Link>
          ))}
        </div>
        {/* Entity links — быстрые ссылки на категории новостей */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
          <span style={{ fontSize: 12, color: '#999', padding: '4px 0' }}>Новости по темам:</span>
          <Link href="/news/category/openai/" style={{ fontSize: 12, color: '#0066ff', textDecoration: 'none', padding: '4px 10px', background: '#f0f4ff', borderRadius: 12 }}>OpenAI</Link>
          <Link href="/news/category/anthropic/" style={{ fontSize: 12, color: '#0066ff', textDecoration: 'none', padding: '4px 10px', background: '#f0f4ff', borderRadius: 12 }}>Anthropic</Link>
          <Link href="/news/category/google-gemini/" style={{ fontSize: 12, color: '#0066ff', textDecoration: 'none', padding: '4px 10px', background: '#f0f4ff', borderRadius: 12 }}>Google / Gemini</Link>
          <Link href="/news/category/llm/" style={{ fontSize: 12, color: '#0066ff', textDecoration: 'none', padding: '4px 10px', background: '#f0f4ff', borderRadius: 12 }}>LLM</Link>
          <Link href="/news/category/ai-agents/" style={{ fontSize: 12, color: '#0066ff', textDecoration: 'none', padding: '4px 10px', background: '#f0f4ff', borderRadius: 12 }}>AI-агенты</Link>
        </div>
      </div>
    </section>
  );
}
