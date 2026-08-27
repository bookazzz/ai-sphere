'use client';

import { useEffect, useState } from 'react';
import AuthModal from '@/components/AuthModal';
import { apiCall, getMe } from '@/lib/api';

const faqItems = [
  {
    q: 'Как списываются кредиты?',
    a: 'Кредиты списываются за каждый запрос к модели. Стоимость зависит от выбранной модели. Например, DeepSeek V4 Flash — 1 кредит за 1K токенов, GPT-4o — 26 кредитов за 1K токенов. Полный ответ тарифицируется по сумме входных и выходных токенов.',
  },
  {
    q: 'Можно ли пополнить баланс без комиссии?',
    a: 'Да, пополнение через Platega без подписки. Доступны суммы: 50, 250, 1000 и 2500 рублей. Кредиты зачисляются после подтверждения платежа.',
  },
  {
    q: 'Есть ли бесплатный лимит?',
    a: 'Да, после регистрации вы получаете 10 кредитов на тестирование. Этого достаточно, чтобы опробовать разные модели и выбрать подходящую.',
  },
  {
    q: 'Какие модели доступны?',
    a: 'Все популярные модели: ChatGPT, Claude, DeepSeek, Gemini, Grok, Llama, Mistral и другие. Полный каталог — более 40 моделей в одном интерфейсе.',
  },
];

interface CreditPlan {
  id: string;
  name: string;
  price: number;
  credits: number;
  bonus: number;
  popular: boolean;
}

export default function PricesClient() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiCall<CreditPlan[]>('/billing/plans').then(setPlans).catch(e => setError(e.message));
  }, []);

  const startPayment = async (planId: string) => {
    setError('');
    try {
      await getMe();
    } catch {
      setSelectedPlan(planId);
      setShowAuthModal(true);
      return;
    }
    try {
      const payment = await apiCall<{payment_url:string}>('/billing/top-up', {method:'POST', body:JSON.stringify({plan_id:planId})});
      window.location.assign(payment.payment_url);
    } catch (e:any) {
      setError(e.message || 'Не удалось создать платёж');
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
              <div className={'plans__card' + (plan.popular ? ' plans__card--popular' : '')} key={plan.id}>
                {plan.popular && <span className="plans__card-badge">Популярный</span>}
                <div className="plans__card-header">
                  <span className="plans__price">{plan.price / 100} ₽</span>
                  {plan.bonus > 0 && (
                    <span className="plans__bonus">+{plan.bonus}</span>
                  )}
                </div>
                <div className="plans__card-body">
                  <p className="plans__credits">
                    {plan.credits} кредитов
                  </p>
                  {plan.bonus > 0 && (
                    <p className="plans__bonus-text">
                      +{plan.bonus} бонусных кредитов
                    </p>
                  )}
                </div>
                <button className="plans__btn" onClick={()=>void startPayment(plan.id)}>Пополнить</button>
              </div>
            ))}
          </div>
          {error && <p className="admin__error" style={{textAlign:'center',marginTop:16}}>{error}</p>}
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
        onLogin={(_user: any) => {
          setShowAuthModal(false);
          if (selectedPlan) void startPayment(selectedPlan);
        }}
      />
    </>
  );
}
