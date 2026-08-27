import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BlogPost from '@/components/blog/BlogPost';
import { getBlogPost, getAllBlogSlugs } from '@/lib/blog/get-posts';
import { CATEGORY_LABELS, getSchemaType } from '@/types/blog-post';
import { site } from '@/config/site';
import { absoluteUrl, schemaAuthor, seoDescription, seoTitle } from '@/lib/seo';

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

  const canonical = absoluteUrl(post.canonical || `/blog/${category}/${slug}`);
  const h1 = post.h1 || post.title;
  const description = seoDescription(post.description);

  return {
    title: seoTitle(post.seoTitle || post.title),
    description,
    robots: {
      index: post.index,
      follow: true,
    },
    alternates: {
      canonical,
    },
    openGraph: {
      title: h1,
      description,
      url: canonical,
      siteName: 'AI-Sphere',
      locale: 'ru_RU',
      type: 'article',
      images: [{ url: post.image || site.ogImage, alt: post.imageAlt || h1 }],
      ...(post.date && {
        article: {
          publishedTime: new Date(post.date).toISOString(),
          ...(post.updatedAt && {
            modifiedTime: new Date(post.updatedAt).toISOString(),
          }),
        },
      }),
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
    headline: post.h1 || post.title,
    description: post.description,
    author: schemaAuthor(post.author),
    datePublished: post.date,
    ...(post.updatedAt && { dateModified: post.updatedAt }),
    publisher: {
      '@type': 'Organization',
      '@id': `${site.url}/#organization`,
      name: 'AI-Sphere',
      url: site.url,
      logo: { '@type': 'ImageObject', url: `${site.url}/logo.png` },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(post.canonical || `/blog/${category}/${slug}`),
    },
    image: post.image || site.ogImage,
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
