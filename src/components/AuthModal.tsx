"use client";

import { useState } from 'react';

interface Props { isOpen: boolean; onClose: () => void; }

export default function AuthModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  return (
    <div className={`auth-modal ${isOpen ? 'auth-modal--open' : ''}`}>
      <div className="auth-modal__overlay" onClick={onClose} />
      <div className="auth-modal__content">
        <button className="auth-modal__close" onClick={onClose}>✕</button>

        <h2 className="auth-modal__title">
          {tab === 'login' ? 'Войти' : 'Создать аккаунт'}
        </h2>
        <p className="auth-modal__subtitle">
          {tab === 'login' ? 'Войдите, чтобы продолжить' : 'Зарегистрируйтесь за 30 секунд'}
        </p>

        {/* Tabs */}
        <div className="auth-modal__tabs">
          <button
            className={`auth-modal__tab ${tab === 'login' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => setTab('login')}
          >
            Вход
          </button>
          <button
            className={`auth-modal__tab ${tab === 'register' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => setTab('register')}
          >
            Регистрация
          </button>
        </div>

        {/* Social Buttons */}
        <div className="auth-modal__social">
          <button className="auth-modal__social-btn">Яндекс</button>
          <button className="auth-modal__social-btn">VK</button>
        </div>

        <div className="auth-modal__divider">или</div>

        {/* Form */}
        <form className="auth-modal__form" onSubmit={(e) => e.preventDefault()}>
          <div className="auth-modal__field">
            <label className="auth-modal__label">Email</label>
            <input className="auth-modal__input" type="email" placeholder="your@email.com" />
          </div>
          <div className="auth-modal__field">
            <label className="auth-modal__label">Пароль</label>
            <input className="auth-modal__input" type="password" placeholder="••••••••" />
          </div>
          {tab === 'register' && (
            <div className="auth-modal__field">
              <label className="auth-modal__label">Повторите пароль</label>
              <input className="auth-modal__input" type="password" placeholder="••••••••" />
            </div>
          )}
          {tab === 'register' && (
            <label className="auth-modal__checkbox">
              <input type="checkbox" />
              Я согласен с <a href="/offer">офертой</a> и <a href="/privacy">политикой конфиденциальности</a>
            </label>
          )}
          <button className="auth-modal__submit" type="submit">
            {tab === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
}
