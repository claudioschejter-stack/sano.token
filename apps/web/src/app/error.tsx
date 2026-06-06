'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '../i18n/LocaleProvider';

export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslation();

  useEffect(() => {
    console.error('[sanova] route error', error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-terminal-primary">{t.error.eyebrow}</p>
      <h1 className="mt-3 text-2xl font-bold text-terminal-text">{t.error.title}</h1>
      <p className="mt-3 text-sm text-terminal-muted">{error.message || t.error.fallback}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-terminal-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
        >
          {t.error.retry}
        </button>
        <Link
          href="/marketplace"
          className="rounded-lg border border-terminal-border px-5 py-2.5 text-sm font-semibold text-terminal-text hover:bg-terminal-card"
        >
          {t.error.goMarketplace}
        </Link>
      </div>
    </section>
  );
}
