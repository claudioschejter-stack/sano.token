'use client';

import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpRight,
  CircleDollarSign,
  History,
  Loader2,
  ShoppingBag,
  Wallet
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton';
import { InvestorKpiCard } from '../dashboard/investor/InvestorKpiCard';
import { InvestorPageHeader } from '../dashboard/investor/InvestorPageHeader';
import { InvestorSection } from '../dashboard/investor/InvestorSection';
import { formatMessage } from '../../i18n';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';
import { WalletConnectButton } from '../marketplace/WalletConnectButton';

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

type DepositResponse = {
  id: string;
  status: string;
  amountUsd: string;
  method: string;
  stablecoinNetwork: string | null;
  payToAddress: string | null;
  providerCheckoutUrl: string | null;
  metadata: unknown;
};

type WithdrawalResponse = {
  id: string;
  status: string;
  amountUsd: string;
  method: string;
  providerCheckoutUrl: string | null;
};

type RouteQuote = {
  method: string;
  provider: string;
  label: string;
  estimatedFeeUsd: number;
  estimatedFeeBps: number;
  stablecoinNetwork?: string;
  reason: string;
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

const inputClassName =
  'w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2.5 text-sm text-terminal-text outline-none focus:border-terminal-primary/50';
const selectClassName = inputClassName;

export function PlatformWalletView({ hideHeader = false }: { hideHeader?: boolean }) {
  const t = useTranslation();
  const w = t.platformWallet;
  const cc = t.cartCheckout;
  const tw = t.wallet;
  const { intlLocale } = useLocale();
  const { formatUsd, formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const { address } = useAccount();
  const walletGuard = useLinkedWalletGuard();
  const { checklist } = useAccountStatus();
  const a = t.accountStatus;
  const kycLabels = a.kycLabels as Record<string, string>;
  const accountLabels = a.accountLabels as Record<string, string>;
  const kycStatusLabel = checklist ? kycLabels[checklist.kycStatus] ?? checklist.kycStatus : '—';
  const accountStatusLabel = checklist
    ? checklist.accountStatus === 'SUSPENDED'
      ? accountLabels.SUSPENDED
      : checklist.operational
        ? accountLabels.OPERATIONAL
        : accountLabels.ONBOARDING
    : '—';

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [activeTab, setActiveTab] = useState<WalletTab>('deposit');

  const [amountUsd, setAmountUsd] = useState('100');
  const [method, setMethod] = useState('AUTO_CHEAPEST');
  const [network, setNetwork] = useState('BASE');
  const [country, setCountry] = useState('AR');
  const [userHasStablecoin, setUserHasStablecoin] = useState(true);
  const [deposit, setDeposit] = useState<DepositResponse | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteQuote | null>(null);
  const [txHash, setTxHash] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState('50');
  const [withdrawMethod, setWithdrawMethod] = useState<'STABLECOIN' | 'FIAT'>('STABLECOIN');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState('BASE');
  const [withdrawal, setWithdrawal] = useState<WithdrawalResponse | null>(null);

  const isBusy = ['creating', 'verifying', 'withdrawing', 'waiting_tx'].includes(status);

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

  useEffect(() => {
    if (address && !withdrawAddress) {
      setWithdrawAddress(address);
    }
  }, [address, withdrawAddress]);

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

  const createDeposit = async () => {
    if (!walletGuard.canSignOnChain || !address) {
      setError(
        !walletGuard.isWalletLinked
          ? tw.walletNotLinked
          : walletGuard.isWrongNetwork
            ? tw.wrongNetwork
            : walletGuard.isWalletMismatch
              ? tw.walletMismatch
              : tw.noWallet
      );
      return;
    }

    setStatus('creating');
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/wallet/deposit-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountUsd: Number(amountUsd),
        method: method === 'AUTO_CHEAPEST' ? undefined : method,
        auto: method === 'AUTO_CHEAPEST',
        country,
        userHasStablecoin,
        stablecoinNetwork: network,
        walletAddress: address
      })
    });

    const data = (await response.json()) as { error?: string; deposit?: DepositResponse; selectedRoute?: RouteQuote };
    if (!response.ok || !data.deposit) {
      setError(data.error ?? w.errorDepositCreate);
      setStatus('idle');
      return;
    }

    setDeposit(data.deposit);
    setSelectedRoute(data.selectedRoute ?? null);

    if (data.deposit.providerCheckoutUrl) {
      window.location.href = data.deposit.providerCheckoutUrl;
      return;
    }

    setStatus('waiting_tx');
    setActiveTab('deposit');
  };

  const verifyDeposit = async () => {
    if (!deposit || !txHash.trim()) {
      return;
    }

    setStatus('verifying');
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/wallet/deposit-intents/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depositId: deposit.id, txHash: txHash.trim(), walletAddress: address })
    });

    const data = (await response.json()) as { error?: string; deposit?: DepositResponse };
    if (!response.ok || !data.deposit) {
      setError(data.error ?? w.errorDepositVerify);
      setStatus('waiting_tx');
      return;
    }

    setDeposit(data.deposit);
    setStatus('confirmed');
    setSuccess(w.depositConfirmed);
    setTxHash('');
    await loadWallet();
  };

  const createWithdrawal = async () => {
    setStatus('withdrawing');
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/wallet/withdraw-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountUsd: Number(withdrawAmount),
        method: withdrawMethod,
        destinationAddress: withdrawMethod === 'STABLECOIN' ? withdrawAddress : undefined,
        stablecoinNetwork: withdrawNetwork
      })
    });

    const data = (await response.json()) as { error?: string; withdrawal?: WithdrawalResponse };
    if (!response.ok || !data.withdrawal) {
      setError(data.error ?? w.errorWithdrawal);
      setStatus('idle');
      return;
    }

    setWithdrawal(data.withdrawal);

    if (data.withdrawal.providerCheckoutUrl) {
      window.location.href = data.withdrawal.providerCheckoutUrl;
      return;
    }

    setStatus('withdrawal_pending');
    setSuccess(
      formatMessage(w.withdrawalCreated, {
        id: data.withdrawal.id.slice(0, 8),
        status: data.withdrawal.status
      })
    );
    await loadWallet();
    setActiveTab('history');
  };

  if (isLoadingWallet && !wallet) {
    return <DashboardSkeleton />;
  }

  const available = wallet ? Number(wallet.account.available) : 0;
  const total = wallet ? Number(wallet.account.balance) : 0;
  const reserved = wallet ? Number(wallet.account.reserved) : 0;

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
            <p className="mt-1 text-xs text-terminal-muted sm:text-sm">{w.subtitle}</p>
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
      ) : (
        <InvestorPageHeader
          eyebrow={w.eyebrow}
          title={w.title}
          subtitle={w.subtitle}
          action={
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary transition hover:bg-terminal-primary/20"
            >
              <ShoppingBag size={16} />
              {w.buyTokens}
              <ArrowUpRight size={14} />
            </Link>
          }
        />
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InvestorKpiCard
          label={w.kpiAvailable}
          value={formatUsd(available)}
          hint={w.kpiAvailableHint}
          icon={<CircleDollarSign size={22} />}
          valueClassName="text-terminal-primary"
        />
        <InvestorKpiCard
          label={w.kpiTotal}
          value={formatUsd(total)}
          hint={wallet?.account.currency ?? 'USD'}
          icon={<Wallet size={22} />}
        />
        <InvestorKpiCard
          label={w.kpiReserved}
          value={formatUsd(reserved)}
          hint={w.kpiTotal}
          icon={<ArrowDownToLine size={22} />}
          valueClassName="text-terminal-warning"
          iconClassName="bg-terminal-bg text-terminal-warning"
        />
        <InvestorKpiCard
          label={w.kpiStatus}
          value={kycStatusLabel}
          hint={`${accountStatusLabel} · ${w.kycHint}`}
          icon={<Wallet size={22} />}
          valueClassName={
            checklist?.kycStatus === 'APPROVED'
              ? 'text-terminal-success'
              : checklist?.kycStatus === 'REJECTED'
                ? 'text-terminal-danger'
                : 'text-terminal-warning'
          }
        />
      </section>

      <div className="flex flex-wrap gap-2 rounded-xl border border-terminal-border bg-terminal-card p-2">
        {(
          [
            { id: 'deposit', label: w.tabDeposit, icon: ArrowDownToLine },
            { id: 'withdraw', label: w.tabWithdraw, icon: ArrowUpRight },
            { id: 'history', label: w.tabHistory, icon: History }
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-5 ${
                isActive
                  ? 'bg-terminal-primary text-white'
                  : 'text-terminal-muted hover:bg-terminal-bg hover:text-terminal-text'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
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

      {activeTab === 'deposit' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <InvestorSection title={w.depositTitle} subtitle={w.depositSubtitle}>
            <div className="space-y-3">
              <Link
                href="/marketplace/carrito?mode=deposit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
              >
                <ArrowDownToLine size={16} />
                {cc.depositCta}
              </Link>
              <p className="text-xs text-terminal-muted">{cc.depositSubtitle}</p>
              <WalletConnectButton />
              <input
                value={amountUsd}
                onChange={(event) => setAmountUsd(event.target.value)}
                className={`${inputClassName} font-mono`}
                placeholder={w.amountPlaceholder}
                inputMode="decimal"
              />
              <select value={method} onChange={(event) => setMethod(event.target.value)} className={selectClassName}>
                <option value="AUTO_CHEAPEST">{w.methodAuto}</option>
                <option value="USDC_ONCHAIN">{w.methodUsdc}</option>
                <option value="TRANSAK">{w.methodTransak}</option>
                <option value="BRIDGE">{w.methodBridge}</option>
                <option value="STRIPE">{w.methodStripe}</option>
                <option value="MERCADO_PAGO">{w.methodMercadoPago}</option>
                <option value="COINBASE">{w.methodCoinbase}</option>
              </select>
              <select value={country} onChange={(event) => setCountry(event.target.value)} className={selectClassName}>
                <option value="AR">Argentina</option>
                <option value="MX">México</option>
                <option value="BR">Brasil</option>
                <option value="US">USA</option>
                <option value="EU">Europa</option>
                <option value="IN">India</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-terminal-muted">
                <input
                  type="checkbox"
                  checked={userHasStablecoin}
                  onChange={(event) => setUserHasStablecoin(event.target.checked)}
                />
                {w.hasStablecoin}
              </label>
              {method === 'USDC_ONCHAIN' || method === 'AUTO_CHEAPEST' ? (
                <select value={network} onChange={(event) => setNetwork(event.target.value)} className={selectClassName}>
                  <option value="BASE">Base (USDC)</option>
                  <option value="POLYGON">Polygon (USDC)</option>
                  <option value="SOLANA">Solana (USDC)</option>
                  <option value="TRON">TRON (USDT)</option>
                </select>
              ) : null}
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void createDeposit()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'creating' ? <Loader2 size={16} className="animate-spin" /> : null}
                {w.createDeposit}
              </button>
              {selectedRoute ? (
                <p className="rounded-lg border border-terminal-success/30 bg-terminal-success/10 p-3 text-xs text-terminal-success">
                  {formatMessage(w.routeSelected, {
                    label: selectedRoute.label,
                    fee: selectedRoute.estimatedFeeUsd.toFixed(2)
                  })}
                </p>
              ) : null}
            </div>
          </InvestorSection>

          <InvestorSection title={w.verifyTitle} subtitle={w.verifySubtitle}>
            {deposit?.payToAddress ? (
              <div className="space-y-3 text-sm">
                <p className="text-terminal-muted">{w.sendToTreasury}</p>
                <p className="break-all rounded-lg border border-terminal-border bg-terminal-bg p-3 font-mono text-xs text-terminal-text sm:text-sm">
                  {deposit.payToAddress}
                </p>
                <input
                  value={txHash}
                  onChange={(event) => setTxHash(event.target.value)}
                  className={`${inputClassName} font-mono text-xs sm:text-sm`}
                  placeholder={w.txHashPlaceholder}
                />
                <button
                  type="button"
                  disabled={isBusy || !txHash.trim()}
                  onClick={() => void verifyDeposit()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === 'verifying' ? <Loader2 size={16} className="animate-spin" /> : null}
                  {w.verifyButton}
                </button>
              </div>
            ) : (
              <p className="text-sm text-terminal-muted">{w.noDepositYet}</p>
            )}
          </InvestorSection>
        </div>
      ) : null}

      {activeTab === 'withdraw' ? (
        <InvestorSection title={w.withdrawTitle} subtitle={w.withdrawSubtitle}>
          <div className="mx-auto max-w-lg space-y-3">
            <input
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              className={`${inputClassName} font-mono`}
              placeholder={w.amountPlaceholder}
              inputMode="decimal"
            />
            <select
              value={withdrawMethod}
              onChange={(event) => setWithdrawMethod(event.target.value as 'STABLECOIN' | 'FIAT')}
              className={selectClassName}
            >
              <option value="STABLECOIN">{w.withdrawStablecoin}</option>
              <option value="FIAT">{w.withdrawFiat}</option>
            </select>
            {withdrawMethod === 'STABLECOIN' ? (
              <>
                <select
                  value={withdrawNetwork}
                  onChange={(event) => setWithdrawNetwork(event.target.value)}
                  className={selectClassName}
                >
                  <option value="BASE">Base</option>
                  <option value="POLYGON">Polygon</option>
                  <option value="SOLANA">Solana</option>
                  <option value="TRON">TRON</option>
                </select>
                <input
                  value={withdrawAddress}
                  onChange={(event) => setWithdrawAddress(event.target.value)}
                  className={`${inputClassName} font-mono text-xs sm:text-sm`}
                  placeholder={w.destinationPlaceholder}
                />
              </>
            ) : (
              <p className="rounded-lg border border-terminal-border bg-terminal-bg p-3 text-xs text-terminal-muted">
                {w.fiatHint}
              </p>
            )}
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void createWithdrawal()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-3 text-sm font-semibold text-terminal-primary hover:bg-terminal-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'withdrawing' ? <Loader2 size={16} className="animate-spin" /> : null}
              {w.requestWithdrawal}
            </button>
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
