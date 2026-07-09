import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'AI-Sphere — Один чат для всех задач',
  description: 'ИИ-чат с доступом к ChatGPT, Claude, Gemini, DeepSeek и другим моделям. Без VPN, с оплатой в рублях. Работа с документами, изображениями и кодом.',
  alternates: {
    canonical: 'https://ai-sphere.ru',
  },
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
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Глобальная разметка: Organization + WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  name: 'AI-Sphere',
                  url: 'https://ai-sphere.ru',
                  logo: 'https://ai-sphere.ru/logo.png',
                  description: 'ИИ-чат с доступом к ChatGPT, Claude, Gemini, DeepSeek и другим моделям. Без VPN, с оплатой в рублях.',
                  contactPoint: {
                    '@type': 'ContactPoint',
                    email: 'goorujke@yandex.ru',
                    contactType: 'customer support',
                  },
                },
                {
                  '@type': 'WebSite',
                  name: 'AI-Sphere — Один чат для всех задач',
                  url: 'https://ai-sphere.ru',
                  description: 'ИИ-чат с доступом к ChatGPT, Claude, Gemini, DeepSeek и другим моделям. Без VPN, с оплатой в рублях.',
                  inLanguage: 'ru',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: 'https://ai-sphere.ru/search?q={search_term_string}',
                    'query-input': 'required name=search_term_string',
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
