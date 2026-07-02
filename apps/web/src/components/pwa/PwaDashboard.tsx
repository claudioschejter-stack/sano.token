'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  TrendingUp,
  Upload,
  Wallet
} from 'lucide-react';
import { useTranslation, useLocale } from '../../i18n/LocaleProvider';
import { createIntlFormatters } from '../../i18n/formatters';
import type { AggregatedPortfolio } from '../../lib/portfolio/portfolioAggregator';
import { useDividendStore } from '../../store/useDividendStore';
import { translateDistributionConcept } from '../../i18n/demoLabels';
import { PwaPropertyCarousel } from './PwaPropertyCarousel';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  portfolio: AggregatedPortfolio | null;
  displayTargetYield: number;
};

export function PwaDashboard({ portfolio, displayTargetYield }: Props) {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatUsd: formatUsdc, formatPercent, formatDateTime } = useMemo(
    () => createIntlFormatters(intlLocale),
    [intlLocale]
  );

  const distributions = useDividendStore((state) => state.distributions);
  const totalCashDividendsUsdc = useDividendStore((state) => state.totalCashDividendsUsdc);
  const [showBalance, setShowBalance] = useState(true);

  const totalBalance = (portfolio?.totals.totalValueUsd || 0) + totalCashDividendsUsdc;

  return (
    <div className="-mx-4 space-y-6 pb-2 font-sans">
      <div className="px-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-900">Tu dinero</span>
            <Link href="/dashboard/portfolio" className="text-slate-400" aria-label="Ver wallet">
              <ChevronRight size={20} />
            </Link>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-3xl font-bold text-slate-900">
              {showBalance ? formatUsdc(totalBalance) : '***'}
            </h2>
            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              style={{ color: MP_ACCENT }}
              aria-label={showBalance ? 'Ocultar saldo' : 'Mostrar saldo'}
            >
              {showBalance ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>

          <div className="mt-1 flex items-center gap-1 text-sm font-medium text-emerald-600">
            <TrendingUp size={14} />
            <span>Rinde {formatPercent(displayTargetYield / 100)} APY</span>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Link
              href="/marketplace/carrito?mode=deposit"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4 transition-colors active:opacity-80"
              style={{ backgroundColor: `${MP_ACCENT}15` }}
            >
              <Download size={24} strokeWidth={1.5} style={{ color: MP_ACCENT }} />
              <span className="text-xs font-medium text-slate-900">Ingresar</span>
            </Link>
            <Link
              href="/dashboard/portfolio"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4 transition-colors active:opacity-80"
              style={{ backgroundColor: `${MP_ACCENT}15` }}
            >
              <Upload size={24} strokeWidth={1.5} style={{ color: MP_ACCENT }} />
              <span className="text-xs font-medium text-slate-900">Retirar</span>
            </Link>
            <Link
              href="/dashboard/portfolio"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4 transition-colors active:opacity-80"
              style={{ backgroundColor: `${MP_ACCENT}15` }}
            >
              <Wallet size={24} strokeWidth={1.5} style={{ color: MP_ACCENT }} />
              <span className="text-xs font-medium text-slate-900">Wallet</span>
            </Link>
          </div>
        </div>
      </div>

      <PwaPropertyCarousel title="Invertir ahora" limit={5} />

      <div className="px-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Últimas actividades</h3>
          <Link href="/dashboard/cash-flow" className="text-sm font-medium" style={{ color: MP_ACCENT }}>
            Ver todo <ChevronRight size={14} className="inline" />
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          {distributions.slice(0, 3).map((dist, idx) => (
            <div
              key={dist.id}
              className={`flex items-center gap-4 p-4 ${idx !== 0 ? 'border-t border-slate-100' : ''}`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-600">
                <TrendingUp size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">
                  {translateDistributionConcept(dist.id, dist.concept, t)}
                </p>
                <p className="text-sm text-slate-500">Dinero disponible</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-emerald-600">+{formatUsdc(dist.amountUsdc)}</p>
                <p className="text-xs text-slate-400">{formatDateTime(dist.date).split(',')[0]}</p>
              </div>
            </div>
          ))}
          {distributions.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              Aún no tenés movimientos recientes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
