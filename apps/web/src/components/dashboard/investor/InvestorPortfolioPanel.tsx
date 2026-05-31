'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, Minus, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { AggregatedPortfolio } from '../../../lib/portfolio/portfolioAggregator';
import { createIntlFormatters } from '../../../i18n/formatters';
import { useLocale, useTranslation } from '../../../i18n/LocaleProvider';
import { DashboardSkeleton } from '../DashboardSkeleton';
import { InvestorKpiCard } from './InvestorKpiCard';
import { InvestorSection } from './InvestorSection';

type PositionRow = AggregatedPortfolio['positions'][number];

function PositionTable({
  rows,
  labels,
  formatUsd,
  intlLocale
}: {
  rows: PositionRow[];
  labels: {
    colInstrument: string;
    colValueUsdc: string;
    colPosition: string;
    colValueUsd: string;
    empty: string;
  };
  formatUsd: (value: number) => string;
  intlLocale: string;
}) {
  if (!rows.length) {
    return <p className="px-4 py-6 text-sm text-terminal-muted sm:px-6">{labels.empty}</p>;
  }

  return (
    <>
      <div className="space-y-3 p-4 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
            <p className="font-medium text-terminal-text">{row.label}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-terminal-muted">{labels.colValueUsdc}</p>
                <p className="font-mono font-semibold">{formatUsd(row.valueUsdc)}</p>
              </div>
              <div>
                <p className="text-xs text-terminal-muted">{labels.colValueUsd}</p>
                <p className="font-mono font-semibold">{formatUsd(row.valueUsd)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-terminal-muted">{labels.colPosition}</p>
                <p className="font-mono text-sm">
                  {row.amount.toLocaleString(intlLocale, { maximumFractionDigits: 6 })} {row.currency}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="border-b border-terminal-border bg-terminal-bg/60 text-left text-xs uppercase tracking-wider text-terminal-muted">
            <tr>
              <th className="px-4 py-3 lg:px-6">{labels.colInstrument}</th>
              <th className="px-4 py-3 text-right lg:px-6">{labels.colValueUsdc}</th>
              <th className="px-4 py-3 text-right lg:px-6">{labels.colPosition}</th>
              <th className="px-4 py-3 text-right lg:px-6">{labels.colValueUsd}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-terminal-border/60 last:border-0">
                <td className="px-4 py-3 font-medium text-terminal-text lg:px-6">{row.label}</td>
                <td className="px-4 py-3 text-right font-mono lg:px-6">{formatUsd(row.valueUsdc)}</td>
                <td className="px-4 py-3 text-right font-mono text-terminal-muted lg:px-6">
                  {row.amount.toLocaleString(intlLocale, { maximumFractionDigits: 6 })} {row.currency}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-terminal-primary lg:px-6">
                  {formatUsd(row.valueUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function InvestorPortfolioPanel() {
  const t = useTranslation();
  const p = t.portfolio;
  const { intlLocale } = useLocale();
  const { formatUsd, formatDate } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

  const [portfolio, setPortfolio] = useState<AggregatedPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: { portfolio?: AggregatedPortfolio }) => setPortfolio(data.portfolio ?? null))
      .catch(() => setPortfolio(null))
      .finally(() => setIsLoading(false));
  }, []);

  const tokenPositions = useMemo(
    () => portfolio?.positions.filter((row) => row.type === 'RWA_TOKEN') ?? [],
    [portfolio]
  );
  const stablecoinPositions = useMemo(
    () => portfolio?.positions.filter((row) => row.type === 'STABLECOIN') ?? [],
    [portfolio]
  );
  const fiatPositions = useMemo(
    () => portfolio?.positions.filter((row) => row.type === 'FIAT_BALANCE') ?? [],
    [portfolio]
  );

  const positionsSubtotalUsd = useMemo(() => {
    if (!portfolio) return 0;
    return portfolio.positions.reduce((sum, row) => sum + row.valueUsd, 0);
  }, [portfolio]);

  const tableLabels = {
    colInstrument: p.colInstrument,
    colValueUsdc: p.colValueUsdc,
    colPosition: p.colPosition,
    colValueUsd: p.colValueUsd,
    empty: p.sectionEmpty
  };

  const chartData = useMemo(() => {
    if (!portfolio) return [];
    if (portfolio.history.length) {
      return portfolio.history.map((point) => ({
        date: point.date,
        netLiquidValueUsd: point.netLiquidValueUsd
      }));
    }

    return [
      {
        date: new Date().toISOString(),
        netLiquidValueUsd: portfolio.totals.netLiquidValueUsd
      }
    ];
  }, [portfolio]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!portfolio) {
    return (
      <article className="rounded-xl border border-terminal-border bg-terminal-card p-8">
        <p className="text-terminal-muted">{p.loadError}</p>
      </article>
    );
  }

  const { totals } = portfolio;
  const reconciliationDelta = positionsSubtotalUsd - totals.debtUsd - totals.netLiquidValueUsd;

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <InvestorKpiCard
          label={p.netLiquidValue}
          value={formatUsd(totals.netLiquidValueUsd)}
          hint={p.netLiquidValueHint}
          icon={<CircleDollarSign size={24} />}
          valueClassName="text-terminal-primary"
          iconClassName="bg-terminal-bg text-terminal-primary"
        />
        <InvestorKpiCard
          label={p.grossAssets}
          value={formatUsd(totals.grossAssetsUsd)}
          hint={p.grossAssetsHint}
          icon={<TrendingUp size={24} />}
          valueClassName="text-terminal-text"
          iconClassName="bg-terminal-bg text-terminal-muted"
        />
        <InvestorKpiCard
          label={p.loansTaken}
          value={formatUsd(totals.debtUsd)}
          hint={p.loansTakenHint}
          icon={<Minus size={24} />}
          valueClassName="text-terminal-warning"
          iconClassName="bg-terminal-bg text-terminal-warning"
        />
      </section>

      <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-terminal-text sm:text-lg">{p.evolutionTitle}</h2>
            <p className="text-xs text-terminal-muted sm:text-sm">{p.evolutionSubtitle}</p>
          </div>
          <span className="w-fit rounded-full border border-terminal-primary/30 px-3 py-1 text-xs text-terminal-primary">
            {p.baseUsdBadge}
          </span>
        </div>
        <div className="h-56 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="netLiquidValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
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
                width={56}
                fontSize={11}
              />
              <Tooltip
                formatter={(value) => formatUsd(Number(value))}
                labelFormatter={(value) => formatDate(String(value))}
                contentStyle={{ background: '#020617', border: '1px solid #1f2937', borderRadius: 12 }}
              />
              <Area
                type="monotone"
                dataKey="netLiquidValueUsd"
                stroke="#34d399"
                fill="url(#netLiquidValue)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <InvestorSection title={p.sectionTokens} subtitle={p.sectionTokensHint} bodyClassName="p-0">
        <PositionTable
          rows={tokenPositions}
          labels={{ ...tableLabels, empty: p.sectionTokensEmpty }}
          formatUsd={formatUsd}
          intlLocale={intlLocale}
        />
      </InvestorSection>

      <InvestorSection title={p.sectionStablecoins} subtitle={p.sectionStablecoinsHint} bodyClassName="p-0">
        <PositionTable
          rows={stablecoinPositions}
          labels={{ ...tableLabels, empty: p.sectionStablecoinsEmpty }}
          formatUsd={formatUsd}
          intlLocale={intlLocale}
        />
      </InvestorSection>

      <InvestorSection title={p.sectionFiat} subtitle={p.sectionFiatHint} bodyClassName="p-0">
        <PositionTable
          rows={fiatPositions}
          labels={{ ...tableLabels, empty: p.sectionFiatEmpty }}
          formatUsd={formatUsd}
          intlLocale={intlLocale}
        />
      </InvestorSection>

      <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-terminal-text">{p.reconciliationTitle}</h3>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-terminal-muted">{p.positionsSubtotal}</span>
            <span className="font-mono text-terminal-text">{formatUsd(positionsSubtotalUsd)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-terminal-muted">{p.loansTaken}</span>
            <span className="font-mono text-terminal-warning">− {formatUsd(totals.debtUsd)}</span>
          </div>
          <div className="border-t border-terminal-border pt-2">
            <div className="flex justify-between gap-4 font-semibold">
              <span className="text-terminal-text">{p.netLiquidValue}</span>
              <span className="font-mono text-terminal-primary">{formatUsd(totals.netLiquidValueUsd)}</span>
            </div>
          </div>
        </div>
        {Math.abs(reconciliationDelta) > 0.01 ? (
          <p className="mt-3 text-xs text-terminal-warning">{p.reconciliationWarning}</p>
        ) : (
          <p className="mt-3 text-xs text-terminal-success">{p.reconciliationOk}</p>
        )}
      </article>
    </div>
  );
}
