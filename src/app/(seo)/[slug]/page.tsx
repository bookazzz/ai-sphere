import { Metadata } from 'next';
import { getAllSeoSlugs, getSeoContent } from '@/content/seo';
import SeoPage from '@/components/seo/SeoPage';
import { site } from '@/config/site';
import { notFound } from 'next/navigation';
import { absoluteUrl, seoDescription, seoTitle } from '@/lib/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return getAllSeoSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const content = getSeoContent(slug);
  if (!content) return {};

  const canonical = absoluteUrl(content.canonical || `/${content.slug}`);
  const h1 = content.h1 || content.hero?.title || content.title;
  const description = seoDescription(content.metaDescription || content.description);
  const indexable = content.index !== false && content.contentStatus === 'ready';

  return {
    title: seoTitle(content.seoTitle || content.title || h1),
    description,
    robots: {
      index: indexable,
      follow: indexable,
      'max-image-preview': 'large',
    },
    alternates: {
      canonical,
    },
    openGraph: {
      title: content.ogTitle || h1,
      description,
      url: canonical,
      siteName: 'AI-Sphere',
      locale: 'ru_RU',
      type: 'website',
      images: [{
        url: content.image || site.ogImage,
        alt: content.imageAlt || h1,
      }],
    },
  };
}

export default async function SeoPageRoute({ params }: Props) {
  const { slug } = await params;
  const content = getSeoContent(slug);
  if (!content) notFound();

  return <SeoPage content={content} />;
}
