'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Building2, CircleDollarSign, Landmark, ShieldCheck, TrendingUp } from 'lucide-react';
import { useRealTimeDividends } from '../../hooks/useRealTimeDividends';
import {
  translateAssetLabel,
  translateDistributionConcept,
  translateLiquidatedStatus
} from '../../i18n/demoLabels';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { useDividendStore } from '../../store/useDividendStore';
import { DashboardSkeleton } from './DashboardSkeleton';
import { LiveDividendStream } from './LiveDividendStream';
import { MonthlyCashFlowChart } from './MonthlyCashFlowChart';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

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
  const [portfolio, setPortfolio] = useState<AggregatedPortfolio | null>(null);
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatUsd: formatUsdc, formatPercent, formatDateTime, formatMonthLabel } = useMemo(
    () => createIntlFormatters(intlLocale),
    [intlLocale]
  );

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
    void fetch('/api/portfolio/aggregate?snapshot=true')
      .then((response) => response.json())
      .then((data: { portfolio?: AggregatedPortfolio }) => setPortfolio(data.portfolio ?? null))
      .catch(() => setPortfolio(null));
  }, [fetchDividends]);

  const chartData = useMemo(
    () =>
      monthlyComparison.map((point) => ({
        month: formatMonthLabel(point.month),
        dividendos: point.dividendIncome,
        deuda: point.debtService
      })),
    [formatMonthLabel, monthlyComparison]
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
          label="Valor total cartera"
          value={portfolio ? formatUsdc(portfolio.totals.totalValueUsd) : '—'}
          hint="Tokens RWA + stablecoins + fiat, moneda base USD"
          icon={<CircleDollarSign size={26} />}
          valueClassName="text-terminal-primary"
          iconClassName="bg-terminal-bg text-terminal-primary"
        />
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

      {portfolio ? (
        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <article className="rounded-xl border border-terminal-border bg-terminal-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-terminal-text">Evolución de cartera</h2>
                <p className="text-sm text-terminal-muted">Valor total en moneda base USD</p>
              </div>
              <span className="rounded-full border border-terminal-primary/30 px-3 py-1 text-xs text-terminal-primary">
                Base USD
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={portfolio.history.length ? portfolio.history : [{ date: new Date().toISOString(), totalValueUsd: portfolio.totals.totalValueUsd }]}>
                  <defs>
                    <linearGradient id="portfolioValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString(intlLocale, { month: 'short', day: 'numeric' })}
                    stroke="rgb(148,163,184)"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="rgb(148,163,184)"
                    tickFormatter={(value) => `$${Number(value).toLocaleString(intlLocale)}`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value) => formatUsdc(Number(value))}
                    labelFormatter={(value) => new Date(String(value)).toLocaleDateString(intlLocale)}
                    contentStyle={{ background: '#020617', border: '1px solid #1f2937', borderRadius: 12 }}
                  />
                  <Area type="monotone" dataKey="totalValueUsd" stroke="#60a5fa" fill="url(#portfolioValue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-xl border border-terminal-border bg-terminal-card p-6">
            <h2 className="text-lg font-bold text-terminal-text">Composición</h2>
            <div className="mt-4 space-y-3">
              <BreakdownRow label="Tokens RWA" value={portfolio.totals.rwaValueUsd} total={portfolio.totals.totalValueUsd} formatUsd={formatUsdc} />
              <BreakdownRow label="Stablecoins" value={portfolio.totals.stablecoinUsd} total={portfolio.totals.totalValueUsd} formatUsd={formatUsdc} />
              <BreakdownRow label="Fiat / Saldo Sanova" value={portfolio.totals.fiatUsd} total={portfolio.totals.totalValueUsd} formatUsd={formatUsdc} />
            </div>
          </article>
        </section>
      ) : null}

      {portfolio?.positions.length ? (
        <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
          <h2 className="text-lg font-bold text-terminal-text">Posiciones consolidadas</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {portfolio.positions.map((position) => (
              <article key={position.id} className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
                <p className="text-xs uppercase tracking-wider text-terminal-muted">{position.type}</p>
                <h3 className="mt-1 font-semibold text-terminal-text">{position.label}</h3>
                <p className="mt-3 font-mono text-lg text-terminal-primary">{formatUsdc(position.valueUsd)}</p>
                <p className="text-xs text-terminal-muted">
                  {position.amount.toLocaleString(intlLocale)} {position.currency}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
                      {formatDateTime(row.date)}
                    </td>
                    <td className="px-6 py-4 font-medium text-terminal-text">
                      {translateAssetLabel(row.assetId, t)}
                    </td>
                    <td className="max-w-xs px-6 py-4 text-terminal-muted">
                      {translateDistributionConcept(row.id, row.concept, t)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-terminal-accent">
                      {formatUsdc(row.amountUsdc)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded border border-terminal-success/30 bg-terminal-bg px-3 py-1 text-xs font-semibold text-terminal-success">
                        {translateLiquidatedStatus(row.status, t)}
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

type AggregatedPortfolio = {
  totals: {
    totalValueUsd: number;
    rwaValueUsd: number;
    stablecoinUsd: number;
    fiatUsd: number;
  };
  positions: Array<{
    id: string;
    type: string;
    label: string;
    amount: number;
    currency: string;
    valueUsd: number;
  }>;
  history: Array<{
    date: string;
    totalValueUsd: number;
  }>;
};

function BreakdownRow({
  label,
  value,
  total,
  formatUsd
}: {
  label: string;
  value: number;
  total: number;
  formatUsd: (value: number) => string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-terminal-muted">{label}</span>
        <span className="font-mono text-terminal-text">{formatUsd(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-terminal-bg">
        <div className="h-full rounded-full bg-terminal-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
