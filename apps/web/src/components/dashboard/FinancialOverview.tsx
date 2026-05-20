'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Building2, CircleDollarSign, Landmark, ShieldCheck, TrendingUp } from 'lucide-react';
import { useRealTimeDividends } from '../../hooks/useRealTimeDividends';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { useDividendStore } from '../../store/useDividendStore';
import { DashboardSkeleton } from './DashboardSkeleton';
import { LiveDividendStream } from './LiveDividendStream';
import { MonthlyCashFlowChart } from './MonthlyCashFlowChart';

const formatUsdc = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value / 100);

function formatMonthLabel(monthKey: string, intlLocale: string) {
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat(intlLocale, { month: 'short', year: '2-digit' }).format(date);
}

function formatDistributionDate(isoDate: string, intlLocale: string) {
  return new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(isoDate));
}

type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  valueClassName: string;
  iconClassName: string;
};

function KpiCard({ label, value, hint, icon, valueClassName, iconClassName }: KpiCardProps) {
  return (
    <article className="rounded-xl border border-terminal-border bg-terminal-card p-6 shadow-[0_0_0_1px_rgba(31,41,55,0.5)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-terminal-muted">{label}</p>
          <p className={`mt-3 font-mono text-3xl font-bold tracking-tight ${valueClassName}`}>{value}</p>
          <p className="mt-2 text-xs text-terminal-muted">{hint}</p>
        </div>
        <div className={`rounded-lg border border-terminal-border p-3 ${iconClassName}`}>{icon}</div>
      </div>
    </article>
  );
}

export function FinancialOverview() {
  const [mounted, setMounted] = useState(false);
  const t = useTranslation();
  const { intlLocale } = useLocale();

  const distributions = useDividendStore((state) => state.distributions);
  const totalCashDividendsUsdc = useDividendStore((state) => state.totalCashDividendsUsdc);
  const debtCoveragePercent = useDividendStore((state) => state.debtCoveragePercent);
  const aneloProjectedYieldPercent = useDividendStore((state) => state.aneloProjectedYieldPercent);
  const monthlyComparison = useDividendStore((state) => state.monthlyComparison);
  const isLoading = useDividendStore((state) => state.isLoading);
  const fetchDividends = useDividendStore((state) => state.fetchDividends);

  const isCoveragePositive = debtCoveragePercent > 0;
  const isYieldPositive = aneloProjectedYieldPercent > 0;

  useRealTimeDividends();

  useEffect(() => {
    setMounted(true);
    void fetchDividends();
  }, [fetchDividends]);

  const chartData = useMemo(
    () =>
      monthlyComparison.map((point) => ({
        month: formatMonthLabel(point.month, intlLocale),
        dividendos: point.dividendIncome,
        deuda: point.debtService
      })),
    [intlLocale, monthlyComparison]
  );

  if (!mounted) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 bg-terminal-bg text-terminal-text">
      <LiveDividendStream />
      <header className="border-b border-terminal-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">{t.dashboard.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text md:text-4xl">{t.dashboard.title}</h1>
        <p className="mt-3 max-w-3xl text-terminal-muted">{t.dashboard.subtitle}</p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <KpiCard
          label={t.dashboard.kpiDividends}
          value={isLoading ? '—' : formatUsdc(totalCashDividendsUsdc)}
          hint={t.dashboard.kpiDividendsHint}
          icon={<CircleDollarSign size={26} />}
          valueClassName="text-terminal-accent"
          iconClassName="bg-terminal-bg text-terminal-accent"
        />
        <KpiCard
          label={t.dashboard.kpiDebtCoverage}
          value={isLoading ? '—' : `${debtCoveragePercent.toFixed(1)}%`}
          hint={t.dashboard.kpiDebtCoverageHint}
          icon={<ShieldCheck size={26} />}
          valueClassName={isCoveragePositive ? 'text-terminal-success' : 'text-terminal-warning'}
          iconClassName={
            isCoveragePositive
              ? 'bg-terminal-bg text-terminal-success'
              : 'bg-terminal-bg text-terminal-warning'
          }
        />
        <KpiCard
          label={t.dashboard.kpiAneloYield}
          value={isLoading ? '—' : formatPercent(aneloProjectedYieldPercent)}
          hint={t.dashboard.kpiAneloYieldHint}
          icon={<TrendingUp size={26} />}
          valueClassName={isYieldPositive ? 'text-terminal-success' : 'text-terminal-warning'}
          iconClassName={
            isYieldPositive ? 'bg-terminal-bg text-terminal-success' : 'bg-terminal-bg text-terminal-warning'
          }
        />
      </section>

      <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-terminal-text">
              {t.dashboard.chartTitle}
            </h2>
            <p className="mt-1 text-sm text-terminal-muted">{t.dashboard.chartSubtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-terminal-muted">
            <Landmark size={14} className="text-terminal-primary" />
            <span>{t.dashboard.chartCurrency}</span>
          </div>
        </div>

        <MonthlyCashFlowChart
          data={chartData}
          formatUsdc={formatUsdc}
          dividendLabel={t.dashboard.chartDividends}
          debtLabel={t.dashboard.chartDebt}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
        <div className="flex items-center justify-between border-b border-terminal-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-terminal-text">{t.dashboard.distributionsTitle}</h2>
            <p className="mt-1 text-sm text-terminal-muted">{t.dashboard.distributionsSubtitle}</p>
          </div>
          <Building2 className="text-terminal-primary" size={22} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
              <tr>
                <th className="px-6 py-3 font-semibold">{t.dashboard.colDate}</th>
                <th className="px-6 py-3 font-semibold">{t.dashboard.colAsset}</th>
                <th className="px-6 py-3 font-semibold">{t.dashboard.colConcept}</th>
                <th className="px-6 py-3 text-right font-semibold">{t.dashboard.colAmount}</th>
                <th className="px-6 py-3 font-semibold">{t.dashboard.colStatus}</th>
                <th className="px-6 py-3 font-semibold">{t.dashboard.colTx}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-terminal-muted">
                    {t.dashboard.syncing}
                  </td>
                </tr>
              ) : distributions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-terminal-muted">
                    {t.dashboard.empty}
                  </td>
                </tr>
              ) : (
                distributions.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-terminal-bg/60"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-terminal-muted">
                      {formatDistributionDate(row.date, intlLocale)}
                    </td>
                    <td className="px-6 py-4 font-medium text-terminal-text">{row.assetId}</td>
                    <td className="max-w-xs px-6 py-4 text-terminal-muted">{row.concept}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-terminal-accent">
                      {formatUsdc(row.amountUsdc)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded border border-terminal-success/30 bg-terminal-bg px-3 py-1 text-xs font-semibold text-terminal-success">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-terminal-muted">{row.txHash ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
