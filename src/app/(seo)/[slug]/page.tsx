import { Metadata } from 'next';
import { getAllSeoSlugs, getSeoContent } from '@/content/seo';
import SeoPage from '@/components/seo/SeoPage';
import { site } from '@/config/site';
import { notFound } from 'next/navigation';

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

  const canonicalRaw = content.canonical || `${site.url}/${content.slug}`;
  const canonical = canonicalRaw.endsWith('/') ? canonicalRaw : `${canonicalRaw}/`;
  const h1 = content.h1 || content.hero?.title || content.title;

  return {
    title: `${h1} | AI-Sphere`,
    description: content.description,
    robots: {
      index: content.index !== false,
      follow: true,
    },
    alternates: {
      canonical,
    },
    openGraph: {
      title: content.ogTitle || h1,
      description: content.description,
      url: canonical,
      siteName: 'AI-Sphere',
      locale: 'ru_RU',
      type: 'website',
    },
    other: {
      'og:image': 'https://ai-sphere.ru/og-image.png',
    },
  };
}

export default async function SeoPageRoute({ params }: Props) {
  const { slug } = await params;
  const content = getSeoContent(slug);
  if (!content) notFound();

  return <SeoPage content={content} />;
}
