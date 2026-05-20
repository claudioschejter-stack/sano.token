'use client';

import { useEffect, useState } from 'react';
import { messagesByLocale, resolveLocale, type Locale } from '../i18n';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>('es');

  useEffect(() => {
    const stored = window.localStorage.getItem('sanova.locale');
    setLocale(resolveLocale(stored));
  }, []);

  const t = messagesByLocale[locale].error;

  return (
    <html lang={locale}>
      <body className="flex min-h-screen items-center justify-center bg-[#0A0E17] p-8 text-[#E2E8F0]">
        <article className="max-w-md rounded-xl border border-[#1F2937] bg-[#111827] p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#3B82F6]">Sanova Global</p>
          <h1 className="mt-3 text-2xl font-bold">{t.globalTitle}</h1>
          <p className="mt-3 text-sm text-[#6B7280]">{error.message || t.globalHint}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-[#3B82F6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {t.retry}
          </button>
        </article>
      </body>
    </html>
  );
}
