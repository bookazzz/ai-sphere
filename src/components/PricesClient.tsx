'use client';

import { useState } from 'react';
import AuthModal from '@/components/AuthModal';

const faqItems = [
  {
    q: 'Как списываются кредиты?',
    a: 'Кредиты списываются за каждый запрос к модели. Стоимость зависит от выбранной модели. Например, DeepSeek V4 Flash — 1 кредит за 1K токенов, GPT-4o — 26 кредитов за 1K токенов. Полный ответ тарифицируется по сумме входных и выходных токенов.',
  },
  {
    q: 'Можно ли пополнить баланс без комиссии?',
    a: 'Да, пополнение через ЮKassa без скрытых комиссий. Доступны суммы: 50, 250, 1000 и 2500 рублей. Средства зачисляются мгновенно.',
  },
  {
    q: 'Есть ли бесплатный лимит?',
    a: 'Да, после регистрации вы получаете 50 кредитов на тестирование. Этого достаточно, чтобы опробовать разные модели и выбрать подходящую.',
  },
  {
    q: 'Какие модели доступны?',
    a: 'Все популярные модели: ChatGPT, Claude, DeepSeek, Gemini, Grok, Llama, Mistral и другие. Полный каталог — более 40 моделей в одном интерфейсе.',
  },
];

const plans = [
  { amount: 50, bonus: null, bonusCredits: 0 },
  { amount: 250, bonus: '+10%', bonusCredits: 25 },
  { amount: 1000, bonus: '+15%', bonusCredits: 150 },
  { amount: 2500, bonus: '+20%', bonusCredits: 500 },
];

export default function PricesClient() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authSuccessUser, setAuthSuccessUser] = useState<any>(null);

  const handleTopUp = () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setShowAuthModal(true);
    } else {
      window.location.href = 'https://ai-sphere.ru/prices?topup=true';
    }
  };

  return (
    <>
      {/* Тарифы */}
      <section className="plans">
        <div className="plans__container">
          <h2 className="plans__title">Выберите тариф</h2>
          <div className="plans__grid">
            {plans.map((plan) => (
              <div className="plans__card" key={plan.amount}>
                <div className="plans__card-header">
                  <span className="plans__price">{plan.amount} ₽</span>
                  {plan.bonus && (
                    <span className="plans__bonus">{plan.bonus}</span>
                  )}
                </div>
                <div className="plans__card-body">
                  <p className="plans__credits">
                    ~{plan.amount * 10} кредитов
                  </p>
                  {plan.bonus && (
                    <p className="plans__bonus-text">
                      +{plan.bonusCredits} бонусных кредитов
                    </p>
                  )}
                </div>
                <button className="plans__btn" onClick={handleTopUp}>Пополнить</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pricing-faq">
        <div className="pricing-faq__container">
          <h2 className="pricing-faq__title">Частые вопросы</h2>
          <div className="pricing-faq__list">
            {faqItems.map((item, idx) => (
              <div
                className={`pricing-faq__item ${expandedFaq === idx ? 'pricing-faq__item--open' : ''}`}
                key={idx}
              >
                <button
                  className="pricing-faq__question"
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                >
                  <span>{item.q}</span>
                  <span className="pricing-faq__icon">+</span>
                </button>
                {expandedFaq === idx && (
                  <div className="pricing-faq__answer">
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AuthModal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={(user: any) => {
          setAuthSuccessUser(user);
          setShowAuthModal(false);
          window.location.href = 'https://ai-sphere.ru/prices?topup=true';
        }}
        onOpenVkAuth={() => {}}
      />
    </>
  );
}
