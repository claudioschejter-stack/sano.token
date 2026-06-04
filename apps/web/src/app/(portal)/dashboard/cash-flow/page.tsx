'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, CircleDollarSign, Landmark } from 'lucide-react';
import {
  translateAssetLabel,
  translateCashFlowConcept,
  translateLiquidatedStatus
} from '../../../../i18n/demoLabels';
import { createIntlFormatters } from '../../../../i18n/formatters';
import { useLocale, useTranslation } from '../../../../i18n/LocaleProvider';
import { useLinkedWalletGuard } from '../../../../hooks/useLinkedWalletGuard';
import { usePortfolioStore } from '../../../../store/usePortfolioStore';
import { DashboardSkeleton } from '../../../../components/dashboard/DashboardSkeleton';
import { InvestorKpiCard } from '../../../../components/dashboard/investor/InvestorKpiCard';
import { InvestorPageHeader } from '../../../../components/dashboard/investor/InvestorPageHeader';
import { InvestorSection } from '../../../../components/dashboard/investor/InvestorSection';
import { MorphoRepayPanel } from '../../../../components/dashboard/investor/MorphoRepayPanel';
import { ProjectYieldPanel } from '../../../../components/dashboard/ProjectYieldPanel';
import { CheckCircle2 } from 'lucide-react';
import { collectionWalletHref } from '../../../../lib/navigation/collectionWalletPath';

export default function CashFlowPage() {
  const t = useTranslation();
  const c = t.cashFlow;
  const router = useRouter();
  const walletGuard = useLinkedWalletGuard();
  const { intlLocale } = useLocale();
  const { formatUsd, formatDate } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

  const [mounted, setMounted] = useState(false);
  const availableCash = usePortfolioStore((state) => state.availableCash);
  const marginDebt = usePortfolioStore((state) => state.marginDebt);
  const cashFlowHistory = usePortfolioStore((state) => state.cashFlowHistory);
  const isLoading = usePortfolioStore((state) => state.isLoading);
  const fetchPortfolio = usePortfolioStore((state) => state.fetchPortfolio);

  useEffect(() => {
    setMounted(true);
    void fetchPortfolio();
  }, [fetchPortfolio]);

  useEffect(() => {
    if (!mounted || !walletGuard.isWalletMismatch) {
      return;
    }

    router.replace(collectionWalletHref({ returnTo: '/dashboard/cash-flow' }));
  }, [mounted, router, walletGuard.isWalletMismatch]);

  const totalDistributed = useMemo(
    () => cashFlowHistory.reduce((sum, record) => sum + record.amountUsd, 0),
    [cashFlowHistory]
  );

  if (!mounted) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 bg-terminal-bg text-terminal-text md:space-y-8">
      <InvestorPageHeader eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InvestorKpiCard
          label={c.availableCashLabel}
          value={isLoading ? '—' : formatUsd(availableCash)}
          hint={c.availableCashHint}
          icon={<CircleDollarSign size={24} />}
          valueClassName="text-terminal-primary"
          iconClassName="bg-terminal-bg text-terminal-primary"
        />
        <InvestorKpiCard
          label={c.morphoDebtLabel}
          value={isLoading ? '—' : formatUsd(marginDebt)}
          hint={c.morphoDebtHint}
          icon={<Landmark size={24} />}
          valueClassName="text-terminal-warning"
          iconClassName="bg-terminal-bg text-terminal-warning"
        />
        <InvestorKpiCard
          label={c.totalDistributedLabel}
          value={isLoading ? '—' : formatUsd(totalDistributed)}
          hint={c.totalDistributedHint}
          icon={<Banknote size={24} />}
          valueClassName="text-terminal-accent"
          iconClassName="bg-terminal-bg text-terminal-accent"
        />
      </section>

      <MorphoRepayPanel onRepaid={() => void fetchPortfolio()} />

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
