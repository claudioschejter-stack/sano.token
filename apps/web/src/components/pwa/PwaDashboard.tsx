'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
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
import type { InvestorActivityItem } from '../../lib/investor/investorActivityLedger';
import { useDividendStore } from '../../store/useDividendStore';
import { PwaPropertyCarousel } from './PwaPropertyCarousel';
import { MP_ACCENT, MP_ACCENT_SOFT } from '../../lib/pwa/mpTheme';

type Props = {
  portfolio: AggregatedPortfolio | null;
  historicalYieldPercent: number | null;
};

function activityIcon(kind: InvestorActivityItem['kind']) {
  if (kind === 'deposit' || kind === 'dividend' || kind === 'ledger_credit') {
    return <ArrowDownLeft size={20} className="text-emerald-600" />;
  }
  if (kind === 'withdrawal' || kind === 'purchase' || kind === 'ledger_debit') {
    return <ArrowUpRight size={20} className="text-rose-600" />;
  }
  return <TrendingUp size={20} />;
}

function amountClass(amountUsd: number): string {
  if (amountUsd > 0) return 'font-bold text-emerald-600';
  if (amountUsd < 0) return 'font-bold text-rose-600';
  return 'font-bold text-slate-700';
}

export function PwaDashboard({ portfolio, historicalYieldPercent }: Props) {
  const t = useTranslation();
  const h = t.pwaHome;
  const { intlLocale } = useLocale();
  const { formatUsd: formatUsdc, formatPercent, formatDateTime } = useMemo(
    () => createIntlFormatters(intlLocale),
    [intlLocale]
  );

  const totalCashDividendsUsdc = useDividendStore((state) => state.totalCashDividendsUsdc);
  const [showBalance, setShowBalance] = useState(true);
  const [activities, setActivities] = useState<InvestorActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const totalBalance = (portfolio?.totals.totalValueUsd || 0) + totalCashDividendsUsdc;

  useEffect(() => {
    let cancelled = false;
    setActivityLoading(true);
    void fetch('/api/investor/activity?limit=8', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { items?: InvestorActivityItem[] };
        if (!cancelled && Array.isArray(data.items)) {
          setActivities(data.items);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          {activityLoading && activities.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">…</div>
          ) : null}
          {activities.slice(0, 6).map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center gap-4 p-4 ${idx !== 0 ? 'border-t border-slate-100' : ''}`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-white">
                {activityIcon(item.kind)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{item.title}</p>
                <p className="truncate text-sm text-slate-500">
                  {item.subtitle ?? item.status}
                  {item.source ? ` · origen ${item.source.slice(0, 10)}…` : ''}
                  {item.destination ? ` · dest ${item.destination.slice(0, 10)}…` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className={amountClass(item.amountUsd)}>
                  {item.amountUsd > 0 ? '+' : ''}
                  {formatUsdc(Math.abs(item.amountUsd))}
                </p>
                <p className="text-xs text-slate-400">{formatDateTime(item.occurredAt)}</p>
              </div>
            </div>
          ))}
          {!activityLoading && activities.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">{h.recentActivityEmpty}</div>
          ) : null}
        </div>

        <Link
          href="/dashboard/portfolio?tab=wallet"
          className="mt-3 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold"
          style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
        >
          {h.viewAllActivity}
          <ChevronRight size={16} />
        </Link>
      </div>

      <PwaPropertyCarousel title={h.investNowTitle} limit={5} layout="feed" />
    </div>
  );
}
