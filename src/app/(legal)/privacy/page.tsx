import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности | AI-Sphere',
  description: 'Политика конфиденциальности AI-Sphere. Узнайте, как мы обрабатываем и защищаем ваши персональные данные.',
  alternates: { canonical: `${site.url}/privacy/` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Политика конфиденциальности | AI-Sphere',
    description: 'Политика конфиденциальности AI-Sphere. Узнайте, как мы обрабатываем и защищаем ваши персональные данные.',
    url: `${site.url}/privacy/`,
  },
};

const contentSections = [
  {
    title: '1. Общие положения',
    items: [
      'Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей сайта ai-sphere.ru.',
      'Используя сайт, вы соглашаетесь с условиями настоящей Политики конфиденциальности.',
      'Если вы не согласны с условиями, пожалуйста, прекратите использование сайта.',
    ],
  },
  {
    title: '2. Какие данные мы собираем',
    items: [
      'Адрес электронной почты (при регистрации).',
      'История обращений к моделям ИИ (для обеспечения работы сервиса).',
      'Техническая информация: IP-адрес, тип браузера, данные об устройстве.',
      'Файлы cookie для работы Яндекс.Метрики и аналитики.',
    ],
  },
  {
    title: '3. Как мы используем данные',
    items: [
      'Для предоставления доступа к сервису и его корректной работы.',
      'Для улучшения качества обслуживания и разработки новых функций.',
      'Для технической поддержки пользователей.',
      'Для анализа статистики использования сервиса (обезличенные данные).',
    ],
  },
  {
    title: '4. Передача данных третьим лицам',
    items: [
      'Мы не продаем персональные данные пользователей.',
      'Передача данных возможна только для обеспечения работы сервиса (платежные системы, хостинг-провайдеры) и в случаях, предусмотренных законодательством РФ.',
      'Все третьи лица, получающие доступ к данным, обязаны обеспечивать их конфиденциальность.',
    ],
  },
  {
    title: '5. Безопасность данных',
    items: [
      'Мы принимаем технические и организационные меры для защиты персональных данных от несанкционированного доступа, изменения, раскрытия или уничтожения.',
      'Передача данных осуществляется по защищенным протоколам (HTTPS).',
    ],
  },
  {
    title: '6. Права пользователей',
    items: [
      'Вы можете запросить удаление вашей учетной записи и связанных с ней данных.',
      'Вы можете отозвать согласие на обработку персональных данных.',
      'Для реализации прав свяжитесь с нами по email: goorujke@yandex.ru',
    ],
  },
  {
    title: '7. Изменения политики',
    items: [
      'Мы оставляем за собой право вносить изменения в настоящую Политику конфиденциальности.',
      'Актуальная версия всегда доступна по адресу https://ai-sphere.ru/privacy/',
      'Продолжая использовать сервис после изменений, вы принимаете новую редакцию Политики.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="legal-page">
        <section className="legal-hero" style={{ padding: '60px 20px', textAlign: 'center', background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)' }}>
          <div className="legal-hero__inner" style={{ maxWidth: 800, margin: '0 auto' }}>
            <h1 className="legal-hero__title" style={{ fontSize: 36, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
              Политика конфиденциальности
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Последнее обновление: 19 июля 2026 г.
            </p>
          </div>
        </section>

        <section className="legal-content" style={{ padding: '40px 20px 60px' }}>
          <div className="legal-content__inner" style={{ maxWidth: 800, margin: '0 auto', fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.8 }}>
            {contentSections.map((section, i) => (
              <div key={i} style={{ marginBottom: 36 }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                  {section.title}
                </h2>
                {section.items.map((item, j) => (
                  <p key={j} style={{ marginBottom: 12 }}>
                    {item}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="legal-cta" style={{ padding: '60px 20px', textAlign: 'center', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#fff' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
              Остались вопросы?
            </h2>
            <p style={{ fontSize: 16, opacity: 0.9, marginBottom: 24, lineHeight: 1.6 }}>
              Свяжитесь с нами — мы ответим на все вопросы о конфиденциальности.
            </p>
            <a href="mailto:goorujke@yandex.ru" style={{
              display: 'inline-block', padding: '14px 36px', borderRadius: 8,
              background: '#fff', color: '#7c3aed', fontWeight: 600,
              fontSize: 16, textDecoration: 'none',
            }}>
              goorujke@yandex.ru
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
