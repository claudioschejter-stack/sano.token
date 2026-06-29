'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getConsentFromCookie, setConsentCookie, type ConsentValue } from '../../lib/analytics/cookieConsent';

export function CookieBanner() {
  const [consent, setConsent] = useState<ConsentValue | 'loading'>('loading');

  useEffect(() => {
    setConsent(getConsentFromCookie());
  }, []);

  function accept() {
    setConsentCookie('accepted');
    setConsent('accepted');
    // Activate GA if it was deferred
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }
  }

  function reject() {
    setConsentCookie('rejected');
    setConsent('rejected');
  }

  // Don't render until we know the consent state (avoids flash)
  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white shadow-xl md:bottom-4 md:left-4 md:right-auto md:max-w-sm md:rounded-2xl md:border"
    >
      <div className="p-4 md:p-5">
        <p className="text-sm font-semibold text-slate-900">🍪 Uso de cookies</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
          Usamos cookies analíticas (Google Analytics) para entender cómo se usa la plataforma y mejorarla.
          Tu navegación nunca se comparte con terceros con fines publicitarios.{' '}
          <Link href="/privacidad" className="font-medium text-blue-600 hover:underline">
            Política de privacidad
          </Link>
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={accept}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
          >
            Aceptar
          </button>
          <button
            onClick={reject}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}
