import { Metadata } from 'next';
import { getCompany, getAllCompanySlugs } from '@/content/companies';
import { site } from '@/config/site';
import { notFound } from 'next/navigation';
import CompanyPageClient from '@/components/CompanyPage';

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
    title: `${company.name} — модели, продукты и новости | AI-Sphere`,
    description: company.description,
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

  return <CompanyPageClient company={company} />;
}
