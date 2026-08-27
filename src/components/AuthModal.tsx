"use client";

import { recordProductEvent } from '@/lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: any) => void;
}

function oauthUrl(provider: 'yandex' | 'vk') {
  if (typeof window === 'undefined') return `/api/auth/oauth/${provider}`;
  return `${window.location.origin}/api/auth/oauth/${provider}`;
}

export default function AuthModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;
  const start = (provider: 'yandex' | 'vk') => {
    void recordProductEvent({ event_name: 'auth_started', metadata: { source: provider } });
    window.location.assign(oauthUrl(provider));
  };
  return (
    <div className="auth-modal auth-modal--open">
      <div className="auth-modal__overlay" onClick={onClose} />
      <div className="auth-modal__content" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        <h2 id="auth-title" className="auth-modal__title">Войти в AI‑Sphere</h2>
        <p className="auth-modal__subtitle">Выберите удобный сервис. Новый аккаунт создастся автоматически.</p>
        <div className="auth-modal__social">
          <button type="button" onClick={() => start('yandex')} className="auth-modal__social-btn">Яндекс</button>
          <button type="button" onClick={() => start('vk')} className="auth-modal__social-btn auth-modal__social-btn--vk">VK</button>
        </div>
        <p className="auth-modal__subtitle">
          Продолжая, вы принимаете <a href="/offer">оферту</a> и <a href="/privacy">политику конфиденциальности</a>.
        </p>
      </div>
    </div>
  );
}
