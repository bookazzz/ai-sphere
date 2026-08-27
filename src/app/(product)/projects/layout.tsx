import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мои проекты | AI-Sphere',
  description: 'Личные проекты и многошаговые сценарии пользователя AI-Sphere.',
  robots: { index: false, follow: false, nocache: true },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
