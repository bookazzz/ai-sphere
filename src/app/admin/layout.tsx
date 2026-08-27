import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Панель управления | AI-Sphere',
  description: 'Служебная панель управления AI-Sphere.',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
