import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Каталог AI-моделей и нейросетей | AI-Sphere',
  description: 'Актуальный каталог доступных AI-моделей: возможности, провайдеры, поддерживаемые форматы и стоимость использования в AI-Sphere.',
  alternates: {
    canonical: 'https://ai-sphere.ru/models/',
  },
  openGraph: {
    title: 'Все нейросети в AI-Sphere — каталог моделей',
    description: 'DeepSeek, Claude, Gemini, ChatGPT и 40+ моделей в одном интерфейсе. Без VPN, без подписок.',
    url: 'https://ai-sphere.ru/models/',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
