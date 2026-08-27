import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: 'Все нейросети в одном месте — AI-Sphere',
  description:
    'Чат с нейросетями для текста, документов, изображений и видео. AI-Sphere подбирает подходящую модель, показывает стоимость и работает без подписки.',
  alternates: { canonical: `${site.url}/` },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
  },
  openGraph: {
    title: 'Все нейросети в одном месте — AI-Sphere',
    description:
      'Решайте задачи с AI в одном интерфейсе: текст, документы, изображения и видео.',
    url: `${site.url}/`,
    siteName: site.name,
    locale: site.locale,
    type: 'website',
    images: [{ url: site.ogImage, width: 1200, height: 630, alt: 'AI-Sphere' }],
  },
};

export default function HomePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${site.url}/#organization`,
        name: site.name,
        url: `${site.url}/`,
        logo: {
          '@type': 'ImageObject',
          url: `${site.url}/logo.png`,
        },
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'goorujke@yandex.ru',
          contactType: 'customer support',
          availableLanguage: 'Russian',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${site.url}/#website`,
        name: site.name,
        alternateName: 'AI Sphere',
        url: `${site.url}/`,
        inLanguage: 'ru-RU',
        publisher: { '@id': `${site.url}/#organization` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${site.url}/#application`,
        name: site.name,
        url: `${site.url}/`,
        description:
          'Веб-приложение для работы с нейросетями: текстом, документами, изображениями и видео.',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        publisher: { '@id': `${site.url}/#organization` },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomeClient />
    </>
  );
}
