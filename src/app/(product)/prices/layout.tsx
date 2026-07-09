import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Цены и тарифы AI-Sphere — стоимость моделей | AI-Sphere',
  description: 'Стоимость AI-моделей в AI-Sphere. Прозрачные цены за 1K токенов, оплата в рублях через ЮKassa. Бесплатные кредиты каждый день. Без подписок и скрытых платежей.',
  alternates: {
    canonical: 'https://ai-sphere.ru/prices',
  },
  openGraph: {
    title: 'Цены и тарифы AI-Sphere',
    description: 'Прозрачные цены на AI-модели. Оплата в рублях, бесплатные кредиты ежедневно.',
    url: 'https://ai-sphere.ru/prices',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function PricesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
