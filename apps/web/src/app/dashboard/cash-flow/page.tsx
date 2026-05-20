'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Banknote, CheckCircle2, CircleDollarSign, Landmark } from 'lucide-react';
import { apiClient } from '../../../lib/apiClient';
import { usePortfolioStore } from '../../../store/usePortfolioStore';

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${date}T00:00:00`));

export default function CashFlowPage() {
  const [mounted, setMounted] = useState(false);
  const [isRepaying, setIsRepaying] = useState(false);
  const [repaymentError, setRepaymentError] = useState<string | null>(null);
  const userId = usePortfolioStore((state) => state.userId);
  const availableCash = usePortfolioStore((state) => state.availableCash);
  const marginDebt = usePortfolioStore((state) => state.marginDebt);
  const cashFlowHistory = usePortfolioStore((state) => state.cashFlowHistory);
  const isLoading = usePortfolioStore((state) => state.isLoading);
  const fetchPortfolio = usePortfolioStore((state) => state.fetchPortfolio);
  const applyCashToMarginRepayment = usePortfolioStore((state) => state.applyCashToMarginRepayment);

  useEffect(() => {
    setMounted(true);
    fetchPortfolio();
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
      await apiClient('/portfolio/repay-margin', {
        method: 'POST',
        body: { userId }
      });
      applyCashToMarginRepayment();
      fetchPortfolio();
    } catch (error) {
      setRepaymentError(error instanceof Error ? error.message : 'No se pudo aplicar el repago de margen.');
    } finally {
      setIsRepaying(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-600">Flujo de Caja</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Dividendos en efectivo para repago de margen</h1>
        <p className="mt-2 max-w-3xl text-slate-500">
          Los rendimientos operativos se liquidan estrictamente en cash para facilitar la amortización de pasivos de la
          cuenta de inversión.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Efectivo Acumulado Disponible para Repago</p>
              <h2 className="mt-3 text-4xl font-bold text-slate-900">
                {isLoading ? 'Cargando...' : formatUsd(availableCash)}
              </h2>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <CircleDollarSign size={28} />
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-600">Cobertura contra deuda activa</span>
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
            {isRepaying ? 'Procesando repago...' : 'Aplicar al Repago de Margen'}
          </button>
          {repaymentError ? <p className="mt-3 text-sm font-medium text-red-600">{repaymentError}</p> : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total distribuido</p>
              <h3 className="mt-3 text-3xl font-bold text-slate-900">
                {isLoading ? 'Cargando...' : formatUsd(totalDistributed)}
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
                    <p className="font-semibold text-slate-900">{record.assetId}</p>
                    <p className="text-xs text-slate-500">{record.status}</p>
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
          <h2 className="text-lg font-bold text-slate-900">Histórico de distribución de dividendos</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Concepto</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Activo</th>
                <th className="px-6 py-3 text-right">Monto USD</th>
                <th className="px-6 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cashFlowHistory.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 font-medium text-slate-900">{record.concept}</td>
                  <td className="px-6 py-4 text-slate-600">{formatDate(record.date)}</td>
                  <td className="px-6 py-4 text-slate-600">{record.assetId}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">{formatUsd(record.amountUsd)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={14} />
                      {record.status}
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
