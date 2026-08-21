import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BlogList from '@/components/blog/BlogList';
import BlogCategoryTabs from '@/components/blog/BlogCategoryTabs';
import { getAllBlogPosts, getActiveCategories } from '@/lib/blog/get-posts';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: 'Блог AI-Sphere — новости, гайды и статьи о нейросетях',
  description:
    'Полезные статьи о нейросетях, ChatGPT, Claude, Gemini, DeepSeek и других AI-моделях. Гайды по работе с нейросетями, обзоры моделей, новости мира искусственного интеллекта.',
  openGraph: {
    title: 'Блог AI-Sphere — новости, гайды и статьи о нейросетях',
    description:
      'Полезные статьи о нейросетях, ChatGPT, Claude, Gemini, DeepSeek и других AI-моделях. Гайды, обзоры, новости мира искусственного интеллекта.',
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
      <main>
        <section
          style={{
            padding: '60px 20px 40px',
            textAlign: 'center',
            background:
              'linear-gradient(135deg, var(--bg-secondary, #f8f9fa) 0%, var(--bg-primary, #fff) 100%)',
          }}
        >
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 700,
                marginBottom: 16,
                color: 'var(--text-primary, #000)',
              }}
            >
              Блог AI-Sphere
            </h1>
            <p
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

        <section style={{ padding: '40px 20px 80px' }}>
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
