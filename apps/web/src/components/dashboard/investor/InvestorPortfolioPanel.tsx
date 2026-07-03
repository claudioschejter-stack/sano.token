'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { InvestorKpiCard } from './InvestorKpiCard';
import { InvestorSection } from './InvestorSection';

type PositionRow = AggregatedPortfolio['positions'][number];

function sumPositionUsd(rows: PositionRow[]): number {
  return rows.reduce((sum, row) => sum + row.valueUsd, 0);
}

function formatAmount(value: number, intlLocale: string): string {
  return value.toLocaleString(intlLocale, { maximumFractionDigits: 6 });
}

function TokenActions({
  projectId,
  labels
}: {
  projectId: string;
  labels: { buy: string; sell: string; loan: string };
}) {
  const buttonClass =
    'inline-flex min-h-9 w-full items-center justify-center rounded-md px-2 py-1.5 text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-white sm:text-xs';

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <Link
        href={`/marketplace/${projectId}/checkout`}
        className={`${buttonClass} bg-terminal-primary hover:bg-blue-500`}
      >
        {labels.buy}
      </Link>
      <Link
        href={`/mercado-secundario?sell=${encodeURIComponent(projectId)}`}
        className={`${buttonClass} bg-terminal-success hover:bg-emerald-600`}
      >
        {labels.sell}
      </Link>
      <Link
        href={`/marketplace/${projectId}/prestamo`}
        className={`${buttonClass} bg-orange-500 hover:bg-orange-600`}
      >
        {labels.loan}
      </Link>
    </div>
  );
}

function RwaPositionTable({
  rows,
  labels,
  formatUsd,
  intlLocale
}: {
  rows: PositionRow[];
  labels: {
    colInstrument: string;
    colValueUsdc: string;
    colQuantity: string;
    colTokenCode: string;
    colValueUsd: string;
    colActions: string;
    actionBuy: string;
    actionSell: string;
    actionLoan: string;
    empty: string;
  };
  formatUsd: (value: number) => string;
  intlLocale: string;
}) {
  const actionLabels = { buy: labels.actionBuy, sell: labels.actionSell, loan: labels.actionLoan };

  const headerClass =
    'border-r border-terminal-border px-3 py-3 text-center text-xs uppercase tracking-wider text-terminal-muted last:border-r-0 lg:px-4';
  const cellClass =
    'border-r border-terminal-border px-3 py-3 text-center font-mono lg:px-4 last:border-r-0';
  const labelCellClass =
    'border-r border-terminal-border px-3 py-3 text-center font-medium text-terminal-text lg:px-4';

  return (
    <>
      <div className="space-y-3 p-4 md:hidden">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-terminal-muted">{labels.empty}</p>
        ) : null}
        {rows.map((row) => {
          const projectId = String(row.metadata?.projectId ?? '');
          return (
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
                <div>
                  <p className="text-xs text-terminal-muted">{labels.colQuantity}</p>
                  <p className="font-mono">{formatAmount(row.amount, intlLocale)}</p>
                </div>
                <div>
                  <p className="text-xs text-terminal-muted">{labels.colTokenCode}</p>
                  <p className="font-mono text-terminal-muted">{row.currency}</p>
                </div>
              </div>
              {projectId ? (
                <div className="mt-3 border-t border-terminal-border pt-3">
                  <TokenActions projectId={projectId} labels={actionLabels} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-terminal-border bg-terminal-bg/80">
              <th className={headerClass}>{labels.colInstrument}</th>
              <th className={headerClass}>{labels.colValueUsdc}</th>
              <th className={headerClass}>{labels.colQuantity}</th>
              <th className={headerClass}>{labels.colTokenCode}</th>
              <th className={headerClass}>{labels.colValueUsd}</th>
              <th className={`${headerClass} last:border-r-0`}>{labels.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-terminal-muted">
                  {labels.empty}
                </td>
              </tr>
            ) : null}
            {rows.map((row, index) => {
              const projectId = String(row.metadata?.projectId ?? '');
              return (
                <tr
                  key={row.id}
                  className={`border-b border-terminal-border ${index === rows.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className={labelCellClass}>{row.label}</td>
                  <td className={`${cellClass} text-terminal-text`}>{formatUsd(row.valueUsdc)}</td>
                  <td className={`${cellClass} text-terminal-text`}>{formatAmount(row.amount, intlLocale)}</td>
                  <td className={`${cellClass} text-terminal-muted`}>{row.currency}</td>
                  <td className={`${cellClass} font-semibold text-terminal-primary`}>
                    {formatUsd(row.valueUsd)}
                  </td>
                  <td className="px-3 py-3 lg:px-4">
                    {projectId ? <TokenActions projectId={projectId} labels={actionLabels} /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Shared column widths so stablecoin and fiat tables align when stacked. */
const SPLIT_TABLE_COL_WIDTHS = ['30%', '22%', '18%', '16%', '14%'] as const;

function SplitTableColGroup() {
  return (
    <colgroup>
      {SPLIT_TABLE_COL_WIDTHS.map((width) => (
        <col key={width} style={{ width }} />
      ))}
    </colgroup>
  );
}

function SplitPositionTable({
  rows,
  labels,
  formatUsd,
  intlLocale,
  quantityKey,
  typeKey
}: {
  rows: PositionRow[];
  labels: {
    colInstrument: string;
    colValueUsdc: string;
    colQuantity: string;
    colType: string;
    colValueUsd: string;
    empty: string;
  };
  formatUsd: (value: number) => string;
  intlLocale: string;
  quantityKey: 'amount';
  typeKey: 'currency';
}) {
  const headerClass =
    'border-r border-terminal-border px-3 py-3 text-center text-xs uppercase tracking-wider text-terminal-muted last:border-r-0 lg:px-4';
  const cellClass =
    'border-r border-terminal-border px-3 py-3 text-center font-mono lg:px-4 last:border-r-0';
  const labelCellClass =
    'border-r border-terminal-border px-3 py-3 text-center font-medium text-terminal-text lg:px-4';

  return (
    <>
      <div className="space-y-3 p-4 md:hidden">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-terminal-muted">{labels.empty}</p>
        ) : null}
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
              <div>
                <p className="text-xs text-terminal-muted">{labels.colQuantity}</p>
                <p className="font-mono">{formatAmount(row[quantityKey], intlLocale)}</p>
              </div>
              <div>
                <p className="text-xs text-terminal-muted">{labels.colType}</p>
                <p className="font-mono text-terminal-muted">{row[typeKey]}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
          <SplitTableColGroup />
          <thead>
            <tr className="border-b border-terminal-border bg-terminal-bg/80">
              <th className={headerClass}>{labels.colInstrument}</th>
              <th className={headerClass}>{labels.colValueUsdc}</th>
              <th className={headerClass}>{labels.colQuantity}</th>
              <th className={headerClass}>{labels.colType}</th>
              <th className={`${headerClass} last:border-r-0`}>{labels.colValueUsd}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-terminal-muted">
                  {labels.empty}
                </td>
              </tr>
            ) : null}
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={`border-b border-terminal-border ${index === rows.length - 1 ? 'border-b-0' : ''}`}
              >
                <td className={labelCellClass}>{row.label}</td>
                <td className={`${cellClass} text-terminal-text`}>{formatUsd(row.valueUsdc)}</td>
                <td className={`${cellClass} text-terminal-text`}>{formatAmount(row[quantityKey], intlLocale)}</td>
                <td className={`${cellClass} text-terminal-muted`}>{row[typeKey]}</td>
                <td className={`${cellClass} font-semibold text-terminal-primary`}>
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
  const { formatUsd } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

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

  const tokenTotalUsd = useMemo(() => sumPositionUsd(tokenPositions), [tokenPositions]);
  const stablecoinTotalUsd = useMemo(() => sumPositionUsd(stablecoinPositions), [stablecoinPositions]);
  const fiatTotalUsd = useMemo(() => sumPositionUsd(fiatPositions), [fiatPositions]);

  const sectionTotalClassName =
    'shrink-0 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-1.5 font-mono text-sm font-semibold text-terminal-primary';

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
    return (
      <div className="animate-pulse space-y-6 md:space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 rounded-xl border border-terminal-border bg-terminal-card" />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-terminal-border bg-terminal-card" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <article className="rounded-xl border border-terminal-border bg-terminal-card p-8">
        <p className="text-terminal-muted">{p.loadError}</p>
      </article>
    );
  }

  const { totals } = portfolio;

  const splitTableLabels = {
    colInstrument: p.colInstrument,
    colValueUsdc: p.colValueUsdc,
    colQuantity: p.colQuantity,
    colType: p.colStablecoinType,
    colValueUsd: p.colValueUsd,
    empty: p.sectionEmpty
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>article]:h-full">
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
                width={72}
                fontSize={11}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  return (
                    <div className="rounded-lg border border-terminal-border bg-terminal-card px-2.5 py-1.5 shadow-lg">
                      <p className="font-mono text-sm font-semibold text-terminal-primary">
                        {formatUsd(Number(payload[0]?.value ?? 0))}
                      </p>
                    </div>
                  );
                }}
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

      <InvestorSection
        title={p.sectionTokens}
        subtitle={p.sectionTokensHint}
        action={<span className={sectionTotalClassName}>{formatUsd(tokenTotalUsd)}</span>}
        bodyClassName="p-0"
      >
        <RwaPositionTable
          rows={tokenPositions}
          labels={{
            colInstrument: p.colInstrument,
            colValueUsdc: p.colValueUsdc,
            colQuantity: p.colQuantity,
            colTokenCode: p.colTokenCode,
            colValueUsd: p.colValueUsd,
            colActions: p.colActions,
            actionBuy: p.actionBuy,
            actionSell: p.actionSell,
            actionLoan: p.actionLoan,
            empty: p.sectionTokensEmpty
          }}
          formatUsd={formatUsd}
          intlLocale={intlLocale}
        />
      </InvestorSection>

      <InvestorSection
        title={p.sectionStablecoins}
        subtitle={p.sectionStablecoinsHint}
        action={<span className={sectionTotalClassName}>{formatUsd(stablecoinTotalUsd)}</span>}
        bodyClassName="p-0"
      >
        <SplitPositionTable
          rows={stablecoinPositions}
          labels={{ ...splitTableLabels, empty: p.sectionStablecoinsEmpty, colType: p.colStablecoinType }}
          formatUsd={formatUsd}
          intlLocale={intlLocale}
          quantityKey="amount"
          typeKey="currency"
        />
      </InvestorSection>

      <InvestorSection
        title={p.sectionFiat}
        subtitle={p.sectionFiatHint}
        action={<span className={sectionTotalClassName}>{formatUsd(fiatTotalUsd)}</span>}
        bodyClassName="p-0"
      >
        <SplitPositionTable
          rows={fiatPositions}
          labels={{
            ...splitTableLabels,
            colValueUsdc: p.colValue,
            empty: p.sectionFiatEmpty,
            colType: p.colCurrency
          }}
          formatUsd={formatUsd}
          intlLocale={intlLocale}
          quantityKey="amount"
          typeKey="currency"
        />
      </InvestorSection>
    </div>
  );
}
