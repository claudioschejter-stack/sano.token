'use client';

import Link from 'next/link';
import { Users, UserCog, TrendingUp } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';

export function ManagerDashboardHome() {
  const t = useTranslation();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
          {t.managerPortal.eyebrow}
        </p>
        <h1 className="text-2xl font-bold text-terminal-text">{t.managerPortal.title}</h1>
        <p className="max-w-2xl text-terminal-muted">{t.managerPortal.desc}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/clients"
          className="rounded-xl border border-terminal-border bg-terminal-card p-6 transition-colors hover:border-terminal-primary/40"
        >
          <Users className="text-terminal-primary" size={24} />
          <h2 className="mt-4 text-lg font-semibold text-terminal-text">{t.managerPortal.clientsCard}</h2>
          <p className="mt-2 text-sm text-terminal-muted">{t.managerPortal.clientsCardDesc}</p>
        </Link>

        <article className="rounded-xl border border-terminal-border bg-terminal-card p-6">
          <TrendingUp className="text-terminal-primary" size={24} />
          <h2 className="mt-4 text-lg font-semibold text-terminal-text">{t.managerPortal.commissionsCard}</h2>
          <p className="mt-2 text-sm text-terminal-muted">{t.managerPortal.commissionsCardDesc}</p>
        </article>

        <Link
          href="/dashboard/clients"
          className="rounded-xl border border-terminal-border bg-terminal-card p-6 transition-colors hover:border-terminal-primary/40 md:col-span-2"
        >
          <UserCog className="text-terminal-primary" size={24} />
          <h2 className="mt-4 text-lg font-semibold text-terminal-text">{t.managerPortal.teamCard}</h2>
          <p className="mt-2 text-sm text-terminal-muted">{t.managerPortal.teamCardDesc}</p>
        </Link>
      </div>
    </div>
  );
}
