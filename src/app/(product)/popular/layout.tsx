import type { Metadata } from 'next';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: 'Популярные AI-сценарии | AI-Sphere',
  description: 'Популярные сценарии работы с текстом, документами, изображениями и видео в AI-Sphere.',
  alternates: { canonical: `${site.url}/popular/` },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

export default function PopularLayout({ children }: { children: React.ReactNode }) {
  return children;
}
