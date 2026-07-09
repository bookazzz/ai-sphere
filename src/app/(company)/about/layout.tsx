import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'О компании AI-Sphere — агрегатор нейросетей | AI-Sphere',
  description: 'AI-Sphere — агрегатор нейросетей, объединяющий более 100 AI-моделей в одном интерфейсе. История проекта, ценности и дорожная карта развития. Бесплатные кредиты каждый день.',
  alternates: {
    canonical: 'https://ai-sphere.ru/about',
  },
  openGraph: {
    title: 'О компании AI-Sphere — агрегатор нейросетей',
    description: 'Более 100 AI-моделей в одном интерфейсе. История, ценности и дорожная карта развития AI-Sphere.',
    url: 'https://ai-sphere.ru/about',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
