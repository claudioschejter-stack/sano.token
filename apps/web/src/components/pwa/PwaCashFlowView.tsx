'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, CircleDollarSign, TrendingUp } from 'lucide-react';
import { translateCashFlowConcept, translateLiquidatedStatus } from '../../i18n/demoLabels';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton';
import { collectionWalletHref } from '../../lib/navigation/collectionWalletPath';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

export function PwaCashFlowView() {
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

  const totalDistributed = useMemo(
    () => cashFlowHistory.reduce((sum, record) => sum + record.amountUsd, 0),
    [cashFlowHistory]
  );

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

  if (!mounted) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="-mx-4 space-y-5 pb-2 font-sans">
      <div className="px-4">
        <h1 className="text-xl font-bold text-slate-900">{c.title}</h1>
        <p className="mt-1 text-sm text-slate-500">Rentas y movimientos en USDC</p>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-3">
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2 text-slate-500">
            <CircleDollarSign size={18} style={{ color: MP_ACCENT }} />
            <span className="text-xs font-medium uppercase">{c.availableCashLabel}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {isLoading ? '—' : formatUsd(availableCash)}
          </p>
        </article>
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2 text-slate-500">
            <Banknote size={18} className="text-amber-500" />
            <span className="text-xs font-medium uppercase">{c.morphoDebtLabel}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {isLoading ? '—' : formatUsd(marginDebt)}
          </p>
        </article>
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2 text-slate-500">
            <TrendingUp size={18} className="text-emerald-500" />
            <span className="text-xs font-medium uppercase">{c.totalDistributedLabel}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {isLoading ? '—' : formatUsd(totalDistributed)}
          </p>
        </article>
      </div>

      <section className="px-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {c.historyTitle}
        </h2>
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          {cashFlowHistory.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Sin movimientos registrados.</p>
          ) : (
            cashFlowHistory.map((record, idx) => (
              <article
                key={record.id}
                className={`p-4 ${idx !== 0 ? 'border-t border-slate-100' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {translateCashFlowConcept(record.conceptCode, record.concept, t)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(record.date)}</p>
                  </div>
                  <p className="font-bold text-emerald-600">{formatUsd(record.amountUsd)}</p>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {translateLiquidatedStatus(record.statusCode, record.status, t)}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
