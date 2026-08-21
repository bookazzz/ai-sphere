'use client';

import { useEffect, useState } from 'react';

/**
 * Yandex Metrica — асинхронная загрузка без блокировки рендера.
 * Код метрики грузится после первого рендера, не влияет на LCP/FCP.
 */
export default function YandexMetrica() {
  const [counterId, setCounterId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/public/metrica')
      .then(r => r.json())
      .then(d => {
        const id = d?.counter_id?.trim();
        if (id && /^\d+$/.test(id)) {
          setCounterId(id);
        }
      })
      .catch(() => {
        // метрика недоступна — не критично
      });
  }, []);

  useEffect(() => {
    if (!counterId) return;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = `
      (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
      (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
      ym(${counterId}, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true
      });
    `;
    document.head.appendChild(script);

    // noscript fallback
    const noscript = document.createElement('noscript');
    const img = document.createElement('img');
    img.src = `https://mc.yandex.ru/watch/${counterId}`;
    img.style.position = 'absolute';
    img.style.left = '-9999px';
    img.alt = '';
    noscript.appendChild(img);
    document.body.appendChild(noscript);

    return () => {
      // cleanup при размонтировании
      if (script.parentNode) script.parentNode.removeChild(script);
      if (noscript.parentNode) noscript.parentNode.removeChild(noscript);
    };
  }, [counterId]);

  return null; // ничего не рендерит
}
