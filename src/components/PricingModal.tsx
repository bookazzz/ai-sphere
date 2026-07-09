'use client';

import { useState, useEffect } from 'react';
import { apiCall } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  price: number;   // копейки
  credits: number;
  bonus: number;
  popular: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
  onTopUp?: () => void;
  onSuccess?: () => void;  // callback after successful payment redirect
}

export default function PricingModal({ isOpen, onClose, isLoggedIn, onTopUp, onSuccess }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Check if returning from payment
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success' && typeof onSuccess === 'function') {
      onSuccess();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isOpen, onSuccess]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    // Try fetching plans from API, fallback to hardcoded
    fetch('/api/billing/plans')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPlans(data); })
      .catch(() => {});
  }, [isOpen]);

  const handleTopUp = async (planId: string) => {
    if (!isLoggedIn) {
      if (onTopUp) onTopUp();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiCall<{ payment_id: string; payment_url: string }>('/billing/top-up', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId }),
      });

      // Redirect to Platega payment page
      window.location.href = result.payment_url;
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании платежа');
      setLoading(false);
    }
  };

  const displayPlans = plans.length > 0 ? plans : [
    { id: 'starter',  name: 'Стартовый',  price: 5000,  credits: 500,  bonus: 0,    popular: false },
    { id: 'basic',    name: 'Базовый',    price: 25000, credits: 2500,  bonus: 0,    popular: false },
    { id: 'popular',  name: 'Популярный', price: 100000,credits: 10000, bonus: 1500, popular: true },
    { id: 'premium',  name: 'Премиум',    price: 250000,credits: 25000, bonus: 5000, popular: false },
  ];

  if (!isOpen) return null;

  return (
    <div className="pricing-modal pricing-modal--open">
      <div className="pricing-modal__overlay" onClick={loading ? undefined : onClose} />
      <div className="pricing-modal__content">
        <button className="pricing-modal__close" onClick={loading ? undefined : onClose}>✕</button>

        <h2 className="pricing-modal__title">Выберите тариф</h2>
        <p className="pricing-modal__subtitle">
          Пополните баланс и получите доступ ко всем AI-моделям
        </p>

        {error && (
          <div className="pricing-modal__error">
            {error}
          </div>
        )}

        <div className="pricing-modal__grid">
          {displayPlans.map((plan) => (
            <div className={`pricing-modal__card ${plan.popular ? 'pricing-modal__card--popular' : ''}`} key={plan.id}>
              {plan.popular && <div className="pricing-modal__card-badge">🔥 Выбор пользователей</div>}
              <div className="pricing-modal__card-header">
                <span className="pricing-modal__price">{Math.round(plan.price / 100)} ₽</span>
                {plan.bonus > 0 && (
                  <span className="pricing-modal__bonus">+{plan.bonus}</span>
                )}
              </div>
              <div className="pricing-modal__card-body">
                <p className="pricing-modal__credits">
                  ~{(plan.credits + plan.bonus).toLocaleString('ru-RU')} кредитов
                </p>
                {plan.bonus > 0 && (
                  <p className="pricing-modal__bonus-text">
                    +{plan.bonus.toLocaleString('ru-RU')} бонусных кредитов
                  </p>
                )}
              </div>
              <button
                className="pricing-modal__btn"
                disabled={loading}
                onClick={() => handleTopUp(plan.id)}
              >
                {loading ? 'Обработка...' : 'Пополнить'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
