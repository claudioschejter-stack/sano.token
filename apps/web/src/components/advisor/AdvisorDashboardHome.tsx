'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';

export function AdvisorDashboardHome() {
  const t = useTranslation();
  const { data: session } = useSession();
  const isManager = session?.user?.role === 'ADVISOR_MANAGER';

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-terminal-border bg-terminal-card p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
        {t.advisorPortal.navClients}
      </p>
      <h1 className="text-2xl font-bold text-terminal-text">{t.advisorPortal.clientsTitle}</h1>
      <p className="text-terminal-muted">
        {isManager ? t.advisorPortal.clientsDescManager : t.advisorPortal.clientsDescAdvisor}
      </p>
      <span className="inline-flex rounded-full border border-terminal-border px-3 py-1 text-xs text-terminal-muted">
        {t.advisorPortal.readOnlyBadge}
      </span>
      <Link
        href="/dashboard/clients"
        className="inline-flex rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary"
      >
        {t.advisorPortal.navClients}
      </Link>
    </div>
  );
}
