'use client';

import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  CircleDollarSign,
  ShieldCheck,
  TrendingUp,
  Users,
  UserCog
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { AdminStats } from '../../lib/admin/getAdminStats';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton';
import { MorphoLiquidityPanel } from '../lending/MorphoLiquidityPanel';
import { AdminGate } from './AdminGate';

type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  href?: string;
};

function KpiCard({ label, value, hint, icon, href }: KpiCardProps) {
  const content = (
    <article className="flex h-full min-h-[168px] flex-col rounded-xl border border-terminal-border bg-terminal-card p-6 shadow-[0_0_0_1px_rgba(31,41,55,0.5)] transition-colors hover:border-terminal-primary/30">
      <div className="flex flex-1 items-start justify-between gap-4">
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="text-sm font-medium text-terminal-muted">{label}</p>
          <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-terminal-text">{value}</p>
          <p className="mt-auto pt-2 text-xs text-terminal-muted">{hint}</p>
        </div>
        <div className="shrink-0 rounded-lg border border-terminal-border bg-terminal-bg p-3 text-terminal-primary">
          {icon}
        </div>
      </div>
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  );
}

export function AdminOverview() {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatUsd } = createIntlFormatters(intlLocale);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const response = await fetch('/api/admin/stats');
        if (!response.ok) {
          throw new Error('Failed to load stats');
        }

        const data = (await response.json()) as AdminStats;
        if (!cancelled) {
          setStats(data);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <AdminGate>
        <DashboardSkeleton />
      </AdminGate>
    );
  }

  const value = (count: number | undefined) => (error || count === undefined ? '—' : String(count));

  return (
    <AdminGate>
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="border-b border-terminal-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
            {t.adminDashboard.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text md:text-4xl">
            {t.adminDashboard.title}
          </h1>
          <p className="mt-3 max-w-3xl text-terminal-muted">{t.adminDashboard.subtitle}</p>
        </header>

        {stats && stats.kycPendingUsers > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-terminal-warning/30 bg-terminal-bg px-4 py-3 text-sm text-terminal-warning">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{t.adminDashboard.kycAlert.replace('{count}', String(stats.kycPendingUsers))}</p>
          </div>
        ) : null}

        <section className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 [&>*]:h-full">
          <KpiCard
            label={t.adminDashboard.kpiInvestors}
            value={value(stats?.totalInvestors)}
            hint={t.adminDashboard.kpiInvestorsHint}
            icon={<Users size={26} />}
            href="/dashboard/investors"
          />
          <KpiCard
            label={t.adminDashboard.kpiKycPending}
            value={value(stats?.kycPendingUsers)}
            hint={t.adminDashboard.kpiKycPendingHint}
            icon={<ShieldCheck size={26} />}
            href="/dashboard/investors"
          />
          <KpiCard
            label={t.adminDashboard.kpiActiveAssets}
            value={value(stats?.activeProjects)}
            hint={t.adminDashboard.kpiActiveAssetsHint}
            icon={<Building2 size={26} />}
            href="/dashboard/assets"
          />
          <KpiCard
            label={t.adminDashboard.kpiCapital}
            value={error || !stats ? '—' : formatUsd(stats.totalCapitalUsd)}
            hint={t.adminDashboard.kpiCapitalHint}
            icon={<CircleDollarSign size={26} />}
            href="/dashboard/treasury"
          />
          <KpiCard
            label={t.adminDashboard.kpiInvestments}
            value={value(stats?.activeInvestments)}
            hint={t.adminDashboard.kpiInvestmentsHint}
            icon={<TrendingUp size={26} />}
            href="/dashboard/assets"
          />
          <KpiCard
            label={t.adminDashboard.kpiStaff}
            value={value(stats?.staffUsers)}
            hint={t.adminDashboard.kpiStaffHint}
            icon={<UserCog size={26} />}
            href="/dashboard/team"
          />
        </section>

        <MorphoLiquidityPanel loansHref="/dashboard/loans" />

        <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
          <h2 className="text-lg font-bold text-terminal-text">{t.adminDashboard.quickLinksTitle}</h2>
          <p className="mt-1 text-sm text-terminal-muted">{t.adminDashboard.quickLinksSubtitle}</p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { href: '/dashboard/investors', label: t.adminNav.investors },
              { href: '/dashboard/assets', label: t.adminNav.assets },
              { href: '/dashboard/loans', label: t.adminNav.loans },
              { href: '/dashboard/treasury', label: t.adminNav.treasury },
              { href: '/dashboard/team', label: t.adminNav.team },
              { href: '/dashboard/settings', label: t.adminNav.settings },
              { href: '/marketplace', label: t.nav.marketplace }
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm font-medium text-terminal-text transition-colors hover:border-terminal-primary/40 hover:text-terminal-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminGate>
  );
}
