'use client';

import Link from 'next/link';
import { ArrowLeft, CircleDollarSign, Landmark, RefreshCw, TrendingDown, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { PayoutListFilter, TreasuryOverview } from '../../lib/admin/treasuryService';
import { AdminGate } from './AdminGate';

type PayoutFilter = PayoutListFilter;

const FILTER_OPTIONS: PayoutFilter[] = ['ALL', 'PENDING', 'SUCCESS', 'FAILED'];

type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
};

function KpiCard({ label, value, hint, icon }: KpiCardProps) {
  return (
    <article className="rounded-xl border border-terminal-border bg-terminal-card p-6 shadow-[0_0_0_1px_rgba(31,41,55,0.5)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-terminal-muted">{label}</p>
          <p className="mt-3 font-mono text-2xl font-bold tracking-tight text-terminal-text">{value}</p>
          <p className="mt-2 text-xs text-terminal-muted">{hint}</p>
        </div>
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3 text-terminal-primary">{icon}</div>
      </div>
    </article>
  );
}

function payoutStatusClass(status: string): string {
  if (status === 'SUCCESS') {
    return 'border-terminal-success/30 text-terminal-success';
  }

  if (status === 'FAILED') {
    return 'border-red-500/30 text-red-400';
  }

  return 'border-terminal-warning/30 text-terminal-warning';
}

export function AdminTreasuryView() {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatUsd, formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

  const [filter, setFilter] = useState<PayoutFilter>('ALL');
  const [overview, setOverview] = useState<TreasuryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const payoutStatusLabels = t.adminTreasury.payoutStatus as Record<string, string>;
  const filterLabels = t.adminTreasury.filters as Record<PayoutFilter, string>;

  const loadOverview = useCallback(async (nextFilter: PayoutFilter) => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch(`/api/admin/treasury?status=${nextFilter}`);
      if (!response.ok) {
        throw new Error('Failed to load treasury');
      }

      const data = (await response.json()) as TreasuryOverview;
      setOverview(data);
    } catch {
      setError(true);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview(filter);
  }, [filter, loadOverview]);

  const summary = overview?.summary;

  return (
    <AdminGate>
      <div className="mx-auto max-w-7xl space-y-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-terminal-muted transition-colors hover:text-terminal-primary"
        >
          <ArrowLeft size={16} />
          {t.adminDashboard.backToPanel}
        </Link>

        <header className="border-b border-terminal-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
            {t.adminDashboard.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text">{t.adminNav.treasury}</h1>
          <p className="mt-3 max-w-3xl text-terminal-muted">{t.adminDashboard.treasuryDesc}</p>
        </header>

        {loading ? (
          <p className="text-sm text-terminal-muted">{t.adminTreasury.loading}</p>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-terminal-card p-6">
            <p className="text-sm text-red-400">{t.adminTreasury.error}</p>
            <button
              type="button"
              onClick={() => void loadOverview(filter)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-text transition-colors hover:border-terminal-primary/40"
            >
              <RefreshCw size={16} />
              {t.adminTreasury.refresh}
            </button>
          </div>
        ) : summary ? (
          <>
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label={t.adminTreasury.kpiCapital}
                value={formatUsd(summary.totalCapitalUsd)}
                hint={t.adminTreasury.kpiCapitalHint.replace('{count}', String(summary.investorCount))}
                icon={<CircleDollarSign size={24} />}
              />
              <KpiCard
                label={t.adminTreasury.kpiMarginDebt}
                value={formatUsd(summary.totalMarginDebtUsd)}
                hint={t.adminTreasury.kpiMarginDebtHint}
                icon={<TrendingDown size={24} />}
              />
              <KpiCard
                label={t.adminTreasury.kpiPayouts}
                value={formatUsd(summary.totalPayoutsUsd)}
                hint={t.adminTreasury.kpiPayoutsHint.replace('{count}', String(summary.pendingPayouts))}
                icon={<Landmark size={24} />}
              />
              <KpiCard
                label={t.adminTreasury.kpiLiquidPaid}
                value={formatUsd(summary.totalLiquidPaidUsd)}
                hint={t.adminTreasury.kpiLiquidPaidHint.replace(
                  '{offset}',
                  formatUsd(summary.totalDebtOffsetUsd)
                )}
                icon={<Wallet size={24} />}
              />
            </section>

            <section className="rounded-xl border border-terminal-border bg-terminal-card">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-terminal-border px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-terminal-text">{t.adminTreasury.payoutsTitle}</h2>
                  <p className="mt-1 text-sm text-terminal-muted">{t.adminTreasury.payoutsDesc}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFilter(option)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        filter === option
                          ? 'border-terminal-primary/40 bg-terminal-bg text-terminal-primary'
                          : 'border-terminal-border text-terminal-muted hover:text-terminal-text'
                      }`}
                    >
                      {filterLabels[option]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void loadOverview(filter)}
                    className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-3 py-1.5 text-xs text-terminal-muted transition-colors hover:text-terminal-text"
                  >
                    <RefreshCw size={14} />
                    {t.adminTreasury.refresh}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                    <tr>
                      <th className="px-6 py-3">{t.adminTreasury.colProject}</th>
                      <th className="px-6 py-3">{t.adminTreasury.colDate}</th>
                      <th className="px-6 py-3 text-right">{t.adminTreasury.colTotal}</th>
                      <th className="px-6 py-3 text-right">{t.adminTreasury.colLiquid}</th>
                      <th className="px-6 py-3 text-right">{t.adminTreasury.colDebtOffset}</th>
                      <th className="px-6 py-3">{t.adminTreasury.colStatus}</th>
                      <th className="px-6 py-3">{t.adminTreasury.colTx}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-terminal-border">
                    {!overview.payouts.length ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-terminal-muted">
                          {t.adminTreasury.emptyPayouts}
                        </td>
                      </tr>
                    ) : (
                      overview.payouts.map((row) => (
                        <tr key={row.id} className="transition-colors hover:bg-terminal-bg/60">
                          <td className="px-6 py-4">
                            <p className="font-medium text-terminal-text">{row.projectTitle}</p>
                            <p className="mt-1 text-xs text-terminal-muted">
                              {t.adminTreasury.receiptCount.replace('{count}', String(row.receiptCount))}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-terminal-muted">
                            {formatDateTime(row.executedAt)}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-terminal-text">
                            {formatUsd(row.totalAmountPaid)}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-terminal-success">
                            {formatUsd(row.liquidPaidUsd)}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-terminal-muted">
                            {formatUsd(row.debtOffsetUsd)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${payoutStatusClass(row.status)}`}
                            >
                              {payoutStatusLabels[row.status] ?? row.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-terminal-muted">
                            {`${row.txHash.slice(0, 8)}…${row.txHash.slice(-6)}`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-terminal-border bg-terminal-card">
              <div className="border-b border-terminal-border px-6 py-4">
                <h2 className="text-lg font-semibold text-terminal-text">{t.adminTreasury.distributionsTitle}</h2>
                <p className="mt-1 text-sm text-terminal-muted">
                  {t.adminTreasury.distributionsDesc.replace('{count}', String(summary.distributionCount))}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                    <tr>
                      <th className="px-6 py-3">{t.adminTreasury.colInvestor}</th>
                      <th className="px-6 py-3">{t.adminTreasury.colAsset}</th>
                      <th className="px-6 py-3">{t.adminTreasury.colDate}</th>
                      <th className="px-6 py-3 text-right">{t.adminTreasury.colAmount}</th>
                      <th className="px-6 py-3">{t.adminTreasury.colMarginApplied}</th>
                      <th className="px-6 py-3">{t.adminTreasury.colStatus}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-terminal-border">
                    {!overview.distributions.length ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-terminal-muted">
                          {t.adminTreasury.emptyDistributions}
                        </td>
                      </tr>
                    ) : (
                      overview.distributions.map((row) => (
                        <tr key={row.id} className="transition-colors hover:bg-terminal-bg/60">
                          <td className="px-6 py-4">
                            <p className="font-medium text-terminal-text">{row.investorName}</p>
                            <p className="mt-1 text-xs text-terminal-muted">{row.investorEmail}</p>
                          </td>
                          <td className="px-6 py-4 text-terminal-muted">{row.assetId}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-terminal-muted">
                            {formatDateTime(row.distributedAt)}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-terminal-text">
                            {formatUsd(row.amount)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${
                                row.appliedToMargin
                                  ? 'border-terminal-primary/30 text-terminal-primary'
                                  : 'border-terminal-border text-terminal-muted'
                              }`}
                            >
                              {row.appliedToMargin ? t.adminTreasury.yes : t.adminTreasury.no}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-terminal-muted">{row.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AdminGate>
  );
}
