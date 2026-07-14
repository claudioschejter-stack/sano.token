'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  ShoppingBag,
  TrendingUp,
  Upload
} from 'lucide-react';
import { useTranslation, useLocale } from '../../i18n/LocaleProvider';
import { createIntlFormatters } from '../../i18n/formatters';
import { formatMessage } from '../../i18n';
import type { AggregatedPortfolio } from '../../lib/portfolio/portfolioAggregator';
import { useDividendStore } from '../../store/useDividendStore';
import { translateDistributionConcept } from '../../i18n/demoLabels';
import { PwaPropertyCarousel } from './PwaPropertyCarousel';
import { MP_ACCENT, MP_ACCENT_SOFT } from '../../lib/pwa/mpTheme';

type Props = {
  portfolio: AggregatedPortfolio | null;
  historicalYieldPercent: number | null;
};

export function PwaDashboard({ portfolio, historicalYieldPercent }: Props) {
  const t = useTranslation();
  const h = t.pwaHome;
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
            <span className="text-sm font-medium text-slate-900">{h.myMoneyTitle}</span>
            <Link href="/dashboard/portfolio" className="text-slate-400" aria-label={t.nav.myAssets}>
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
              aria-label={showBalance ? h.hideBalance : h.showBalance}
            >
              {showBalance ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>

          {historicalYieldPercent != null ? (
            <>
              <div className="mt-1 flex items-center gap-1 text-sm font-medium text-emerald-600">
                <TrendingUp size={14} />
                <span>
                  {formatMessage(h.historicalYieldLabel, {
                    percent: formatPercent(historicalYieldPercent)
                  })}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">{h.historicalYieldFootnote}</p>
            </>
          ) : null}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Link
              href="/marketplace/carrito?mode=deposit"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4 transition-colors active:opacity-80"
              style={{ backgroundColor: MP_ACCENT_SOFT }}
            >
              <Download size={24} strokeWidth={1.5} style={{ color: MP_ACCENT }} />
              <span className="text-xs font-medium text-slate-900">{h.depositAction}</span>
            </Link>
            <Link
              href="/dashboard/portfolio?tab=wallet"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4 transition-colors active:opacity-80"
              style={{ backgroundColor: MP_ACCENT_SOFT }}
            >
              <Upload size={24} strokeWidth={1.5} style={{ color: MP_ACCENT }} />
              <span className="text-xs font-medium text-slate-900">{h.withdrawAction}</span>
            </Link>
            <Link
              href="/marketplace"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4 transition-colors active:opacity-80"
              style={{ backgroundColor: MP_ACCENT_SOFT }}
            >
              <ShoppingBag size={24} strokeWidth={1.5} style={{ color: MP_ACCENT }} />
              <span className="text-xs font-medium text-slate-900">{h.marketplaceAction}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4">
        <h3 className="text-lg font-bold text-slate-900">{h.recentActivityTitle}</h3>

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
            <div className="p-6 text-center text-sm text-slate-500">{h.recentActivityEmpty}</div>
          )}
        </div>

        <Link
          href="/dashboard/cash-flow"
          className="mt-3 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold"
          style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
        >
          {h.viewAllActivity}
          <ChevronRight size={16} />
        </Link>
      </div>

      <PwaPropertyCarousel title={h.investNowTitle} limit={5} layout="feed" />

      <div className="px-4 pt-2 text-center text-xs text-slate-400">
        <Link href="/terminos" className="font-medium" style={{ color: MP_ACCENT }}>
          {t.legal.portalFooterTerms}
        </Link>
        {' · '}
        <Link href="/privacidad" className="font-medium" style={{ color: MP_ACCENT }}>
          {t.legal.portalFooterPrivacy}
        </Link>
      </div>
    </div>
  );
}
