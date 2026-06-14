'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { AdvisorDashboardKpis } from './AdvisorDashboardKpis';

export function AdvisorDashboardHome() {
  const t = useTranslation();
  const { data: session } = useSession();
  const isManager = session?.user?.role === 'ADVISOR_MANAGER';

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
          {t.advisorPortal.navClients}
        </p>
        <h1 className="text-2xl font-bold text-terminal-text">{t.advisorPortal.clientsTitle}</h1>
        <p className="max-w-2xl text-terminal-muted">
          {isManager ? t.advisorPortal.clientsDescManager : t.advisorPortal.clientsDescAdvisor}
        </p>
      </div>

      <AdvisorDashboardKpis showDownline={false} />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/clients"
          className="inline-flex rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary"
        >
          {t.advisorPortal.navClients}
        </Link>
        <Link
          href="/dashboard/commissions"
          className="inline-flex rounded-lg border border-terminal-border px-4 py-2 text-sm font-semibold text-terminal-text"
        >
          {t.advisorPortal.navCommissions}
        </Link>
      </div>
    </div>
  );
}
