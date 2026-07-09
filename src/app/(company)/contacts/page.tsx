import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ContactsFaq from '@/components/ContactsFaq';

export default function ContactsPage() {
  return (
    <>
      {/* Header */}
      <Header />

      {/* Hero */}
      <section className="contacts-hero">
        <div className="contacts-hero__container">
          <h1 className="contacts-hero__title">Контакты</h1>
          <p className="contacts-hero__subtitle">
            Мы всегда на связи. Пишите — ответим на любой вопрос.
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="contacts-section">
        <div className="contacts-section__container">
          <h2 className="contacts-section__title">Способы связи</h2>
          <div className="contacts-grid">
            <div className="contacts-card">
              <div className="contacts-card__icon">✉️</div>
              <h3 className="contacts-card__title">Email</h3>
              <p className="contacts-card__text">
                <a href="mailto:goorujke@yandex.ru">goorujke@yandex.ru</a>
                <br />
                Ответ в течение 24 часов
              </p>
            </div>
            <div className="contacts-card">
              <div className="contacts-card__icon">💬</div>
              <h3 className="contacts-card__title">Чат на сайте</h3>
              <p className="contacts-card__text">
                Откройте любой диалог в нашем чате. Мы читаем все обращения.
              </p>
            </div>
            <div className="contacts-card">
              <div className="contacts-card__icon">🔒</div>
              <h3 className="contacts-card__title">Безопасность</h3>
              <p className="contacts-card__text">
                По вопросам безопасности пишите на{' '}
                <a href="mailto:goorujke@yandex.ru">goorujke@yandex.ru</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <ContactsFaq />

      {/* CTA */}
      <section className="contacts-cta">
        <div className="contacts-cta__container">
          <h2 className="contacts-cta__title">Начните прямо сейчас</h2>
          <p className="contacts-cta__text">
            Зарегистрируйтесь и получите 10 бесплатных кредитов на старте.
            Никаких подписок — платите только за то, что используете.
          </p>
          <Link href="/" className="contacts-cta__btn">
            Перейти в чат
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </>
  );
}
