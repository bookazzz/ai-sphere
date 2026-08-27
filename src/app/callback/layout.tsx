import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Завершение авторизации | AI-Sphere',
  description: 'Служебная страница завершения авторизации.',
  robots: { index: false, follow: false, nocache: true },
};

export default function CallbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
