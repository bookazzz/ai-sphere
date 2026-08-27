import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BlogList from '@/components/blog/BlogList';
import BlogCategoryTabs from '@/components/blog/BlogCategoryTabs';
import { getAllBlogPosts, getActiveCategories } from '@/lib/blog/get-posts';
import { site } from '@/config/site';
import { seoDescription } from '@/lib/seo';

const blogDescription = 'Практические руководства по ChatGPT, Claude, Gemini, DeepSeek и другим нейросетям: выбор моделей, работа с текстом, кодом, файлами и изображениями.';

export const metadata: Metadata = {
  title: 'Блог о нейросетях и AI-инструментах | AI-Sphere',
  description: seoDescription(blogDescription),
  alternates: { canonical: `${site.url}/blog/` },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  openGraph: {
    title: 'Блог AI-Sphere — новости, гайды и статьи о нейросетях',
    description: seoDescription(blogDescription),
    url: `${site.url}/blog/`,
  },
};

export default function BlogPage() {
  const posts = getAllBlogPosts('ready');
  const categories = getActiveCategories();

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'AI-Sphere', item: site.url },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Блог',
        item: `${site.url}/blog`,
      },
    ],
  };

  return (
    <>
      <Header />
      <main className="blog-page">
        <section className="blog-hero"
          style={{
            padding: '60px 20px 40px',
            textAlign: 'center',
            background:
              'linear-gradient(135deg, var(--bg-secondary, #f8f9fa) 0%, var(--bg-primary, #fff) 100%)',
          }}
        >
          <div className="blog-hero__inner" style={{ maxWidth: 700, margin: '0 auto' }}>
            <div className="blog-hero__eyebrow">AI SPHERE / JOURNAL</div>
            <h1 className="blog-hero__title"
              style={{
                fontSize: 36,
                fontWeight: 700,
                marginBottom: 16,
                color: 'var(--text-primary, #000)',
              }}
            >
              Блог AI-Sphere
            </h1>
            <p className="blog-hero__subtitle"
              style={{
                fontSize: 16,
                color: 'var(--text-secondary, #666)',
                lineHeight: 1.6,
              }}
            >
              Полезные статьи, новости и гайды о нейросетях и искусственном
              интеллекте. Узнайте, как использовать AI для работы и жизни.
            </p>
          </div>
        </section>

        <section className="blog-content" style={{ padding: '40px 20px 80px' }}>
          <BlogCategoryTabs categories={categories} />
          <BlogList posts={posts} />
        </section>
      </main>
      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
    </>
  );
}
