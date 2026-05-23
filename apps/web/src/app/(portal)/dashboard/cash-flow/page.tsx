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
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-600">{c.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{c.title}</h1>
        <p className="mt-2 max-w-3xl text-slate-500">{c.subtitle}</p>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">{c.availableCashLabel}</p>
              <h2 className="mt-3 text-4xl font-bold text-slate-900">
                {isLoading ? t.common.loadingGeneric : formatUsd(availableCash)}
              </h2>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <CircleDollarSign size={28} />
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-600">{c.coverageLabel}</span>
              <span className="font-bold text-slate-900">{repaymentCoverage.toFixed(1)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${repaymentCoverage}%` }} />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRepayMargin}
            disabled={isLoading || isRepaying || availableCash <= 0}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ArrowDownToLine size={18} />
            {isRepaying ? c.repaying : c.repayButton}
          </button>
          {repaymentError ? <p className="mt-3 text-sm font-medium text-red-600">{repaymentError}</p> : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{c.totalDistributedLabel}</p>
              <h3 className="mt-3 text-3xl font-bold text-slate-900">
                {isLoading ? t.common.loadingGeneric : formatUsd(totalDistributed)}
              </h3>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Banknote size={24} />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {cashFlowHistory.map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white p-2 text-slate-600">
                    <Landmark size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{translateAssetLabel(record.assetId, t)}</p>
                    <p className="text-xs text-slate-500">{translateLiquidatedStatus(record.status, t)}</p>
                  </div>
                </div>
                <p className="font-bold text-emerald-600">{formatUsd(record.amountUsd)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{c.historyTitle}</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">{c.colConcept}</th>
                <th className="px-6 py-3">{c.colDate}</th>
                <th className="px-6 py-3">{c.colAsset}</th>
                <th className="px-6 py-3 text-right">{c.colAmount}</th>
                <th className="px-6 py-3">{c.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cashFlowHistory.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {translateCashFlowConcept(record.id, record.concept, t)}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{formatDate(record.date)}</td>
                  <td className="px-6 py-4 text-slate-600">{translateAssetLabel(record.assetId, t)}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">{formatUsd(record.amountUsd)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={14} />
                      {translateLiquidatedStatus(record.status, t)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
