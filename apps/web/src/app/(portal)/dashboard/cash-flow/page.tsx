'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Banknote, CheckCircle2, CircleDollarSign, Landmark } from 'lucide-react';
import {
  translateAssetLabel,
  translateCashFlowConcept,
  translateLiquidatedStatus
} from '../../../../i18n/demoLabels';
import { createIntlFormatters } from '../../../../i18n/formatters';
import { useLocale, useTranslation } from '../../../../i18n/LocaleProvider';
import { usePortfolioStore } from '../../../../store/usePortfolioStore';
import { DashboardSkeleton } from '../../../../components/dashboard/DashboardSkeleton';
import { InvestorKpiCard } from '../../../../components/dashboard/investor/InvestorKpiCard';
import { InvestorPageHeader } from '../../../../components/dashboard/investor/InvestorPageHeader';
import { InvestorSection } from '../../../../components/dashboard/investor/InvestorSection';
import { RentPayoutPreferencePanel } from '../../../../components/dashboard/investor/RentPayoutPreferencePanel';
import { ProjectYieldPanel } from '../../../../components/dashboard/ProjectYieldPanel';

export default function CashFlowPage() {
  const t = useTranslation();
  const c = t.cashFlow;
  const { intlLocale } = useLocale();
  const { formatUsd, formatDate } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

  const [mounted, setMounted] = useState(false);
  const [isRepaying, setIsRepaying] = useState(false);
  const [repaymentError, setRepaymentError] = useState<string | null>(null);
  const availableCash = usePortfolioStore((state) => state.availableCash);
  const marginDebt = usePortfolioStore((state) => state.marginDebt);
  const cashFlowHistory = usePortfolioStore((state) => state.cashFlowHistory);
  const isLoading = usePortfolioStore((state) => state.isLoading);
  const fetchPortfolio = usePortfolioStore((state) => state.fetchPortfolio);
  const applyCashToMarginRepayment = usePortfolioStore((state) => state.applyCashToMarginRepayment);

  useEffect(() => {
    setMounted(true);
    void fetchPortfolio();
  }, [fetchPortfolio]);

  const totalDistributed = useMemo(
    () => cashFlowHistory.reduce((sum, record) => sum + record.amountUsd, 0),
    [cashFlowHistory]
  );

  const repaymentCoverage = marginDebt > 0 ? Math.min((availableCash / marginDebt) * 100, 100) : 100;

  const handleRepayMargin = async () => {
    setIsRepaying(true);
    setRepaymentError(null);

    try {
      await applyCashToMarginRepayment();
    } catch (error) {
      setRepaymentError(error instanceof Error ? error.message : c.repayError);
    } finally {
      setIsRepaying(false);
    }
  };

  if (!mounted) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 bg-terminal-bg text-terminal-text md:space-y-8">
      <InvestorPageHeader eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InvestorKpiCard
          label={c.availableCashLabel}
          value={isLoading ? '—' : formatUsd(availableCash)}
          hint={c.coverageLabel}
          icon={<CircleDollarSign size={24} />}
          valueClassName="text-terminal-primary"
          iconClassName="bg-terminal-bg text-terminal-primary"
        />
        <InvestorKpiCard
          label={c.totalDistributedLabel}
          value={isLoading ? '—' : formatUsd(totalDistributed)}
          hint={`${repaymentCoverage.toFixed(1)}% ${c.coverageLabel.toLowerCase()}`}
          icon={<Banknote size={24} />}
          valueClassName="text-terminal-accent"
          iconClassName="bg-terminal-bg text-terminal-accent"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
        <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-terminal-muted">{c.availableCashLabel}</p>
              <h2 className="mt-2 font-mono text-3xl font-bold text-terminal-text sm:text-4xl">
                {isLoading ? t.common.loadingGeneric : formatUsd(availableCash)}
              </h2>
            </div>
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3 text-terminal-success">
              <CircleDollarSign size={26} />
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-terminal-muted">{c.coverageLabel}</span>
              <span className="font-bold text-terminal-text">{repaymentCoverage.toFixed(1)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-terminal-bg">
              <div className="h-full rounded-full bg-terminal-success" style={{ width: `${repaymentCoverage}%` }} />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRepayMargin}
            disabled={isLoading || isRepaying || availableCash <= 0}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowDownToLine size={18} />
            {isRepaying ? c.repaying : c.repayButton}
          </button>
          {repaymentError ? <p className="mt-3 text-sm font-medium text-terminal-warning">{repaymentError}</p> : null}
        </article>

        <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
          <h3 className="text-sm font-medium text-terminal-muted">{c.totalDistributedLabel}</h3>
          <p className="mt-2 font-mono text-2xl font-bold text-terminal-text sm:text-3xl">
            {isLoading ? t.common.loadingGeneric : formatUsd(totalDistributed)}
          </p>
          <div className="mt-4 space-y-3">
            {cashFlowHistory.slice(0, 4).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-lg border border-terminal-border bg-terminal-bg p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-lg border border-terminal-border bg-terminal-card p-2 text-terminal-muted">
                    <Landmark size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-terminal-text">{translateAssetLabel(record.assetId, t)}</p>
                    <p className="text-xs text-terminal-muted">{translateLiquidatedStatus(record.status, t)}</p>
                  </div>
                </div>
                <p className="shrink-0 font-mono text-sm font-bold text-terminal-success">{formatUsd(record.amountUsd)}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <RentPayoutPreferencePanel />

      <ProjectYieldPanel />

      <InvestorSection title={c.historyTitle} bodyClassName="p-0">
        <div className="space-y-3 p-4 md:hidden">
          {cashFlowHistory.map((record) => (
            <article key={record.id} className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-terminal-text">
                    {translateCashFlowConcept(record.id, record.concept, t)}
                  </p>
                  <p className="mt-1 text-xs text-terminal-muted">{formatDate(record.date)}</p>
                </div>
                <p className="font-mono text-sm font-bold text-terminal-accent">{formatUsd(record.amountUsd)}</p>
              </div>
              <p className="mt-2 text-xs text-terminal-muted">{translateAssetLabel(record.assetId, t)}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-terminal-success/30 px-2 py-0.5 text-xs font-semibold text-terminal-success">
                <CheckCircle2 size={12} />
                {translateLiquidatedStatus(record.status, t)}
              </span>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
              <tr>
                <th className="px-4 py-3 lg:px-6">{c.colConcept}</th>
                <th className="px-4 py-3 lg:px-6">{c.colDate}</th>
                <th className="px-4 py-3 lg:px-6">{c.colAsset}</th>
                <th className="px-4 py-3 text-right lg:px-6">{c.colAmount}</th>
                <th className="px-4 py-3 lg:px-6">{c.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border">
              {cashFlowHistory.map((record) => (
                <tr key={record.id} className="hover:bg-terminal-bg/60">
                  <td className="px-4 py-4 font-medium text-terminal-text lg:px-6">
                    {translateCashFlowConcept(record.id, record.concept, t)}
                  </td>
                  <td className="px-4 py-4 text-terminal-muted lg:px-6">{formatDate(record.date)}</td>
                  <td className="px-4 py-4 text-terminal-muted lg:px-6">{translateAssetLabel(record.assetId, t)}</td>
                  <td className="px-4 py-4 text-right font-mono font-bold text-terminal-accent lg:px-6">
                    {formatUsd(record.amountUsd)}
                  </td>
                  <td className="px-4 py-4 lg:px-6">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-terminal-success/30 bg-terminal-bg px-3 py-1 text-xs font-semibold text-terminal-success">
                      <CheckCircle2 size={14} />
                      {translateLiquidatedStatus(record.status, t)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InvestorSection>
    </div>
  );
}
