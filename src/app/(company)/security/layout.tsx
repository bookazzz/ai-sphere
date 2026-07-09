import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Безопасность AI-Sphere — защита данных | AI-Sphere',
  description: 'AI-Sphere обеспечивает безопасность ваших данных: шифрование, конфиденциальность диалогов, защита персональной информации. Работаем в соответствии с 152-ФЗ.',
  alternates: {
    canonical: 'https://ai-sphere.ru/security',
  },
  openGraph: {
    title: 'Безопасность AI-Sphere',
    description: 'Шифрование, конфиденциальность и защита персональных данных в AI-Sphere.',
    url: 'https://ai-sphere.ru/security',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
