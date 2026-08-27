import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BlogList from '@/components/blog/BlogList';
import BlogCategoryTabs from '@/components/blog/BlogCategoryTabs';
import { getBlogPostsByCategory, getActiveCategories } from '@/lib/blog/get-posts';
import { type BlogCategory, CATEGORY_LABELS, CATEGORY_DESCRIPTIONS } from '@/types/blog-post';
import { site } from '@/config/site';
import { seoDescription, seoTitle } from '@/lib/seo';

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return getActiveCategories().map((cat) => ({ category: cat }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;

  if (!(category in CATEGORY_LABELS)) return {};

  const label = CATEGORY_LABELS[category as BlogCategory];
  const description = CATEGORY_DESCRIPTIONS[category as BlogCategory];

  return {
    title: seoTitle(`${label}: статьи о нейросетях`),
    description: seoDescription(description),
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    alternates: { canonical: `${site.url}/blog/${category}/` },
    openGraph: {
      title: `${label} — блог AI-Sphere`,
      description: seoDescription(description),
      url: `${site.url}/blog/${category}/`,
      siteName: site.name,
      locale: site.locale,
      type: 'website',
    },
  };
}

export default async function BlogCategoryPage({ params }: Props) {
  const { category } = await params;

  if (!(category in CATEGORY_LABELS)) {
    notFound();
  }

  const posts = getBlogPostsByCategory(category);
  const categories = getActiveCategories();
  const label = CATEGORY_LABELS[category as BlogCategory];

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
              {label}
            </h1>
            <p
              style={{
                fontSize: 16,
                color: 'var(--text-secondary, #666)',
                lineHeight: 1.6,
              }}
            >
              {CATEGORY_DESCRIPTIONS[category as BlogCategory]}
            </p>
          </div>
        </section>

        <section style={{ padding: '40px 20px 80px' }}>
          <BlogCategoryTabs
            categories={categories}
            activeCategory={category}
          />
          <BlogList posts={posts} />
        </section>
      </main>
      <Footer />
    </>
  );
}
