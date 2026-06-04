'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, History, Loader2, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton';
import { InvestorSection } from '../dashboard/investor/InvestorSection';
import { formatMessage } from '../../i18n';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';

type WalletSummary = {
  account: { balance: string; reserved: string; available: string; currency: string; status: string };
  ledger: Array<{ id: string; type: string; amount: string; balanceAfter: string; createdAt: string }>;
  deposits: Array<{
    id: string;
    status: string;
    amountUsd: string;
    method: string;
    stablecoinNetwork: string | null;
    payToAddress: string | null;
    txHash: string | null;
    createdAt?: string;
  }>;
  withdrawals: Array<{
    id: string;
    status: string;
    amountUsd: string;
    method: string;
    stablecoinNetwork: string | null;
    destinationAddress: string | null;
    providerCheckoutUrl: string | null;
    txHash: string | null;
    createdAt?: string;
  }>;
};

type WalletTab = 'deposit' | 'withdraw' | 'history';

type ActivityItem = {
  id: string;
  kind: 'ledger' | 'deposit' | 'withdrawal';
  label: string;
  amount: number;
  status: string;
  date: string;
};

export function PlatformWalletView({ hideHeader = false }: { hideHeader?: boolean }) {
  const router = useRouter();
  const t = useTranslation();
  const w = t.platformWallet;
  const tw = t.wallet;
  const { intlLocale } = useLocale();
  const { formatUsd, formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const { checklist } = useAccountStatus();

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [activeTab, setActiveTab] = useState<WalletTab>('deposit');
  const [status, setStatus] = useState<'idle' | 'withdrawing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const withdrawAttemptRef = useRef<string | null>(null);

  const loadWallet = async () => {
    setIsLoadingWallet(true);
    try {
      const response = await fetch('/api/wallet', { cache: 'no-store' });
      const data = (await response.json()) as { wallet?: WalletSummary };
      setWallet(data.wallet ?? null);
    } finally {
      setIsLoadingWallet(false);
    }
  };

  useEffect(() => {
    void loadWallet();
  }, []);

  const activities = useMemo<ActivityItem[]>(() => {
    if (!wallet) {
      return [];
    }

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
        case 'MANUAL_ADJUSTMENT':
          return w.ledgerAdjustment;
        default:
          return type;
      }
    };

    const items: ActivityItem[] = [
      ...wallet.ledger.map((entry) => ({
        id: entry.id,
        kind: 'ledger' as const,
        label: ledgerLabel(entry.type),
        amount: Number(entry.amount),
        status: 'POSTED',
        date: entry.createdAt
      })),
      ...wallet.deposits.map((entry) => ({
        id: entry.id,
        kind: 'deposit' as const,
        label: `${w.depositLabel} · ${entry.method}`,
        amount: Number(entry.amountUsd),
        status: entry.status,
        date: entry.createdAt ?? new Date(0).toISOString()
      })),
      ...wallet.withdrawals.map((entry) => ({
        id: entry.id,
        kind: 'withdrawal' as const,
        label: `${w.withdrawalLabel} · ${entry.method}`,
        amount: -Number(entry.amountUsd),
        status: entry.status,
        date: entry.createdAt ?? new Date(0).toISOString()
      }))
    ];

    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [
    wallet,
    w.depositLabel,
    w.withdrawalLabel,
    w.ledgerDeposit,
    w.ledgerPurchase,
    w.ledgerWithdrawal,
    w.ledgerRefund,
    w.ledgerAdjustment
  ]);

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
    if (activeTab !== 'withdraw' || !wallet || status === 'withdrawing') {
      return;
    }

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
    if (withdrawAttemptRef.current === attemptKey) {
      return;
    }

    withdrawAttemptRef.current = attemptKey;
    void autoWithdraw(available, linkedWallet);
  }, [activeTab, checklist?.walletAddress, status, tw.walletNotLinked, w.errorNoBalance, wallet]);

  if (isLoadingWallet && !wallet) {
    return <DashboardSkeleton />;
  }

  return (
    <div
      className={`mx-auto space-y-6 bg-terminal-bg text-terminal-text md:space-y-8 ${
        hideHeader ? 'max-w-none' : 'max-w-5xl'
      }`}
    >
      {hideHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-terminal-text sm:text-lg">{w.title}</h2>
            <p className="mt-1 text-xs text-terminal-muted sm:text-sm">{w.subtitleCompact}</p>
          </div>
          <Link
            href="/marketplace"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary transition hover:bg-terminal-primary/20"
          >
            <ShoppingBag size={16} />
            {w.buyTokens}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-xl border border-terminal-border bg-terminal-card p-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('deposit');
            router.push('/marketplace/carrito?mode=deposit');
          }}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-5 ${
            activeTab === 'deposit'
              ? 'bg-terminal-primary text-white'
              : 'text-terminal-muted hover:bg-terminal-bg hover:text-terminal-text'
          }`}
        >
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
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-5 ${
            activeTab === 'withdraw'
              ? 'bg-terminal-primary text-white'
              : 'text-terminal-muted hover:bg-terminal-bg hover:text-terminal-text'
          }`}
        >
          {status === 'withdrawing' ? <Loader2 size={16} className="animate-spin" /> : null}
          {w.tabWithdraw}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-5 ${
            activeTab === 'history'
              ? 'bg-terminal-primary text-white'
              : 'text-terminal-muted hover:bg-terminal-bg hover:text-terminal-text'
          }`}
        >
          <History size={16} />
          {w.tabHistory}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-4 py-3 text-sm text-terminal-warning">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-4 py-3 text-sm text-terminal-success">
          {success}
        </p>
      ) : null}

      {activeTab === 'withdraw' ? (
        <InvestorSection title={w.withdrawTitle} subtitle={w.withdrawAutoSubtitle}>
          <div className="flex items-center gap-2 text-sm text-terminal-muted">
            {status === 'withdrawing' ? (
              <>
                <Loader2 size={16} className="animate-spin text-terminal-primary" />
                {w.withdrawAutoRunning}
              </>
            ) : success ? (
              success
            ) : (
              w.withdrawAutoHint
            )}
          </div>
        </InvestorSection>
      ) : null}

      {activeTab === 'history' ? (
        <InvestorSection title={w.historyTitle} subtitle={w.historySubtitle} bodyClassName="p-0">
          {activities.length === 0 ? (
            <p className="p-4 text-sm text-terminal-muted sm:p-6">{w.historyEmpty}</p>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {activities.map((item) => (
                  <article key={`${item.kind}-${item.id}`} className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-terminal-text">{item.label}</p>
                        <p className="mt-1 text-xs text-terminal-muted">{formatDateTime(item.date)}</p>
                      </div>
                      <p
                        className={`font-mono text-sm font-bold ${item.amount >= 0 ? 'text-terminal-success' : 'text-terminal-warning'}`}
                      >
                        {item.amount >= 0 ? '+' : ''}
                        {formatUsd(item.amount)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-terminal-muted">
                      {w.colStatus}: {item.status}
                    </p>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                    <tr>
                      <th className="px-4 py-3 lg:px-6">{w.colType}</th>
                      <th className="px-4 py-3 lg:px-6">{w.colDate}</th>
                      <th className="px-4 py-3 text-right lg:px-6">{w.colAmount}</th>
                      <th className="px-4 py-3 lg:px-6">{w.colStatus}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-terminal-border">
                    {activities.map((item) => (
                      <tr key={`${item.kind}-${item.id}`} className="hover:bg-terminal-bg/60">
                        <td className="px-4 py-4 font-medium text-terminal-text lg:px-6">{item.label}</td>
                        <td className="px-4 py-4 text-terminal-muted lg:px-6">{formatDateTime(item.date)}</td>
                        <td
                          className={`px-4 py-4 text-right font-mono font-bold lg:px-6 ${item.amount >= 0 ? 'text-terminal-success' : 'text-terminal-warning'}`}
                        >
                          {item.amount >= 0 ? '+' : ''}
                          {formatUsd(item.amount)}
                        </td>
                        <td className="px-4 py-4 text-terminal-muted lg:px-6">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </InvestorSection>
      ) : null}
    </div>
  );
}
