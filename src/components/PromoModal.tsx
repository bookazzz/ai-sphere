'use client';

import { useState, FormEvent } from 'react';
import { apiCall } from '@/lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (credits: number) => void;
}

export default function PromoModal({ isOpen, onClose, onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ ok: boolean; credits_added?: number; total_credits?: number } | null>(null);
  const [toast, setToast] = useState<{ show: boolean; credits: number } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Введите промокод');
      return;
    }

    setLoading(true);
    try {
      const data = await apiCall(
        '/billing/redeem-promo',
        {
          method: 'POST',
          body: JSON.stringify({ code: trimmed }),
        }
      ) as { ok: boolean; credits_added: number; total_credits: number };
      setResult(data);
      if (data.ok && onSuccess) {
        onSuccess(data.credits_added);
        setToast({ show: true, credits: data.credits_added });
        setTimeout(() => {
          setToast(null);
          onClose();
        }, 2500);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка активации промокода');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="promo-modal" onClick={e => e.stopPropagation()}>
        <button className="promo-modal__close" onClick={onClose} aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>

        <h2 className="promo-modal__title">Промокод</h2>
        <p className="promo-modal__subtitle">Введите промокод, чтобы получить бесплатные кредиты</p>

        {!result ? (
          <form onSubmit={handleSubmit}>
            <input
              className="promo-modal__input"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ВВЕДИТЕ КОД"
              maxLength={30}
              autoFocus
              disabled={loading}
            />
            {error && <div className="promo-modal__error">{error}</div>}
            <button className="promo-modal__btn" type="submit" disabled={loading}>
              {loading ? 'Активация...' : 'Активировать'}
            </button>
          </form>
        ) : (
          <div className="promo-modal__success">
            <div className="promo-modal__success-icon">✓</div>
            <div className="promo-modal__success-title">Промокод активирован!</div>
            <div className="promo-modal__success-credits">+{result.credits_added} кредитов</div>
          </div>
        )}

        {toast && (
          <div className="promo-modal__toast">
            <div className="promo-modal__toast-icon">✓</div>
            <div className="promo-modal__toast-text">
              Начислено <strong>+{toast.credits}</strong> кредитов
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
