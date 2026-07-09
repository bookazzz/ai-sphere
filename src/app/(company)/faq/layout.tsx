import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ — часто задаваемые вопросы AI-Sphere | AI-Sphere',
  description: 'Ответы на частые вопросы об AI-Sphere: регистрация, оплата, кредиты, модели, безопасность. Всё, что нужно знать о работе агрегатора нейросетей.',
  alternates: {
    canonical: 'https://ai-sphere.ru/faq',
  },
  openGraph: {
    title: 'FAQ AI-Sphere',
    description: 'Ответы на частые вопросы: регистрация, оплата, модели, безопасность, кредиты и многое другое.',
    url: 'https://ai-sphere.ru/faq',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
