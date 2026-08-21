import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Страница не найдена — 404 | AI-Sphere',
  description: 'Запрашиваемая страница не найдена. Вернитесь на главную или воспользуйтесь поиском.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '40px 20px',
      }}>
        <h1 style={{ fontSize: '72px', fontWeight: 800, margin: '0 0 8px', background: 'linear-gradient(135deg,#7c3aed,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>404</h1>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1a1d29', margin: '0 0 12px' }}>Страница не найдена</h2>
        <p style={{ fontSize: '16px', color: '#6b7085', maxWidth: '400px', margin: '0 0 32px', lineHeight: 1.6 }}>
          Возможно, страница была удалена или адрес содержит ошибку.
        </p>
        <Link href="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 28px',
          background: 'linear-gradient(135deg,#7c3aed,#6366f1)',
          color: '#fff',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: 600,
          textDecoration: 'none',
        }}>
          На главную
        </Link>
      </main>
      <Footer />
    </>
  );
}
