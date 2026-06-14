'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
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
import { AccountStatusBanner } from '../account/AccountStatusBanner';
import { InvestorKpiCard } from './investor/InvestorKpiCard';
import { InvestorPageHeader } from './investor/InvestorPageHeader';
import { InvestorSection } from './investor/InvestorSection';
import { LiveDividendStream } from './LiveDividendStream';
import { MonthlyCashFlowChart } from './MonthlyCashFlowChart';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { useSession } from 'next-auth/react';
import { isMarketplaceTradingRole } from '../../lib/auth/roles';
import type { AggregatedPortfolio } from '../../lib/portfolio/portfolioAggregator';
import { InvestorCollectionWalletPanel } from '../wallet/InvestorCollectionWalletPanel';
import { MorphoLiquidityPanel } from '../lending/MorphoLiquidityPanel';
import { PasskeyRegisterPrompt } from '../auth/PasskeyRegisterPrompt';

export function FinancialOverview() {
  const [mounted, setMounted] = useState(false);
  const [portfolio, setPortfolio] = useState<AggregatedPortfolio | null>(null);
  const [weightedTargetYield, setWeightedTargetYield] = useState<number | null>(null);
  const t = useTranslation();
  const d = t.dashboard;
  const { data: session } = useSession();
  const canRequestMorphoLoan = isMarketplaceTradingRole(session?.user?.role);
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
  const isYieldPositive = (weightedTargetYield ?? aneloProjectedYieldPercent) > 0;
  const displayTargetYield = weightedTargetYield ?? aneloProjectedYieldPercent;

  useRealTimeDividends();

  useEffect(() => {
    setMounted(true);
    void fetchDividends();
    void fetch('/api/portfolio/aggregate?snapshot=true')
      .then((response) => response.json())
      .then((data: { portfolio?: AggregatedPortfolio }) => setPortfolio(data.portfolio ?? null))
      .catch(() => setPortfolio(null));
    void fetch('/api/portfolio/yield-by-project', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: { totals?: { weightedTargetYieldPercent?: number | null } }) =>
        setWeightedTargetYield(data.totals?.weightedTargetYieldPercent ?? null)
      )
      .catch(() => setWeightedTargetYield(null));
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

  const compositionSlices = useMemo(() => {
    if (!portfolio) {
      return [];
    }

    const slices = [
      { name: d.breakdownRwa, value: portfolio.totals.rwaValueUsd, color: '#60a5fa' },
      { name: d.breakdownStablecoins, value: portfolio.totals.stablecoinUsd, color: '#34d399' },
      { name: d.breakdownFiat, value: portfolio.totals.fiatUsd, color: '#fbbf24' }
    ].filter((slice) => slice.value > 0);

    return slices;
  }, [d.breakdownFiat, d.breakdownRwa, d.breakdownStablecoins, portfolio]);

  if (!mounted) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 bg-terminal-bg text-terminal-text md:space-y-8">
      <LiveDividendStream />
      <InvestorPageHeader eyebrow={d.eyebrow} title={d.title} subtitle={d.subtitle} />
      <AccountStatusBanner showWhenOperational />
      <PasskeyRegisterPrompt className="mb-2" />

      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl border border-terminal-border bg-terminal-card" />}>
        <InvestorCollectionWalletPanel />
      </Suspense>

      <MorphoLiquidityPanel loansHref="/marketplace" showLoansLink={canRequestMorphoLoan} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>article]:h-full">
        <InvestorKpiCard
          label={d.kpiTotalPortfolio}
          value={portfolio ? formatUsdc(portfolio.totals.netLiquidValueUsd) : '—'}
          hint={d.kpiTotalPortfolioHint}
          icon={<CircleDollarSign size={24} />}
          valueClassName="text-terminal-primary"
          iconClassName="bg-terminal-bg text-terminal-primary"
        />
        <InvestorKpiCard
          label={d.kpiDividends}
          value={isLoading ? '—' : formatUsdc(totalCashDividendsUsdc)}
          hint={d.kpiDividendsHint}
          icon={<CircleDollarSign size={24} />}
          valueClassName="text-terminal-accent"
          iconClassName="bg-terminal-bg text-terminal-accent"
        />
        <InvestorKpiCard
          label={d.kpiDebtCoverage}
          value={isLoading ? '—' : `${debtCoveragePercent.toFixed(1)}%`}
          hint={d.kpiDebtCoverageHint}
          icon={<ShieldCheck size={24} />}
          valueClassName={isCoveragePositive ? 'text-terminal-success' : 'text-terminal-warning'}
          iconClassName={
            isCoveragePositive
              ? 'bg-terminal-bg text-terminal-success'
              : 'bg-terminal-bg text-terminal-warning'
          }
        />
        <InvestorKpiCard
          label={d.kpiPortfolioYield}
          value={isLoading ? '—' : formatPercent(displayTargetYield)}
          hint={d.kpiPortfolioYieldHint}
          icon={<TrendingUp size={24} />}
          valueClassName={isYieldPositive ? 'text-terminal-success' : 'text-terminal-warning'}
          iconClassName={
            isYieldPositive ? 'bg-terminal-bg text-terminal-success' : 'bg-terminal-bg text-terminal-warning'
          }
        />
      </section>

      {portfolio ? (
        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
          <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-terminal-text sm:text-lg">{d.portfolioEvolutionTitle}</h2>
                <p className="text-xs text-terminal-muted sm:text-sm">{d.portfolioEvolutionSubtitle}</p>
              </div>
              <span className="w-fit rounded-full border border-terminal-primary/30 px-3 py-1 text-xs text-terminal-primary">
                {d.baseUsdBadge}
              </span>
            </div>
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    portfolio.history.length
                      ? portfolio.history.map((point) => ({
                          date: point.date,
                          netLiquidValueUsd: point.netLiquidValueUsd
                        }))
                      : [
                          {
                            date: new Date().toISOString(),
                            netLiquidValueUsd: portfolio.totals.netLiquidValueUsd
                          }
                        ]
                  }
                >
                  <defs>
                    <linearGradient id="portfolioValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString(intlLocale, { month: 'short', day: 'numeric' })
                    }
                    stroke="rgb(148,163,184)"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />
                  <YAxis
                    stroke="rgb(148,163,184)"
                    tickFormatter={(value) => `$${Number(value).toLocaleString(intlLocale)}`}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    fontSize={11}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }

                      const value = Number(payload[0]?.value ?? 0);

                      return (
                        <div className="rounded-xl border border-terminal-border bg-terminal-card px-3 py-2 text-sm shadow-lg">
                          <p className="text-xs text-terminal-muted">
                            {new Date(String(label)).toLocaleDateString(intlLocale, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="mt-1 font-mono font-semibold text-terminal-primary">
                            {formatUsdc(value)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="netLiquidValueUsd"
                    stroke="#60a5fa"
                    fill="url(#portfolioValue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
            <h2 className="text-base font-bold text-terminal-text sm:text-lg">{d.compositionTitle}</h2>
            {compositionSlices.length ? (
              <>
                <div className="mx-auto mt-4 h-52 w-full max-w-xs sm:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={compositionSlices}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={84}
                        paddingAngle={2}
                        stroke="rgb(15,23,42)"
                        strokeWidth={2}
                      >
                        {compositionSlices.map((slice) => (
                          <Cell key={slice.name} fill={slice.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatUsdc(Number(value))}
                        contentStyle={{
                          background: '#020617',
                          border: '1px solid #1f2937',
                          borderRadius: 12
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-3">
                  {compositionSlices.map((slice) => (
                    <BreakdownRow
                      key={slice.name}
                      label={slice.name}
                      value={slice.value}
                      total={portfolio.totals.grossAssetsUsd}
                      formatUsd={formatUsdc}
                      color={slice.color}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-terminal-muted">{d.compositionEmpty}</p>
            )}
          </article>
        </section>
      ) : null}

      {portfolio?.positions.length ? (
        <InvestorSection title={d.consolidatedPositionsTitle} bodyClassName="p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        </InvestorSection>
      ) : null}

      <InvestorSection
        title={d.chartTitle}
        subtitle={d.chartSubtitle}
        action={
          <div className="flex items-center gap-2 text-xs text-terminal-muted">
            <Landmark size={14} className="text-terminal-primary" />
            <span>{d.chartCurrency}</span>
          </div>
        }
        bodyClassName="p-4 sm:p-6"
      >
        <MonthlyCashFlowChart
          data={chartData}
          formatUsdc={formatUsdc}
          dividendLabel={d.chartDividends}
          debtLabel={d.chartDebt}
        />
      </InvestorSection>

      <InvestorSection
        title={d.distributionsTitle}
        subtitle={d.distributionsSubtitle}
        action={<Building2 className="text-terminal-primary" size={22} />}
        bodyClassName="p-0"
      >
        <div className="space-y-3 p-4 md:hidden">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-terminal-muted">{d.syncing}</p>
          ) : distributions.length === 0 ? (
            <p className="py-6 text-center text-sm text-terminal-muted">{d.empty}</p>
          ) : (
            distributions.map((row) => (
              <article key={row.id} className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-terminal-text">{translateAssetLabel(row.assetId, t)}</p>
                    <p className="mt-1 text-xs text-terminal-muted">{formatDateTime(row.date)}</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-terminal-accent">{formatUsdc(row.amountUsdc)}</p>
                </div>
                <p className="mt-2 text-xs text-terminal-muted">
                  {translateDistributionConcept(row.id, row.concept, t)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded border border-terminal-success/30 bg-terminal-card px-2 py-0.5 text-xs font-semibold text-terminal-success">
                    {translateLiquidatedStatus(row.status, t)}
                  </span>
                  {row.txHash ? (
                    <span className="font-mono text-[10px] text-terminal-muted">{row.txHash.slice(0, 14)}…</span>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
              <tr>
                <th className="px-4 py-3 font-semibold lg:px-6">{d.colDate}</th>
                <th className="px-4 py-3 font-semibold lg:px-6">{d.colAsset}</th>
                <th className="px-4 py-3 font-semibold lg:px-6">{d.colConcept}</th>
                <th className="px-4 py-3 text-right font-semibold lg:px-6">{d.colAmount}</th>
                <th className="px-4 py-3 font-semibold lg:px-6">{d.colStatus}</th>
                <th className="px-4 py-3 font-semibold lg:px-6">{d.colTx}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-terminal-muted">
                    {d.syncing}
                  </td>
                </tr>
              ) : distributions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-terminal-muted">
                    {d.empty}
                  </td>
                </tr>
              ) : (
                distributions.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-terminal-bg/60">
                    <td className="whitespace-nowrap px-4 py-4 text-terminal-muted lg:px-6">
                      {formatDateTime(row.date)}
                    </td>
                    <td className="px-4 py-4 font-medium text-terminal-text lg:px-6">
                      {translateAssetLabel(row.assetId, t)}
                    </td>
                    <td className="max-w-xs px-4 py-4 text-terminal-muted lg:px-6">
                      {translateDistributionConcept(row.id, row.concept, t)}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-terminal-accent lg:px-6">
                      {formatUsdc(row.amountUsdc)}
                    </td>
                    <td className="px-4 py-4 lg:px-6">
                      <span className="inline-flex rounded border border-terminal-success/30 bg-terminal-bg px-3 py-1 text-xs font-semibold text-terminal-success">
                        {translateLiquidatedStatus(row.status, t)}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-terminal-muted lg:px-6">{row.txHash ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </InvestorSection>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  total,
  formatUsd,
  color = '#60a5fa'
}: {
  label: string;
  value: number;
  total: number;
  formatUsd: (value: number) => string;
  color?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-terminal-muted">
          {label} · {pct}%
        </span>
        <span className="font-mono text-terminal-text">{formatUsd(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-terminal-bg">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
