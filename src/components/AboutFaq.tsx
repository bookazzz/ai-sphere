'use client';

import { useState } from 'react';

const aboutFaqData = [
  { q: 'Кто создал AI-Sphere?', a: 'AI-Sphere — это независимый проект команды энтузиастов, объединяющий лучшие AI-модели в одном интерфейсе. Мы не аффилированы с OpenAI, Anthropic, Google или другими компаниями-разработчиками моделей.' },
  { q: 'Как AI-Sphere зарабатывает?', a: 'Мы берём небольшую комиссию сверх стоимости API моделей. Это позволяет нам поддерживать сервис, добавлять новые модели и улучшать интерфейс. Никакой рекламы и продажи данных пользователей.' },
  { q: 'Почему нельзя просто пользоваться моделями напрямую?', a: 'Можно, но это требует регистрации в каждом сервисе отдельно, иностранной карты для оплаты и часто — VPN. AI-Sphere решает все эти проблемы: один аккаунт, оплата в рублях, без VPN.' },
  { q: 'Планируется ли мобильное приложение?', a: 'Да, мобильная версия для iOS и Android в разработке. Следите за новостями в нашем Telegram-канале. А пока сайт отлично работает в мобильном браузере.' },
  { q: 'Можно ли использовать AI-Sphere в коммерческих целях?', a: 'Да. Вы можете использовать AI-Sphere для рабочих задач, генерации контента, написания кода и любых других целей в рамках законодательства РФ.' },
];

export default function AboutFaq() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (i: number) => {
    setOpenFaq(openFaq === i ? null : i);
  };

  return (
    <section className="about-faq">
      <div className="about-faq__container">
        <h2 className="about-faq__title">Часто задаваемые вопросы</h2>
        {aboutFaqData.map((item, i) => (
          <div
            key={i}
            className={`about-faq__item ${openFaq === i ? 'about-faq__item--open' : ''}`}
          >
            <button
              className="about-faq__question"
              onClick={() => toggleFaq(i)}
            >
              <span>{item.q}</span>
              <span className="about-faq__icon">+</span>
            </button>
            {openFaq === i && (
              <div className="about-faq__answer">
                <p>{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
