'use client';

import { useState, useEffect } from 'react';
import { apiCall, exposeExperiment, fetchExperimentAssignment, recordProductEvent } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  price: number;   // рубли (API возвращает рубли)
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
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [experiment, setExperiment] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!isOpen) return;
    void recordProductEvent({ event_name: 'pricing_view', metadata: { source: 'pricing_modal' } }).catch(() => undefined);
    // Check if returning from payment
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    if (paymentStatus) {
      void recordProductEvent({ event_name: 'payment_returned', metadata: { status: paymentStatus } });
    }
    if (paymentStatus === 'success' && typeof onSuccess === 'function') {
      onSuccess();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isOpen, onSuccess]);

  useEffect(() => {
    if (!isOpen) return;
    fetchExperimentAssignment('pricing').then(assignment => {
      if (!assignment) return;
      setExperiment(assignment.payload);
      if (!assignment.exposed) void exposeExperiment(assignment.experiment_id);
      void recordProductEvent({ event_name: 'experiment_exposure', metadata: { surface: 'pricing', variant_id: assignment.variant_id } });
    }).catch(() => undefined);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    apiCall<Plan[]>('/billing/plans')
      .then(setPlans)
      .catch(err => setError(err.message || 'Не удалось загрузить тарифы'));
  }, [isOpen]);

  const handleTopUp = async (planId: string) => {
    void recordProductEvent({ event_name: 'plan_selected', metadata: { plan_id: planId } });
    if (!isLoggedIn) {
      if (onTopUp) onTopUp();
      return;
    }

    setLoadingPlanId(planId);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const result = await apiCall<{ payment_id: string; payment_url: string }>('/billing/top-up', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      void recordProductEvent({ event_name: 'checkout_started', metadata: { plan_id: planId } });

      // Redirect to Platega payment page
      window.location.href = result.payment_url;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Сервер платежей не отвечает. Попробуйте позже.');
      } else {
        setError(err.message || 'Ошибка при создании платежа');
      }
      setLoadingPlanId(null);
    }
  };

  const fmtPrice = (p: number) => (p / 100).toLocaleString('ru-RU'); // kop → rub

  if (!isOpen) return null;

  return (
    <div className="pricing-modal pricing-modal--open">
      <div className="pricing-modal__overlay" onClick={loadingPlanId ? undefined : onClose} />
      <div className="pricing-modal__content">
        <button className="pricing-modal__close" onClick={loadingPlanId ? undefined : onClose}>✕</button>

        <h2 className="pricing-modal__title">{String(experiment.headline || 'Выберите тариф')}</h2>
        <p className="pricing-modal__subtitle">
          Пополните баланс и получите доступ ко всем AI-моделям
        </p>

        {error && (
          <div className="pricing-modal__error">
            {error}
          </div>
        )}

        <div className="pricing-modal__grid">
          {plans.map((plan) => {
            const recommended = plan.popular || String(experiment.recommended_plan_id || '') === plan.id;
            return (
            <div className={`pricing-modal__card ${recommended ? 'pricing-modal__card--popular' : ''}`} key={plan.id}>
              {recommended && <div className="pricing-modal__card-badge">🔥 Рекомендуем</div>}
              <div className="pricing-modal__card-header">
                <span className="pricing-modal__price">{fmtPrice(plan.price)} ₽</span>
                {plan.bonus > 0 && (
                  <span className="pricing-modal__bonus">+{plan.bonus}</span>
                )}
              </div>
              <div className="pricing-modal__card-body">
                <p className="pricing-modal__benefit">
                  ≈ {Math.max(1, Math.floor((plan.credits + plan.bonus) / 3)).toLocaleString('ru-RU')} коротких ответов<br />
                  или {Math.max(1, Math.floor((plan.credits + plan.bonus) / 20)).toLocaleString('ru-RU')} изображений
                </p>
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
                disabled={loadingPlanId !== null}
                onClick={() => handleTopUp(plan.id)}
              >
                {loadingPlanId === plan.id ? 'Обработка...' : String(experiment.cta_text || 'Пополнить')}
              </button>
            </div>
          )})}
        </div>
        <div className="pricing-modal__trust">
          <span>✓ Только пакеты кредитов</span>
          <span>✓ Без подписки и автосписаний</span>
          <span>✓ Кредиты не сгорают</span>
          <span>🔒 Безопасная оплата через Platega</span>
        </div>
      </div>
    </div>
  );
}
