'use client';

import { useState } from 'react';
import { getTokenHeader } from '@/lib/api';

const CATEGORIES: Record<string, string> = {
  general: 'Общий вопрос',
  billing: 'Оплата и тарифы',
  technical: 'Техническая проблема',
  feature: 'Предложение',
  bug: 'Ошибка',
  other: 'Другое',
};

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TicketModal({ isOpen, onClose, onSuccess }: TicketModalProps) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTokenHeader(),
        },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          priority,
          message: message.trim(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 200) || 'Ошибка отправки');
      }

      setSuccess('Тикет отправлен! Мы ответим в ближайшее время.');
      setSubject('');
      setMessage('');
      setCategory('general');
      setPriority('normal');

      if (onSuccess) setTimeout(onSuccess, 1500);
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onClose}>
      <div className="modal modal--ticket" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>

        <h2 className="modal__title">Техподдержка</h2>
        <p className="modal__subtitle">Опишите вашу проблему — мы поможем</p>

        <form onSubmit={handleSubmit} className="modal__form">
          <div className="modal__field">
            <label className="modal__label">Тема</label>
            <input
              className="modal__input"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Кратко опишите вопрос"
              maxLength={255}
              required
              disabled={loading}
            />
          </div>

          <div className="modal__field-row">
            <div className="modal__field">
              <label className="modal__label">Категория</label>
              <select
                className="modal__select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
              >
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="modal__field">
              <label className="modal__label">Приоритет</label>
              <select
                className="modal__select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={loading}
              >
                <option value="low">Низкий</option>
                <option value="normal">Средний</option>
                <option value="high">Высокий</option>
                <option value="urgent">Срочно</option>
              </select>
            </div>
          </div>

          <div className="modal__field">
            <label className="modal__label">Сообщение</label>
            <textarea
              className="modal__textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Подробно опишите ситуацию"
              rows={5}
              required
              disabled={loading}
            />
          </div>

          {error && <div className="modal__error">{error}</div>}
          {success && <div className="modal__success">{success}</div>}

          <div className="modal__actions">
            <button type="submit" className="modal__btn modal__btn--primary" disabled={loading || !subject.trim() || !message.trim()}>
              {loading ? 'Отправка...' : 'Отправить'}
            </button>
            <button type="button" className="modal__btn modal__btn--secondary" onClick={onClose} disabled={loading}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
