'use client';

import Link from 'next/link';
import { Download, History, Loader2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton';
import { formatMessage } from '../../i18n';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { collectionWalletHref } from '../../lib/navigation/collectionWalletPath';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';
import type { AggregatedPortfolio } from '../../lib/portfolio/portfolioAggregator';

type WalletSummary = {
  account: { balance: string; reserved: string; available: string; currency: string; status: string };
  ledger: Array<{ id: string; type: string; amount: string; balanceAfter: string; createdAt: string }>;
  deposits: Array<{ id: string; status: string; amountUsd: string; method: string; createdAt?: string }>;
  withdrawals: Array<{ id: string; status: string; amountUsd: string; method: string; createdAt?: string }>;
};

type WalletTab = 'deposit' | 'withdraw' | 'history';

type ActivityItem = {
  id: string;
  kind: string;
  label: string;
  amount: number;
  status: string;
  date: string;
};

type PositionRow = AggregatedPortfolio['positions'][number];

function formatAmount(value: number, intlLocale: string): string {
  return value.toLocaleString(intlLocale, { maximumFractionDigits: 6 });
}

function sumPositionUsd(rows: PositionRow[]): number {
  return rows.reduce((sum, row) => sum + row.valueUsd, 0);
}

/** Groups by currency/type and shows each balance converted to USD; a $0 total when empty. */
function PositionTypeSection({
  title,
  rows,
  emptyLabel,
  formatUsd,
  intlLocale
}: {
  title: string;
  rows: PositionRow[];
  emptyLabel: string;
  formatUsd: (value: number) => string;
  intlLocale: string;
}) {
  const totalUsd = sumPositionUsd(rows);

  return (
    <section className="px-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className="rounded-lg px-2 py-1 text-xs font-bold" style={{ backgroundColor: `${MP_ACCENT}1a`, color: MP_ACCENT }}>
          {formatUsd(totalUsd)}
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        {rows.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">{emptyLabel}</p>
        ) : (
          rows.map((row, idx) => (
            <article
              key={row.id}
              className={`flex items-center justify-between px-4 py-3 ${idx !== 0 ? 'border-t border-slate-100' : ''}`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{row.currency}</p>
                <p className="text-xs text-slate-500">{formatAmount(row.amount, intlLocale)}</p>
              </div>
              <p className="text-sm font-bold text-slate-900">{formatUsd(row.valueUsd)}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

type Props = {
  portfolio?: AggregatedPortfolio | null;
  isLoadingPortfolio?: boolean;
};

export function PwaWalletView({ portfolio = null, isLoadingPortfolio = false }: Props) {
  const router = useRouter();
  const t = useTranslation();
  const w = t.platformWallet;
  const tw = t.wallet;
  const p = t.portfolio;
  const { intlLocale } = useLocale();
  const { formatUsd, formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const { checklist } = useAccountStatus();

  const stablecoinPositions = useMemo(
    () => portfolio?.positions.filter((row) => row.type === 'STABLECOIN') ?? [],
    [portfolio]
  );
  const fiatPositions = useMemo(
    () => portfolio?.positions.filter((row) => row.type === 'FIAT_BALANCE') ?? [],
    [portfolio]
  );

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [activeTab, setActiveTab] = useState<WalletTab>('deposit');
  const [status, setStatus] = useState<'idle' | 'withdrawing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const withdrawAttemptRef = useRef<string | null>(null);

  const loadWallet = async () => {
    setIsLoadingWallet(true);
    setError(null);
    try {
      const response = await fetch('/api/wallet', { cache: 'no-store' });
      const data = (await response.json()) as { wallet?: WalletSummary; error?: string };
      if (!response.ok) {
        setWallet(null);
        setError(data.error ?? w.loadError);
        return;
      }
      setWallet(data.wallet ?? null);
    } catch {
      setWallet(null);
      setError(w.loadError);
    } finally {
      setIsLoadingWallet(false);
    }
  };

  useEffect(() => {
    void loadWallet();
  }, []);

  const activities = useMemo<ActivityItem[]>(() => {
    if (!wallet) return [];

    const ledgerLabel = (type: string) => {
      switch (type) {
        case 'DEPOSIT_CREDIT':
          return w.ledgerDeposit;
        case 'TOKEN_PURCHASE_DEBIT':
          return w.ledgerPurchase;
        case 'WITHDRAWAL_DEBIT':
          return w.ledgerWithdrawal;
        case 'REFUND_CREDIT':
          return w.ledgerRefund;
        default:
          return type;
      }
    };

    const items: ActivityItem[] = [
      ...wallet.ledger.map((entry) => ({
        id: entry.id,
        kind: 'ledger',
        label: ledgerLabel(entry.type),
        amount: Number(entry.amount),
        status: 'POSTED',
        date: entry.createdAt
      })),
      ...wallet.deposits.map((entry) => ({
        id: entry.id,
        kind: 'deposit',
        label: `${w.depositLabel} · ${entry.method}`,
        amount: Number(entry.amountUsd),
        status: entry.status,
        date: entry.createdAt ?? new Date(0).toISOString()
      })),
      ...wallet.withdrawals.map((entry) => ({
        id: entry.id,
        kind: 'withdrawal',
        label: `${w.withdrawalLabel} · ${entry.method}`,
        amount: -Number(entry.amountUsd),
        status: entry.status,
        date: entry.createdAt ?? new Date(0).toISOString()
      }))
    ];

    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [wallet, w]);

  const autoWithdraw = async (amountUsd: number, destinationAddress: string) => {
    setStatus('withdrawing');
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/wallet/withdraw-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountUsd,
        method: 'STABLECOIN',
        destinationAddress,
        stablecoinNetwork: 'BASE'
      })
    });

    const data = (await response.json()) as {
      error?: string;
      withdrawal?: { id: string; status: string; providerCheckoutUrl: string | null };
    };

    if (!response.ok || !data.withdrawal) {
      setError(data.error ?? w.errorWithdrawal);
      setStatus('idle');
      withdrawAttemptRef.current = null;
      return;
    }

    if (data.withdrawal.providerCheckoutUrl) {
      window.location.href = data.withdrawal.providerCheckoutUrl;
      return;
    }

    setStatus('idle');
    setSuccess(
      formatMessage(w.withdrawalCreated, {
        id: data.withdrawal.id.slice(0, 8),
        status: data.withdrawal.status
      })
    );
    await loadWallet();
    setActiveTab('history');
  };

  useEffect(() => {
    if (activeTab !== 'withdraw' || !wallet || status === 'withdrawing') return;

    const available = Number(wallet.account.available);
    const linkedWallet = checklist?.walletAddress?.trim();

    if (!linkedWallet) {
      setError(tw.walletNotLinked);
      return;
    }
    if (available <= 0) {
      setError(w.errorNoBalance);
      return;
    }

    const attemptKey = `${available}-${linkedWallet}`;
    if (withdrawAttemptRef.current === attemptKey) return;

    withdrawAttemptRef.current = attemptKey;
    void autoWithdraw(available, linkedWallet);
  }, [activeTab, checklist?.walletAddress, status, tw.walletNotLinked, w.errorNoBalance, wallet]);

  if (isLoadingWallet && !wallet) {
    return <DashboardSkeleton />;
  }

  const available = wallet ? Number(wallet.account.available) : 0;
  const balance = wallet ? Number(wallet.account.balance) : 0;

  const tabStyle = (tab: WalletTab) =>
    activeTab === tab
      ? { backgroundColor: MP_ACCENT, color: '#fff' }
      : { backgroundColor: '#fff', color: '#475569' };

  return (
    <div className="-mx-4 space-y-5 pb-2 font-sans">
      <div className="px-4">
        <h1 className="text-xl font-bold text-slate-900">{w.title}</h1>
        <p className="mt-3 text-3xl font-bold text-slate-900">{formatUsd(balance)}</p>
        <p className="mt-1 text-sm text-slate-500">
          Disponible: <span className="font-semibold text-emerald-600">{formatUsd(available)}</span>
        </p>
      </div>

      {!isLoadingPortfolio ? (
        <>
          <PositionTypeSection
            title={p.sectionStablecoins}
            rows={stablecoinPositions}
            emptyLabel={p.sectionStablecoinsEmpty}
            formatUsd={formatUsd}
            intlLocale={intlLocale}
          />
          <PositionTypeSection
            title={p.sectionFiat}
            rows={fiatPositions}
            emptyLabel={p.sectionFiatEmpty}
            formatUsd={formatUsd}
            intlLocale={intlLocale}
          />
        </>
      ) : null}

      <div className="grid grid-cols-3 gap-2 px-4">
        <button
          type="button"
          onClick={() => router.push('/marketplace/carrito?mode=deposit')}
          className="flex flex-col items-center gap-2 rounded-2xl py-4 text-xs font-semibold ring-1 ring-slate-200"
          style={tabStyle('deposit')}
        >
          <Download size={22} />
          {w.tabDeposit}
        </button>
        <button
          type="button"
          onClick={() => {
            withdrawAttemptRef.current = null;
            setError(null);
            setSuccess(null);
            setActiveTab('withdraw');
          }}
          className="flex flex-col items-center gap-2 rounded-2xl py-4 text-xs font-semibold ring-1 ring-slate-200"
          style={tabStyle('withdraw')}
        >
          {status === 'withdrawing' ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
          {w.tabWithdraw}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className="flex flex-col items-center gap-2 rounded-2xl py-4 text-xs font-semibold ring-1 ring-slate-200"
          style={tabStyle('history')}
        >
          <History size={22} />
          {w.tabHistory}
        </button>
      </div>

      {error ? (
        <div className="mx-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>{error}</p>
          {error === tw.walletNotLinked ? (
            <Link
              href={collectionWalletHref({ returnTo: '/dashboard/portfolio?tab=wallet' })}
              className="inline-flex font-semibold underline"
              style={{ color: MP_ACCENT }}
            >
              {t.pwaHome.collectionWalletTitle}
            </Link>
          ) : null}
        </div>
      ) : null}
      {success ? (
        <p className="mx-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      {activeTab === 'withdraw' && status === 'withdrawing' ? (
        <p className="px-4 text-sm text-slate-500">{w.withdrawAutoRunning}</p>
      ) : null}

      {activeTab === 'history' ? (
        <section className="px-4">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
            {activities.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">{w.historyEmpty}</p>
            ) : (
              activities.map((item, idx) => (
                <article
                  key={`${item.kind}-${item.id}`}
                  className={`p-4 ${idx !== 0 ? 'border-t border-slate-100' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.date)}</p>
                    </div>
                    <p className={`font-bold ${item.amount >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {item.amount >= 0 ? '+' : ''}
                      {formatUsd(item.amount)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{item.status}</p>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      <div className="px-4">
        <Link href="/marketplace" className="text-sm font-medium" style={{ color: MP_ACCENT }}>
          {w.buyTokens}
        </Link>
      </div>
    </div>
  );
}
