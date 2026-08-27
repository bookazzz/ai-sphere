import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getNewsArticle, getAllNewsSlugs } from '@/lib/news/get-news';
import { site } from '@/config/site';
import { NEWS_CATEGORY_LABELS } from '@/types/news';
import { getModelLink, getCompanyLink, getPageLink } from '@/lib/entity-links';
import Link from 'next/link';
import MarkdownRenderer from '@/components/blog/MarkdownRenderer';
import { absoluteUrl, schemaAuthor, seoDescription, seoTitle } from '@/lib/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllNewsSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getNewsArticle(slug);
  if (!article || article.status !== 'ready') return {};

  const canonical = absoluteUrl(article.canonical || article.url);
  const description = seoDescription(article.description);

  return {
    title: seoTitle(article.seoTitle || article.title),
    description,
    robots: {
      index: article.index,
      follow: true,
      'max-image-preview': 'large' as const,
    },
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description,
      url: canonical,
      siteName: 'AI-Sphere',
      locale: 'ru_RU',
      type: 'article',
      images: [{ url: article.image || site.ogImage, alt: article.imageAlt || article.title }],
      ...(article.datePublished && {
        article: {
          publishedTime: new Date(article.datePublished).toISOString(),
          ...(article.dateModified && {
            modifiedTime: new Date(article.dateModified).toISOString(),
          }),
        },
      }),
    },
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function NewsArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getNewsArticle(slug);
  if (!article || article.status !== 'ready') notFound();

  const articleUrl = absoluteUrl(article.canonical || article.url);
  const images = article.image ? [article.image] : [site.ogImage];

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    headline: article.title,
    description: article.description,
    image: images,
    datePublished: new Date(article.datePublished).toISOString(),
    ...(article.dateModified && {
      dateModified: new Date(article.dateModified).toISOString(),
    }),
    author: schemaAuthor(article.author),
    publisher: {
      '@type': 'Organization',
      '@id': `${site.url}/#organization`,
      name: 'AI-Sphere',
      logo: {
        '@type': 'ImageObject',
        url: `${site.url}/logo.png`,
      },
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'AI-Sphere', item: site.url },
      { '@type': 'ListItem', position: 2, name: 'Новости', item: `${site.url}/news` },
      { '@type': 'ListItem', position: 3, name: article.title, item: articleUrl },
    ],
  };

  return (
    <>
      <Header />
      <main>
        <article style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px' }}>
          {/* Breadcrumbs */}
          <nav style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>
            <Link href="/news" style={{ color: '#0066ff', textDecoration: 'none' }}>Новости</Link>
            {' / '}
            <Link
              href={`/news/category/${article.category}`}
              style={{ color: '#0066ff', textDecoration: 'none' }}
            >
              {NEWS_CATEGORY_LABELS[article.category]}
            </Link>
            {' / '}
            <span style={{ color: '#666' }}>{article.title}</span>
          </nav>

          {/* Category badge */}
          <Link
            href={`/news/category/${article.category}`}
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              color: '#0066ff',
              letterSpacing: 1,
              textDecoration: 'none',
            }}
          >
            {NEWS_CATEGORY_LABELS[article.category]}
          </Link>

          {/* H1 */}
          <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.3, marginTop: 8, marginBottom: 16, color: '#000' }}>
            {article.title}
          </h1>

          {/* Meta bar */}
          <div style={{ display: 'flex', gap: 16, fontSize: 14, color: '#999', marginBottom: 8, flexWrap: 'wrap' }}>
            <span>Автор: {article.author}</span>
            <time dateTime={article.datePublished}>{formatDate(article.datePublished)}</time>
            {article.dateModified && <span>· обновлено {formatDate(article.dateModified)}</span>}
            <span>· {article.readingTime} мин чтения</span>
          </div>

          {/* Sources */}
          {article.sourceUrls.length > 0 && (
            <div style={{ fontSize: 13, color: '#999', marginBottom: 24, padding: '12px 16px', background: '#f8f8f8', borderRadius: 8 }}>
              <strong>Источники:</strong>{' '}
              {article.sourceUrls.map((url, i) => (
                <span key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066ff' }}>
                    {new URL(url).hostname.replace('www.', '')}
                  </a>
                  {i < article.sourceUrls.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Summary / Главное block */}
          <div style={{
            background: '#f0f6ff',
            borderLeft: '4px solid #0066ff',
            borderRadius: 4,
            padding: '16px 20px',
            marginBottom: 32,
            fontSize: 15,
            lineHeight: 1.6,
            color: '#333',
          }}>
            {article.summary}
          </div>

          {/* Content */}
          <MarkdownRenderer content={article.content} />

          {/* Tags */}
          {article.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 48, paddingTop: 32, borderTop: '1px solid #eee' }}>
              {article.tags.map(tag => (
                <span key={tag} style={{ padding: '4px 12px', background: '#f0f0f0', borderRadius: 16, fontSize: 12, color: '#666' }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Related links — сущностный граф */}
          {(article.relatedModels?.length || article.relatedCompanies?.length || article.relatedPages?.length) ? (
            <div style={{ marginTop: 32, padding: '20px', background: '#fafafa', borderRadius: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#000' }}>Читайте также</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {article.relatedModels?.map(m => {
                  const link = getModelLink(m);
                  return (
                    <a key={m} href={link.href}
                      style={{ color: '#0066ff', fontSize: 14, textDecoration: 'none' }}>
                      → {link.label}
                      {link.description && <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>{link.description}</span>}
                    </a>
                  );
                })}
                {article.relatedCompanies?.map(c => {
                  const link = getCompanyLink(c);
                  return (
                    <a key={c} href={link.href}
                      style={{ color: '#0066ff', fontSize: 14, textDecoration: 'none' }}>
                      → {link.label}
                      {link.description && <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>{link.description}</span>}
                    </a>
                  );
                })}
                {article.relatedPages?.map(p => {
                  const link = getPageLink(p);
                  return (
                    <a key={p} href={link.href}
                      style={{ color: '#0066ff', fontSize: 14, textDecoration: 'none' }}>
                      → {link.label}
                      {link.description && <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>{link.description}</span>}
                    </a>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* CTA */}
          <div style={{ marginTop: 48, padding: '32px', background: 'linear-gradient(135deg, #0066ff 0%, #0044cc 100%)', borderRadius: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Попробуйте сами</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 20, lineHeight: 1.5 }}>
              Задайте вопрос любой нейросети прямо сейчас — без VPN и иностранной карты
            </p>
            <a href="/" style={{ display: 'inline-block', padding: '14px 36px', background: '#fff', color: '#0066ff', borderRadius: 8, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
              Начать чат
            </a>
          </div>
        </article>
      </main>
      <Footer />

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </>
  );
}
