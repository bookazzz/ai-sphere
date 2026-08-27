import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import YandexMetrica from '@/components/YandexMetrica';
import EngagementLayer from '@/components/EngagementLayer';

const manrope = Manrope({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-manrope',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://ai-sphere.ru'),
  title: 'AI-Sphere — нейросети в одном интерфейсе',
  description: 'AI-Sphere помогает решать задачи с помощью нейросетей для текста, документов, изображений и видео.',
  openGraph: {
    title: 'AI-Sphere — все нейросети в одном чате без VPN',
    description: 'Общайтесь с ChatGPT, Claude, DeepSeek и Gemini в одном окне. Без VPN и блокировок в России. Оплата за токены — никаких подписок.',
    url: 'https://ai-sphere.ru',
    siteName: 'AI-Sphere',
    locale: 'ru_RU',
    type: 'website',
    images: [
      {
        url: 'https://ai-sphere.ru/og/ai-sphere-platform.png',
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
    images: ['https://ai-sphere.ru/og/ai-sphere-platform.png'],
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
    <html lang="ru" className={manrope.variable}>
      <body>
        {/* Яндекс.Метрика — SSR: скрипт загружается после интерактива */}
        <YandexMetrica />
        <EngagementLayer />
        {/* Носскрипт-пиксель для поисковых роботов */}
        {children}
      </body>
    </html>
  );
}
