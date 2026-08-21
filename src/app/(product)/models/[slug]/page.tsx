import { Metadata } from 'next';
import { getModelHub, getAllModelHubSlugs } from '@/content/models';
import { site } from '@/config/site';
import { notFound } from 'next/navigation';
import ModelPageClient from '@/components/ModelPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return getAllModelHubSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const model = getModelHub(slug);
  if (!model) return {};

  return {
    title: `${model.name}: характеристики, цена и возможности | AI-Sphere`,
    description: model.metaDesc,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${site.url}/models/${model.slug}/`,
    },
    openGraph: {
      title: `${model.h1} | AI-Sphere`,
      description: model.metaDesc,
      url: `${site.url}/models/${model.slug}/`,
      siteName: 'AI-Sphere',
      locale: 'ru_RU',
      type: 'website',
    },
  };
}

export default async function ModelHubPage({ params }: Props) {
  const { slug } = await params;
  const model = getModelHub(slug);
  if (!model) notFound();

  return <ModelPageClient model={model} />;
}
