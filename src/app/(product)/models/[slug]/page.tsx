import { Metadata } from 'next';
import { getModelHub, getAllModelHubSlugs } from '@/content/models';
import { site } from '@/config/site';
import { notFound } from 'next/navigation';
import ModelPageClient from '@/components/ModelPage';
import { seoDescription, seoTitle } from '@/lib/seo';

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
    title: seoTitle(`${model.name}: характеристики и возможности`),
    description: seoDescription(model.metaDesc),
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

  const url = `${site.url}/models/${model.slug}/`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': `${url}#application`,
        name: model.name,
        description: model.description,
        url,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any',
        publisher: { '@type': 'Organization', name: model.providerName },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: `${site.url}/` },
          { '@type': 'ListItem', position: 2, name: 'Модели', item: `${site.url}/models/` },
          { '@type': 'ListItem', position: 3, name: model.name, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <ModelPageClient model={model} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}
