'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import type { AggregatedPortfolio } from '../../lib/portfolio/portfolioAggregator';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { MP_ACCENT, MP_ACCENT_SOFT } from '../../lib/pwa/mpTheme';
import { PwaWalletView } from './PwaWalletView';
import { useLoansPreference } from '../../hooks/useLoansPreference';

type PositionRow = AggregatedPortfolio['positions'][number];
type AssetsTab = 'assets' | 'wallet';

function formatAmount(value: number, intlLocale: string): string {
  return value.toLocaleString(intlLocale, { maximumFractionDigits: 6 });
}

function PositionCard({
  row,
  formatUsd,
  intlLocale,
  labels,
  showLoan
}: {
  row: PositionRow;
  formatUsd: (value: number) => string;
  intlLocale: string;
  labels: {
    quantity: string;
    token: string;
    valueUsd: string;
    buy: string;
    sell: string;
    loan: string;
  };
  showLoan: boolean;
}) {
  const projectId = String(row.metadata?.projectId ?? '');

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{row.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{row.currency}</p>
        </div>
        <p className="shrink-0 text-sm font-bold" style={{ color: MP_ACCENT }}>
          {formatUsd(row.valueUsd)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{labels.quantity}</p>
          <p className="font-mono text-slate-800">{formatAmount(row.amount, intlLocale)}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{labels.valueUsd}</p>
          <p className="font-mono text-slate-800">{formatUsd(row.valueUsdc)}</p>
        </div>
      </div>

      {projectId ? (
        <div className={`mt-4 grid gap-2 ${showLoan ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <Link
            href={`/marketplace/${projectId}/checkout`}
            className="flex min-h-10 items-center justify-center rounded-xl text-xs font-semibold text-white"
            style={{ backgroundColor: MP_ACCENT }}
          >
            {labels.buy}
          </Link>
          <Link
            href={`/mercado-secundario?sell=${encodeURIComponent(projectId)}`}
            className="flex min-h-10 items-center justify-center rounded-xl bg-emerald-500 text-xs font-semibold text-white"
          >
            {labels.sell}
          </Link>
          {showLoan ? (
            <Link
              href={`/marketplace/${projectId}/prestamo`}
              className="flex min-h-10 items-center justify-center rounded-xl bg-orange-500 text-xs font-semibold text-white"
            >
              {labels.loan}
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function PwaAssetsView() {
  const t = useTranslation();
  const p = t.portfolio;
  const searchParams = useSearchParams();
  const { intlLocale } = useLocale();
  const { formatUsd } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const { loansEnabled } = useLoansPreference();

  const initialTab: AssetsTab = searchParams.get('tab') === 'wallet' ? 'wallet' : 'assets';
  const [tab, setTab] = useState<AssetsTab>(initialTab);
  const [portfolio, setPortfolio] = useState<AggregatedPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const next = searchParams.get('tab') === 'wallet' ? 'wallet' : 'assets';
    setTab(next);
  }, [searchParams]);

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

  const actionLabels = {
    quantity: p.colQuantity,
    token: p.colTokenCode,
    valueUsd: p.colValueUsd,
    buy: p.actionBuy,
    sell: p.actionSell,
    loan: p.actionLoan
  };

  return (
    <div className="-mx-4 space-y-4 pb-2 font-sans">
      <div className="px-4">
        <h1 className="text-xl font-bold text-slate-900">{t.nav.myAssets}</h1>
        <p className="mt-1 text-sm text-slate-500">{p.subtitle}</p>
      </div>

      <div className="mx-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('assets')}
          className={`rounded-xl py-2.5 text-sm font-semibold transition ${
            tab === 'assets' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          {t.nav.myAssets}
        </button>
        <button
          type="button"
          onClick={() => setTab('wallet')}
          className={`rounded-xl py-2.5 text-sm font-semibold transition ${
            tab === 'wallet' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          {t.nav.myWallet}
        </button>
      </div>

      {tab === 'wallet' ? (
        <div className="px-0">
          <PwaWalletView portfolio={portfolio} isLoadingPortfolio={isLoading} />
        </div>
      ) : (
        <div className="space-y-4 px-4">
          {isLoading ? (
            <div className="flex min-h-40 items-center justify-center text-slate-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : null}

          {!isLoading && !portfolio ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              {p.loadError}
            </div>
          ) : null}

          {portfolio ? (
            <>
              <div
                className="rounded-2xl p-4 text-white shadow-sm"
                style={{ backgroundColor: MP_ACCENT }}
              >
                <p className="text-xs font-medium text-white/80">{p.netLiquidValue}</p>
                <p className="mt-1 text-2xl font-bold">
                  {formatUsd(portfolio.totals.netLiquidValueUsd)}
                </p>
                <div className="mt-3 flex gap-4 text-xs text-white/85">
                  <span>
                    {p.grossAssets}: {formatUsd(portfolio.totals.grossAssetsUsd)}
                  </span>
                  <span>
                    {p.loansTaken}: {formatUsd(portfolio.totals.debtUsd)}
                  </span>
                </div>
              </div>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">{p.sectionTokens}</h2>
                {tokenPositions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <Building2 className="mx-auto text-slate-300" size={28} />
                    <p className="mt-3 text-sm text-slate-500">{p.sectionTokensEmpty}</p>
                    <Link
                      href="/marketplace"
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white"
                      style={{ backgroundColor: MP_ACCENT }}
                    >
                      {t.landing.cta.button}
                    </Link>
                  </div>
                ) : (
                  tokenPositions.map((row) => (
                    <PositionCard
                      key={row.id}
                      row={row}
                      formatUsd={formatUsd}
                      intlLocale={intlLocale}
                      labels={actionLabels}
                      showLoan={loansEnabled}
                    />
                  ))
                )}
              </section>

              <button
                type="button"
                onClick={() => setTab('wallet')}
                className="flex w-full min-h-12 items-center justify-center rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
              >
                {t.nav.myWallet}
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
