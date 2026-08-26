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
      setError('Р’РІРµРґРёС‚Рµ РїСЂРѕРјРѕРєРѕРґ');
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
      setError(err.message || 'РћС€РёР±РєР° Р°РєС‚РёРІР°С†РёРё РїСЂРѕРјРѕРєРѕРґР°');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="promo-modal" onClick={e => e.stopPropagation()}>
        <button className="promo-modal__close" onClick={onClose} aria-label="Р—Р°РєСЂС‹С‚СЊ">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>

        <h2 className="promo-modal__title">РџСЂРѕРјРѕРєРѕРґ</h2>
        <p className="promo-modal__subtitle">Р’РІРµРґРёС‚Рµ РїСЂРѕРјРѕРєРѕРґ, С‡С‚РѕР±С‹ РїРѕР»СѓС‡РёС‚СЊ Р±РµСЃРїР»Р°С‚РЅС‹Рµ РєСЂРµРґРёС‚С‹</p>

        {!result ? (
          <form onSubmit={handleSubmit}>
            <input
              className="promo-modal__input"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Р’Р’Р•Р”РРўР• РљРћР”"
              maxLength={30}
              autoFocus
              disabled={loading}
            />
            {error && <div className="promo-modal__error">{error}</div>}
            <button className="promo-modal__btn" type="submit" disabled={loading}>
              {loading ? 'РђРєС‚РёРІР°С†РёСЏ...' : 'РђРєС‚РёРІРёСЂРѕРІР°С‚СЊ'}
            </button>
          </form>
        ) : (
          <div className="promo-modal__success">
            <div className="promo-modal__success-icon">вњ“</div>
            <div className="promo-modal__success-title">РџСЂРѕРјРѕРєРѕРґ Р°РєС‚РёРІРёСЂРѕРІР°РЅ!</div>
            <div className="promo-modal__success-credits">+{result.credits_added} РєСЂРµРґРёС‚РѕРІ</div>
          </div>
        )}

        {toast && (
          <div className="promo-modal__toast">
            <div className="promo-modal__toast-icon">вњ“</div>
            <div className="promo-modal__toast-text">
              РќР°С‡РёСЃР»РµРЅРѕ <strong>+{toast.credits}</strong> РєСЂРµРґРёС‚РѕРІ
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

