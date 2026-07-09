import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AboutFaq from '@/components/AboutFaq';

export default function AboutPage() {
  return (
    <>
      {/* Header */}
      <Header />

      {/* Hero */}
      <section className="about-hero">
        <div className="about-hero__container">
          <h1 className="about-hero__title">О проекте AI-Sphere</h1>
          <p className="about-hero__subtitle">
            Один чат для всех задач — доступ к лучшим AI-моделям мира без границ и VPN
          </p>
        </div>
      </section>

      {/* Section 1: How it started */}
      <section className="about-section">
        <div className="about-section__container">
          <h2 className="about-section__title">Как появился AI-Sphere</h2>
          <div className="about-section__content">
            <p>
              В начале 2025 года мы заметили, что использование AI-моделей в России сопряжено с 
              множеством барьеров: нужна иностранная карта, VPN, отдельная регистрация в каждом сервисе.
              Мы решили сделать сервис, который объединит все лучшие модели в одном месте 
              с простой оплатой в рублях.
            </p>
            <p>
              За несколько месяцев мы протестировали десятки API, собрали обратную связь от первых 
              пользователей и создали интерфейс, который одинаково удобен и для новичков, и для 
              профессионалов. Сегодня AI-Sphere — это более 100 моделей в одном интерфейсе.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: What is AI-Sphere */}
      <section className="about-section" style={{ background: '#f8f9fa' } as React.CSSProperties}>
        <div className="about-section__container">
          <h2 className="about-section__title">Что такое AI-Sphere?</h2>
          <div className="about-section__content">
            <p>
              AI-Sphere — это агрегатор нейросетей. Мы даём доступ к ChatGPT, Claude, DeepSeek, 
              Gemini, Grok, Llama и десяткам других моделей через единый интерфейс.
            </p>
            <p>
              Ключевые возможности: работа с документами и изображениями, написание и анализ кода, 
              генерация контента, переводы, аналитика. Всё это — без VPN, регистрации в зарубежных 
              сервисах и с оплатой в рублях.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Development */}
      <section className="about-section">
        <div className="about-section__container">
          <h2 className="about-section__title">Как мы развиваемся</h2>
          <div className="about-section__content">
            <p>
              Мы постоянно добавляем новые модели, улучшаем интерфейс и оптимизируем скорость работы.
              В наших планах: мобильное приложение, API для бизнеса, интеграция с популярными 
              сервисами и расширение списка моделей.
            </p>
            <p>
              Мы открыты к обратной связи и предложениям. Если у вас есть идеи, как сделать 
              AI-Sphere лучше — напишите нам на{' '}
              <a href="mailto:goorujke@yandex.ru">goorujke@yandex.ru</a>.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <AboutFaq />

      {/* CTA */}
      <section className="about-cta">
        <div className="about-cta__container">
          <h2 className="about-cta__title">Начните прямо сейчас</h2>
          <p className="about-cta__text">
            Зарегистрируйтесь и получите 10 бесплатных кредитов на старте.
            Никаких подписок — платите только за то, что используете.
          </p>
          <Link href="/" className="about-cta__btn">
            Перейти в чат
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </>
  );
}
