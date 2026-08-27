import { Metadata } from 'next';
import { getCompany, getAllCompanySlugs } from '@/content/companies';
import { site } from '@/config/site';
import { notFound } from 'next/navigation';
import CompanyPageClient from '@/components/CompanyPage';
import { seoDescription, seoTitle } from '@/lib/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return getAllCompanySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const company = getCompany(slug);
  if (!company) return {};

  return {
    title: seoTitle(`${company.name}: модели, продукты и новости`),
    description: seoDescription(company.description),
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${site.url}/company/${company.slug}/`,
    },
    openGraph: {
      title: `${company.name} — модели, продукты и новости | AI-Sphere`,
      description: company.description,
      url: `${site.url}/company/${company.slug}/`,
      siteName: 'AI-Sphere',
      locale: 'ru_RU',
      type: 'website',
    },
  };
}

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const company = getCompany(slug);
  if (!company) notFound();

  const url = `${site.url}/company/${company.slug}/`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${url}#organization`,
        name: company.name,
        url: company.website,
        description: company.description,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: `${site.url}/` },
          { '@type': 'ListItem', position: 2, name: 'Модели', item: `${site.url}/models/` },
          { '@type': 'ListItem', position: 3, name: company.name, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <CompanyPageClient company={company} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}
