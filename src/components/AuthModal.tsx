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
        <button className="auth-modal__close" onClick={onClose} aria-label="Р—Р°РєСЂС‹С‚СЊ">Г—</button>
        <h2 id="auth-title" className="auth-modal__title">Р’РѕР№С‚Рё РІ AIвЂ‘Sphere</h2>
        <p className="auth-modal__subtitle">Р’С‹Р±РµСЂРёС‚Рµ СѓРґРѕР±РЅС‹Р№ СЃРµСЂРІРёСЃ. РќРѕРІС‹Р№ Р°РєРєР°СѓРЅС‚ СЃРѕР·РґР°СЃС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.</p>
        <div className="auth-modal__social">
          <button type="button" onClick={() => start('yandex')} className="auth-modal__social-btn">РЇРЅРґРµРєСЃ</button>
          <button type="button" onClick={() => start('vk')} className="auth-modal__social-btn auth-modal__social-btn--vk">VK</button>
        </div>
        <p className="auth-modal__subtitle">
          РџСЂРѕРґРѕР»Р¶Р°СЏ, РІС‹ РїСЂРёРЅРёРјР°РµС‚Рµ <a href="/offer">РѕС„РµСЂС‚Сѓ</a> Рё <a href="/privacy">РїРѕР»РёС‚РёРєСѓ РєРѕРЅС„РёРґРµРЅС†РёР°Р»СЊРЅРѕСЃС‚Рё</a>.
        </p>
      </div>
    </div>
  );
}

