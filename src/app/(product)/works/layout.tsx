import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мои работы | AI-Sphere',
  description: 'Личная библиотека результатов пользователя AI-Sphere.',
  robots: { index: false, follow: false, nocache: true },
};

export default function WorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
