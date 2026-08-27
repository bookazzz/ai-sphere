'use client';

import { useEffect } from 'react';

export default function CallbackPage() {
  useEffect(() => {
    // OAuth callbacks are completed server-side; this route only handles old bookmarks.
    window.location.replace('/');
  }, []);

  return <main style={{padding: 40, textAlign: 'center'}}>Завершение авторизации…</main>;
}
