import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BlogPost from '@/components/blog/BlogPost';
import { getBlogPost, getAllBlogSlugs } from '@/lib/blog/get-posts';
import { CATEGORY_LABELS, getSchemaType } from '@/types/blog-post';
import { site } from '@/config/site';

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateStaticParams() {
  return getAllBlogSlugs();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const post = getBlogPost(category, slug);
  if (!post || post.status !== 'ready') return {};

  const canonical = post.canonical || `${site.url}/blog/${category}/${slug}`;
  const h1 = post.title;

  return {
    title: `${h1} | AI-Sphere`,
    description: post.description,
    robots: {
      index: post.index,
      follow: true,
    },
    alternates: {
      canonical: canonical.endsWith('/') ? canonical : `${canonical}/`,
    },
    openGraph: {
      title: h1,
      description: post.description,
      url: canonical,
      siteName: 'AI-Sphere',
      locale: 'ru_RU',
      type: 'article',
      ...(post.image && { images: [{ url: post.image }] }),
      ...(post.date && {
        article: {
          publishedTime: new Date(post.date).toISOString(),
          ...(post.updatedAt && {
            modifiedTime: new Date(post.updatedAt).toISOString(),
          }),
        },
      }),
    },
    other: {
      'og:image': post.image || 'https://ai-sphere.ru/og-image.png',
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { category, slug } = await params;
  const post = getBlogPost(category, slug);
  if (!post || post.status !== 'ready') notFound();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': getSchemaType(post.category),
    headline: post.title,
    description: post.description,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    datePublished: post.date,
    ...(post.updatedAt && { dateModified: post.updatedAt }),
    publisher: {
      '@type': 'Organization',
      name: 'AI-Sphere',
      url: site.url,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': post.canonical || `${site.url}/blog/${category}/${slug}`,
    },
  };

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
      {
        '@type': 'ListItem',
        position: 3,
        name: CATEGORY_LABELS[post.category],
        item: `${site.url}/blog/${category}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: post.title,
        item: post.canonical || `${site.url}/blog/${category}/${slug}`,
      },
    ],
  };

  return (
    <>
      <Header />
      <main>
        <BlogPost post={post} />
      </main>
      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
    </>
  );
}
