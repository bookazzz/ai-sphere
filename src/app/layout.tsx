import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'AI-Sphere — все нейросети в одном чате без VPN | ChatGPT, Claude, DeepSeek, Gemini',
  description: 'Общайтесь с ChatGPT, Claude, DeepSeek и Gemini в одном окне. Без VPN и блокировок в России. Оплата за токены — никаких подписок. Доступ к DeepSeek-V3, Claude Sonnet, Gemini 2.5.',
  alternates: {
    canonical: 'https://ai-sphere.ru',
  },
  openGraph: {
    title: 'AI-Sphere — все нейросети в одном чате без VPN',
    description: 'Общайтесь с ChatGPT, Claude, DeepSeek и Gemini в одном окне. Без VPN и блокировок в России. Оплата за токены — никаких подписок.',
    url: 'https://ai-sphere.ru',
    siteName: 'AI-Sphere',
    locale: 'ru_RU',
    type: 'website',
    images: [
      {
        url: 'https://ai-sphere.ru/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AI-Sphere — Один чат для всех нейросетей',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI-Sphere — все нейросети в одном чате без VPN',
    description: 'Общайтесь с ChatGPT, Claude, DeepSeek и Gemini в одном окне. Без VPN и блокировок в России. Оплата за токены — никаких подписок.',
    images: ['https://ai-sphere.ru/og-image.png'],
  },
  other: {
    'yandex-verification': '7a506e7ff7864a82',
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
      <body>
        {/* Яндекс.Метрика — SSR: скрипт загружается после интерактива */}
        <Script id="yandex-metrica-init" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
            (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
            ym(110850288, "init", {
              clickmap:true,
              trackLinks:true,
              accurateTrackBounce:true,
              webvisor:true
            });
          `}
        </Script>
        {/* Носскрипт-пиксель для поисковых роботов */}
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/110850288"
              style={{ position: 'absolute', left: '-9999px' }}
              alt=""
            />
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
