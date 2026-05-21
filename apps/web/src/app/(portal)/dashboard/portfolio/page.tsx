'use client';

import Link from 'next/link';
import { Building } from 'lucide-react';
import { useTranslation } from '../../../../i18n/LocaleProvider';

export default function PortfolioPage() {
  const t = useTranslation();
  const p = t.portfolio;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-terminal-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">{t.nav.myAssets}</p>
        <h1 className="mt-2 text-3xl font-bold text-terminal-text">{p.title}</h1>
        <p className="mt-3 text-terminal-muted">{p.subtitle}</p>
      </header>

      <article className="rounded-xl border border-terminal-border bg-terminal-card p-8">
        <div className="mb-4 inline-flex rounded-lg border border-terminal-border bg-terminal-bg p-3 text-terminal-primary">
          <Building size={24} />
        </div>
        <p className="text-terminal-muted">{p.comingSoon}</p>
        <Link
          href="/marketplace"
          className="mt-6 inline-flex rounded-lg bg-terminal-primary px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
        >
          {t.landing.cta.button}
        </Link>
      </article>
    </section>
  );
}
