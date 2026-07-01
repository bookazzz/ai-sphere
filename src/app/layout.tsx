import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI-Sphere — Один чат для всех задач',
  description: 'ИИ-чат с доступом к ChatGPT, Claude, Gemini, DeepSeek и другим моделям. Без VPN, с оплатой в рублях. Работа с документами, изображениями и кодом.',
  openGraph: {
    title: 'AI-Sphere — Один чат для всех задач',
    description: 'ИИ-чат с доступом к ChatGPT, Claude, Gemini, DeepSeek и другим моделям. Без VPN, с оплатой в рублях.',
    url: 'https://ai-sphere.ru',
    siteName: 'AI-Sphere',
    locale: 'ru_RU',
    type: 'website',
  },
  other: {
    'og:image': 'https://ai-sphere.ru/og-image.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'AI-Sphere',
              url: 'https://ai-sphere.ru',
              description: 'ИИ-чат с доступом к ChatGPT, Claude, Gemini, DeepSeek и другим моделям. Без VPN, с оплатой в рублях.',
              applicationCategory: 'AI Assistant',
              operatingSystem: 'All',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'RUB',
              },
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
