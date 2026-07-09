import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Контакты AI-Sphere — свяжитесь с нами | AI-Sphere',
  description: 'Контактная информация AI-Sphere. Email, реквизиты, поддержка пользователей агрегатора нейросетей. Свяжитесь с нами по любым вопросам.',
  alternates: {
    canonical: 'https://ai-sphere.ru/contacts',
  },
  openGraph: {
    title: 'Контакты AI-Sphere',
    description: 'Контактная информация и поддержка агрегатора нейросетей AI-Sphere.',
    url: 'https://ai-sphere.ru/contacts',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
