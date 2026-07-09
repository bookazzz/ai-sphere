"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { apiCall, setToken } from '@/lib/api';

interface Props {
  onLogin: (user: any) => void;
  onClose: () => void;
}

export default function VkAuthOverlay({ onLogin, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vkRenderedRef = useRef(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const handleVkSuccess = useCallback(async (data: any) => {
    const accessToken = data?.access_token || data?.token;
    if (!accessToken) {
      setError('Не удалось получить токен VK');
      return;
    }

    try {
      // VK API via JSONP (browser-side, bypasses CORS)
      const vkData = await new Promise<any>((resolve, reject) => {
        const cb = 'vkCb' + Date.now();
        (window as any)[cb] = (d: any) => { delete (window as any)[cb]; document.body.removeChild(s); resolve(d); };
        const s = document.createElement('script');
        s.src = `https://api.vk.com/method/users.get?access_token=${encodeURIComponent(accessToken)}&fields=first_name,last_name,photo_200&v=5.131&callback=${cb}`;
        s.onerror = () => { delete (window as any)[cb]; document.body.removeChild(s); reject(new Error('VK API request failed')); };
        document.body.appendChild(s);
      });

      if (vkData.error || !vkData.response || !vkData.response[0]) {
        setError('Ошибка получения данных VK: ' + (vkData.error?.error_msg || 'неизвестная ошибка'));
        return;
      }

      const vkUser = vkData.response[0];
      const res = await apiCall<{ access_token: string; user: any }>('/auth/oauth/vk/token', {
        method: 'POST',
        body: JSON.stringify({
          vk_id: String(vkUser.id),
          first_name: vkUser.first_name || '',
          last_name: vkUser.last_name || '',
          photo: vkUser.photo_200 || '',
        }),
      });
      setToken(res.access_token);
      onLogin(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка при входе через VK');
    }
  }, [onLogin, onClose]);

  const handleVkError = useCallback((error: any) => {
    setError('Ошибка авторизации VK');
  }, []);

  // ESC to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (vkRenderedRef.current) return;

    let cancelled = false;

    async function initVk() {
      try {
        // Load VK ID SDK
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Не удалось загрузить VK ID SDK'));
          document.head.appendChild(script);
        });

        if (cancelled) return;

        const VKID = (window as any).VKIDSDK;
        if (!VKID) {
          throw new Error('VK ID SDK не загружен');
        }

        VKID.Config.init({
          app: 54659480,
          redirectUrl: `${window.location.origin}/api/auth/oauth/vk/callback`,
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: '',
        });

        if (cancelled || !containerRef.current) return;

        const oneTap = new VKID.OneTap();

        oneTap.render({
          container: containerRef.current,
          showAlternativeLogin: true,
        })
        .on(VKID.WidgetEvents.ERROR, () => {
          if (!cancelled) {
            setError('Ошибка авторизации VK');
          }
        })
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload: any) => {
          if (cancelled) return;
          try {
            const code = payload.code;
            const deviceId = payload.device_id;
            const authData = await VKID.Auth.exchangeCode(code, deviceId);
            await handleVkSuccess(authData);
          } catch (err: any) {
            if (!cancelled) {
              setError(err.message || 'Ошибка при входе через VK');
            }
          }
        });

        vkRenderedRef.current = true;
        if (!cancelled) setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Ошибка загрузки VK');
          setLoading(false);
        }
      }
    }

    initVk();

    return () => {
      cancelled = true;
    };
  }, [handleVkSuccess]);

  return (
    <div className="vk-auth-overlay">
      <div className="vk-auth-overlay__backdrop" onClick={onClose} />
      <div className="vk-auth-overlay__card">
        <button className="vk-auth-overlay__close" onClick={onClose}>
          ✕
        </button>
        <h2 className="vk-auth-overlay__title">Вход через VK ID</h2>
        <p className="vk-auth-overlay__subtitle">
          Нажмите кнопку ниже для авторизации
        </p>

        {loading && (
          <div className="vk-auth-overlay__loader">Загрузка VK ID...</div>
        )}

        {error && (
          <div className="vk-auth-overlay__error">{error}</div>
        )}

        <div
          ref={containerRef}
          className="vk-auth-overlay__container"
          style={{ minHeight: loading ? 0 : '60px' }}
        />
      </div>
    </div>
  );
}
