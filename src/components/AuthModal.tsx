"use client";

import { useState, FormEvent } from 'react';
import { loginUser, registerUser } from '@/lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: any) => void;
}

const OAUTH_YANDEX = 'https://ai-sphere.ru/api/auth/oauth/yandex';
const OAUTH_VK = 'https://ai-sphere.ru/api/auth/oauth/vk';

export default function AuthModal({ isOpen, onClose, onLogin }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 'register') {
      if (password !== password2) {
        setError('Пароли не совпадают');
        return;
      }
      if (!agreed) {
        setError('Необходимо согласие с условиями');
        return;
      }
    }

    setLoading(true);
    try {
      const fn = tab === 'login' ? loginUser : registerUser;
      const data = await fn(email, password, name || undefined);
      onLogin(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal auth-modal--open">
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
            onClick={() => { setTab('login'); setError(''); }}
          >
            Вход
          </button>
          <button
            className={`auth-modal__tab ${tab === 'register' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}
          >
            Регистрация
          </button>
        </div>

        {/* Social Buttons */}
        <div className="auth-modal__social">
          <a href={OAUTH_YANDEX} className="auth-modal__social-btn">Яндекс</a>
          <a href={OAUTH_VK} className="auth-modal__social-btn">VK</a>
        </div>

        <div className="auth-modal__divider">или</div>

        {/* Form */}
        <form className="auth-modal__form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="auth-modal__field">
              <label className="auth-modal__label">Имя</label>
              <input
                className="auth-modal__input"
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <div className="auth-modal__field">
            <label className="auth-modal__label">Email</label>
            <input
              className="auth-modal__input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-modal__field">
            <label className="auth-modal__label">Пароль</label>
            <input
              className="auth-modal__input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {tab === 'register' && (
            <div className="auth-modal__field">
              <label className="auth-modal__label">Повторите пароль</label>
              <input
                className="auth-modal__input"
                type="password"
                placeholder="••••••••"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
              />
            </div>
          )}
          {tab === 'register' && (
            <label className="auth-modal__checkbox">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              Я согласен с <a href="/offer">офертой</a> и <a href="/privacy">политикой конфиденциальности</a>
            </label>
          )}
          {error && <div className="auth-modal__error">{error}</div>}
          <button className="auth-modal__submit" type="submit" disabled={loading}>
            {loading ? 'Подождите...' : tab === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
}
