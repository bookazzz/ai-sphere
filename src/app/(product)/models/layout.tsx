import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Все AI-модели в AI-Sphere — каталог нейросетей | AI-Sphere',
  description: 'Полный каталог AI-моделей в AI-Sphere: ChatGPT, Claude, DeepSeek, Gemini, Grok, Llama, Mistral, Qwen и другие. Более 40 моделей в одном интерфейсе без VPN.',
  alternates: {
    canonical: 'https://ai-sphere.ru/models',
  },
  openGraph: {
    title: 'Все нейросети в AI-Sphere — каталог моделей',
    description: 'DeepSeek, Claude, Gemini, ChatGPT и 40+ моделей в одном интерфейсе. Без VPN, без подписок.',
    url: 'https://ai-sphere.ru/models',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
