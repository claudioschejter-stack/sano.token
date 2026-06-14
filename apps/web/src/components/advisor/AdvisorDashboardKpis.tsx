'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { AdvisorDashboardStats } from '../../lib/advisor/dashboardService';

type AdvisorDashboardKpisProps = {
  showDownline?: boolean;
};

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AdvisorDashboardKpis({ showDownline = false }: AdvisorDashboardKpisProps) {
  const t = useTranslation();
  const labels = t.advisorPortal.kpis;
  const statusLabels = t.adminInvestors.status as Record<string, string>;

  const [stats, setStats] = useState<AdvisorDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/advisor/dashboard')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { stats?: AdvisorDashboardStats } | null) => {
        if (!cancelled && data?.stats) {
          setStats(data.stats);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-terminal-muted">{labels.loading}</p>;
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
          <p className="text-xs uppercase tracking-wide text-terminal-muted">{labels.totalClients}</p>
          <p className="mt-2 text-2xl font-bold text-terminal-text">{stats.totalClients}</p>
        </article>
        <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
          <p className="text-xs uppercase tracking-wide text-terminal-muted">{labels.incorporationsMonth}</p>
          <p className="mt-2 text-2xl font-bold text-terminal-text">{stats.incorporationsThisMonth}</p>
        </article>
        <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
          <p className="text-xs uppercase tracking-wide text-terminal-muted">{labels.accruedCommission}</p>
          <p className="mt-2 text-2xl font-bold text-terminal-text">
            USD {formatUsd(stats.accruedCommissionUsd)}
          </p>
        </article>
        {showDownline ? (
          <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
            <p className="text-xs uppercase tracking-wide text-terminal-muted">{labels.downlineAdvisors}</p>
            <p className="mt-2 text-2xl font-bold text-terminal-text">{stats.downlineAdvisors}</p>
          </article>
        ) : (
          <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
            <p className="text-xs uppercase tracking-wide text-terminal-muted">{labels.paidCommission}</p>
            <p className="mt-2 text-2xl font-bold text-terminal-text">
              USD {formatUsd(stats.paidCommissionUsd)}
            </p>
          </article>
        )}
      </div>

      <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
        <h2 className="text-sm font-semibold text-terminal-text">{labels.kycBreakdown}</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {Object.entries(stats.clientsByKyc).map(([status, count]) => (
            <span key={status} className="text-terminal-muted">
              {statusLabels[status] ?? status}:{' '}
              <span className="font-semibold text-terminal-text">{count}</span>
            </span>
          ))}
        </div>
      </article>
    </div>
  );
}
