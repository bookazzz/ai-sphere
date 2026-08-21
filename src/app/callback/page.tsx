"use client";

import { useEffect, useState } from 'react';

export default function CallbackPage() {
  const [status, setStatus] = useState('Авторизация...');

  useEffect(() => {
    // JSONP helper for VK API calls (users.get)
    function jsonp(url: string): Promise<any> {
      return new Promise((resolve, reject) => {
        const cbName = 'vkCb' + Date.now() + Math.random().toString(36).slice(2);
        (window as any)[cbName] = (data: any) => {
          delete (window as any)[cbName];
          const el = document.querySelector(`script[src*="callback=${cbName}"]`);
          if (el) el.remove();
          resolve(data);
        };
        const s = document.createElement('script');
        s.src = url + '&callback=' + cbName;
        s.onerror = () => {
          delete (window as any)[cbName];
          s.remove();
          reject(new Error('JSONP failed'));
        };
        document.body.appendChild(s);
      });
    }

    async function doAuth() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (!code) {
          setStatus('Ошибка: код не получен');
          return;
        }

        setStatus('Обмен кода на токен...');

        // Try VK ID SDK first (if loaded)
        const VKID = (window as any).VKID;
        let accessToken: string | null = null;

        if (VKID) {
          try {
            const tokenData = await VKID.Auth.exchangeCode(code, window.location.origin + '/api/auth/oauth/vk/callback');
            accessToken = tokenData?.access_token || tokenData?.response?.access_token || null;
          } catch (e) {
            console.error('VKID SDK exchange failed:', e);
          }
        }

        // Fallback: try server-side PKCE proxy
        if (!accessToken) {
          const codeVerifier = sessionStorage.getItem('vk_code_verifier');
          if (codeVerifier) {
            setStatus('Обмен через сервер (PKCE)...');
            const resp = await fetch(
              '/api/auth/oauth/vk/exchange'
              + '?code=' + encodeURIComponent(code)
              + '&redirect_uri=' + encodeURIComponent(window.location.origin + '/api/auth/oauth/vk/callback')
              + '&code_verifier=' + encodeURIComponent(codeVerifier),
              { method: 'POST' }
            );
            if (resp.ok) {
              const data = await resp.json();
              accessToken = data.access_token;
            }
          }
        }

        // Fallback: try server-side token-exchange (non-PKCE)
        if (!accessToken) {
          setStatus('Обмен через сервер...');
          const resp = await fetch(
            '/api/auth/oauth/vk/token-exchange'
            + '?code=' + encodeURIComponent(code)
            + '&redirect_uri=' + encodeURIComponent(window.location.origin + '/api/auth/oauth/vk/callback'),
            { method: 'POST' }
          );
          if (resp.ok) {
            const data = await resp.json();
            accessToken = data.access_token;
          } else {
            const errText = await resp.text().catch(() => '');
            setStatus('Ошибка авторизации VK: ' + (errText || 'Security Error'));
            return;
          }
        }

        if (!accessToken) {
          setStatus('Ошибка: токен не получен');
          return;
        }

        setStatus('Получение данных пользователя...');

        // Step 2: Get user info via VK API (JSONP)
        const userData = await jsonp(
          'https://api.vk.com/method/users.get'
          + '?access_token=' + encodeURIComponent(accessToken)
          + '&fields=first_name,last_name,photo_200'
          + '&v=5.131'
        );

        if (userData.error || !userData.response || !userData.response[0]) {
          setStatus('Ошибка получения данных: ' + ((userData.error || {}).error_msg || 'неизвестная ошибка'));
          return;
        }

        const user = userData.response[0];

        setStatus('Вход на сайт...');

        // Step 3: Send to our backend
        const res = await fetch('/api/auth/oauth/vk/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vk_id: String(user.id),
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            photo: user.photo_200 || '',
          }),
        });

        if (!res.ok) {
          setStatus('Ошибка сервера: ' + res.status);
          return;
        }

        const data = await res.json();
        localStorage.setItem('auth_token', data.access_token);
        localStorage.setItem('auth_provider', 'vk');
        window.location.replace('/');
      } catch (err: any) {
        setStatus('Ошибка: ' + (err.message || 'неизвестная ошибка'));
      }
    }

    doAuth();
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#0f0f1a',
      color: '#e0e0e0',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, border: '3px solid #6366f1',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 20px',
        }} />
        <p>{status}</p>
        {status.includes('Ошибка') && (
          <button
            onClick={() => window.location.replace('/')}
            style={{
              marginTop: 16, padding: '10px 24px',
              background: '#6366f1', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer',
            }}
          >
            На главную
          </button>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
