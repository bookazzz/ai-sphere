import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Все AI-модели в AI-Sphere — каталог нейросетей | AI-Sphere',
  description: 'Полный каталог AI-моделей в AI-Sphere: ChatGPT, Claude, DeepSeek, Gemini, Grok, Llama, Mistral, Qwen и другие. Более 40 моделей в одном интерфейсе без VPN.',
  alternates: {
    canonical: 'https://ai-sphere.ru/models',
  },
  openGraph: {
    title: 'Каталог AI-моделей AI-Sphere',
    description: 'Более 40 нейросетей в одном интерфейсе. Бесплатные кредиты каждый день.',
    url: 'https://ai-sphere.ru/models',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
