'use client';

import { useEffect } from 'react';

const FALLBACK_COUNTER_ID = '110850288';
type YmFunction = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

export default function YandexMetrica() {
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      let counterId = FALLBACK_COUNTER_ID;
      try {
        const apiBase = process.env.NODE_ENV === 'development' ? 'http://localhost:8000/api' : '/api';
        const response = await fetch(`${apiBase}/public/settings`);
        if (response.ok) {
          const settings = await response.json();
          if (/^\d{1,20}$/.test(settings.yandex_metrica_id || '')) counterId = settings.yandex_metrica_id;
        }
      } catch {
        // Analytics must never prevent the application from loading.
      }
      if (cancelled || document.querySelector(`script[data-metrica-id="${counterId}"]`)) return;

      const win = window as typeof window & { ym?: YmFunction };
      if (!win.ym) {
        const ym: YmFunction = (...args: unknown[]) => { (ym.a ||= []).push(args) };
        ym.l = Date.now();
        win.ym = ym;
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://mc.yandex.ru/metrika/tag.js';
        script.dataset.metricaId = counterId;
        document.head.appendChild(script);
      }
      win.ym?.(Number(counterId), 'init', {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
    };

    initialize();
    return () => { cancelled = true };
  }, []);

  return null;
}
