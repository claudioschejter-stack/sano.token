'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Building, History, Loader2, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

type LinkedCryptoWalletDto = {
  id: string;
  address: string;
  network: string;
  provider: string;
  label: string | null;
  isDefault: boolean;
};

type LinkedFiatIdentityDto = {
  id: string;
  provider: string;
  identifier: string;
  label: string | null;
};

type FiatPayoutRail = 'BANK_OR_WALLET' | 'OTHER';

type FiatWithdrawForm = {
  rail: FiatPayoutRail;
  accountHolderName: string;
  taxId: string;
  cbuOrCvu: string;
  alias: string;
  providerName: string;
  notes: string;
  bridgeExternalAccountId: string;
  bridgeCurrency: string;
};

const EMPTY_FIAT_FORM: FiatWithdrawForm = {
  rail: 'BANK_OR_WALLET',
  accountHolderName: '',
  taxId: '',
  cbuOrCvu: '',
  alias: '',
  providerName: '',
  notes: '',
  bridgeExternalAccountId: '',
  bridgeCurrency: ''
};

function currencyFromBridgeLabel(label: string | null): string {
  const match = label?.match(/\b(USD|EUR|MXN)\b/i);
  return match?.[1]?.toLowerCase() ?? '';
}

type ActivityItem = {
  id: string;
  kind: 'ledger' | 'deposit' | 'withdrawal';
  label: string;
  amount: number;
  status: string;
  date: string;
};

type PlatformWalletViewProps = {
  hideHeader?: boolean;
  /** Renders inside a parent card (e.g. cash-flow) without extra page chrome. */
  embedded?: boolean;
  /** Shows “Abrir marketplace” below the tab bar. */
  showMarketplaceCta?: boolean;
};

export function PlatformWalletView({
  hideHeader = false,
  embedded = false,
  showMarketplaceCta = false
}: PlatformWalletViewProps) {
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

  const [withdrawMode, setWithdrawMode] = useState<'crypto' | 'fiat'>('crypto');
  const [linkedWallets, setLinkedWallets] = useState<LinkedCryptoWalletDto[]>([]);
  const [fiatIdentities, setFiatIdentities] = useState<LinkedFiatIdentityDto[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | null>(null);
  const [fiatForm, setFiatForm] = useState<FiatWithdrawForm>(EMPTY_FIAT_FORM);

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

  const submitWithdrawal = async (body: Record<string, unknown>) => {
    setStatus('withdrawing');
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/wallet/withdraw-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = (await response.json()) as {
      error?: string;
      withdrawal?: { id: string; status: string; providerCheckoutUrl: string | null };
    };

    if (!response.ok || !data.withdrawal) {
      setError(data.error ?? w.errorWithdrawal);
      setStatus('idle');
      return;
    }

    if (data.withdrawal.providerCheckoutUrl) {
      window.location.href = data.withdrawal.providerCheckoutUrl;
      return;
    }

    setStatus('idle');
    setFiatForm(EMPTY_FIAT_FORM);
    setSuccess(
      formatMessage(w.withdrawalCreated, {
        id: data.withdrawal.id.slice(0, 8),
        status: data.withdrawal.status
      })
    );
    await loadWallet();
    setActiveTab('history');
  };

  const submitCryptoWithdrawal = async () => {
    if (!wallet) return;
    const available = Number(wallet.account.available);
    const destinationAddress = selectedWalletAddress ?? checklist?.walletAddress?.trim();

    if (!destinationAddress) {
      setError(tw.walletNotLinked);
      return;
    }
    if (available <= 0) {
      setError(w.errorNoBalance);
      return;
    }

    await submitWithdrawal({
      amountUsd: available,
      method: 'STABLECOIN',
      destinationAddress,
      stablecoinNetwork: 'BASE'
    });
  };

  const submitFiatWithdrawal = async () => {
    if (!wallet) return;
    const available = Number(wallet.account.available);

    if (available <= 0) {
      setError(w.errorNoBalance);
      return;
    }
    const hasBridge = Boolean(fiatForm.bridgeExternalAccountId.trim());
    if (!fiatForm.accountHolderName.trim() || (!hasBridge && !fiatForm.taxId.trim())) {
      setError(w.fiatFormIncomplete);
      return;
    }
    if (
      fiatForm.rail === 'BANK_OR_WALLET' &&
      !hasBridge &&
      !fiatForm.cbuOrCvu.trim() &&
      !fiatForm.alias.trim()
    ) {
      setError(w.fiatFormIncomplete);
      return;
    }
    if (fiatForm.rail === 'OTHER' && !fiatForm.notes.trim()) {
      setError(w.fiatFormIncomplete);
      return;
    }

    await submitWithdrawal({
      amountUsd: available,
      method: 'FIAT',
      payoutDetails: fiatForm
    });
  };

  const loadLinkedWallets = async () => {
    setLoadingLinked(true);
    try {
      const response = await fetch('/api/wallet/linked-wallets', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as {
        cryptoWallets?: LinkedCryptoWalletDto[];
        fiatIdentities?: LinkedFiatIdentityDto[];
      };
      const wallets = data.cryptoWallets ?? [];
      setLinkedWallets(wallets);
      setFiatIdentities(data.fiatIdentities ?? []);
      setSelectedWalletAddress(
        wallets.find((row) => row.isDefault)?.address ?? wallets[0]?.address ?? checklist?.walletAddress ?? null
      );
    } finally {
      setLoadingLinked(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'withdraw') {
      return;
    }
    void loadLinkedWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function applyFiatIdentityChip(identity: LinkedFiatIdentityDto) {
    if (identity.provider === 'bridge') {
      setFiatForm((prev) => ({
        ...prev,
        rail: 'BANK_OR_WALLET',
        providerName: 'bridge',
        bridgeExternalAccountId: identity.identifier,
        bridgeCurrency: currencyFromBridgeLabel(identity.label),
        notes:
          prev.notes ||
          formatMessage(w.fiatChipNoteTemplate, { identifier: identity.label ?? identity.identifier })
      }));
      return;
    }
    setFiatForm((prev) => ({
      ...prev,
      bridgeExternalAccountId: '',
      bridgeCurrency: '',
      providerName: identity.provider === 'mercado_pago' ? 'Mercado Pago' : identity.provider,
      notes: prev.notes || formatMessage(w.fiatChipNoteTemplate, { identifier: identity.label ?? identity.identifier })
    }));
  }

  if (isLoadingWallet && !wallet) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-11 flex-1 rounded-lg bg-terminal-card border border-terminal-border" />
          ))}
        </div>
        <div className="h-48 rounded-xl bg-terminal-card border border-terminal-border" />
      </div>
    );
  }

  return (
    <div
      className={`mx-auto space-y-6 text-terminal-text md:space-y-8 ${
        embedded ? '' : 'bg-terminal-bg'
      } ${hideHeader || embedded ? 'max-w-none' : 'max-w-5xl'}`}
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
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-base font-semibold transition-colors sm:flex-none sm:px-5 ${
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
            setError(null);
            setSuccess(null);
            setActiveTab('withdraw');
          }}
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-base font-semibold transition-colors sm:flex-none sm:px-5 ${
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
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-base font-semibold transition-colors sm:flex-none sm:px-5 ${
            activeTab === 'history'
              ? 'bg-terminal-primary text-white'
              : 'text-terminal-muted hover:bg-terminal-bg hover:text-terminal-text'
          }`}
        >
          <History size={16} />
          {w.tabHistory}
        </button>
      </div>

      {showMarketplaceCta ? (
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-sm font-medium text-terminal-primary transition hover:text-blue-400"
        >
          <Building size={16} />
          {t.landing.cta.button}
        </Link>
      ) : null}

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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWithdrawMode('crypto')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                withdrawMode === 'crypto'
                  ? 'bg-terminal-primary text-white'
                  : 'border border-terminal-border text-terminal-muted hover:text-terminal-text'
              }`}
            >
              {w.withdrawModeCrypto}
            </button>
            <button
              type="button"
              onClick={() => setWithdrawMode('fiat')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                withdrawMode === 'fiat'
                  ? 'bg-terminal-primary text-white'
                  : 'border border-terminal-border text-terminal-muted hover:text-terminal-text'
              }`}
            >
              {w.withdrawModeFiat}
            </button>
          </div>

          {withdrawMode === 'crypto' ? (
            <div className="mt-4 space-y-3">
              {loadingLinked ? (
                <div className="h-16 animate-pulse rounded-lg bg-terminal-bg" />
              ) : linkedWallets.length > 0 ? (
                <div className="space-y-2">
                  {linkedWallets.map((row) => (
                    <label
                      key={row.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                        selectedWalletAddress === row.address
                          ? 'border-terminal-primary bg-terminal-primary/10'
                          : 'border-terminal-border hover:bg-terminal-bg'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="withdraw-wallet"
                          checked={selectedWalletAddress === row.address}
                          onChange={() => setSelectedWalletAddress(row.address)}
                        />
                        <span className="font-mono text-xs text-terminal-text">
                          {row.address.slice(0, 6)}…{row.address.slice(-4)}
                        </span>
                      </span>
                      <span className="text-xs text-terminal-muted">{row.provider}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-terminal-warning">{tw.walletNotLinked}</p>
              )}

              <button
                type="button"
                disabled={status === 'withdrawing' || !selectedWalletAddress}
                onClick={() => void submitCryptoWithdrawal()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                {status === 'withdrawing' ? <Loader2 size={16} className="animate-spin" /> : null}
                {w.withdrawSubmitCrypto}
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {fiatIdentities.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-terminal-muted">{w.fiatChipsLabel}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fiatIdentities.map((identity) => {
                      const selected =
                        identity.provider === 'bridge' &&
                        fiatForm.bridgeExternalAccountId === identity.identifier;
                      return (
                        <button
                          key={identity.id}
                          type="button"
                          onClick={() => applyFiatIdentityChip(identity)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            selected
                              ? 'border-terminal-primary bg-terminal-primary/10 text-terminal-primary'
                              : 'border-terminal-border text-terminal-text hover:border-terminal-primary hover:text-terminal-primary'
                          }`}
                        >
                          {identity.label ?? identity.identifier}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFiatForm((prev) => ({ ...prev, rail: 'BANK_OR_WALLET' }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    fiatForm.rail === 'BANK_OR_WALLET'
                      ? 'bg-terminal-primary text-white'
                      : 'border border-terminal-border text-terminal-muted'
                  }`}
                >
                  {w.fiatRailBank}
                </button>
                <button
                  type="button"
                  onClick={() => setFiatForm((prev) => ({ ...prev, rail: 'OTHER' }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    fiatForm.rail === 'OTHER'
                      ? 'bg-terminal-primary text-white'
                      : 'border border-terminal-border text-terminal-muted'
                  }`}
                >
                  {w.fiatRailOther}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-terminal-muted">
                  {w.fiatAccountHolder}
                  <input
                    type="text"
                    value={fiatForm.accountHolderName}
                    onChange={(e) => setFiatForm((prev) => ({ ...prev, accountHolderName: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text"
                  />
                </label>
                <label className="text-xs text-terminal-muted">
                  {w.fiatTaxId}
                  <input
                    type="text"
                    value={fiatForm.taxId}
                    onChange={(e) => setFiatForm((prev) => ({ ...prev, taxId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text"
                  />
                </label>

                {fiatForm.rail === 'BANK_OR_WALLET' ? (
                  <>
                    <label className="text-xs text-terminal-muted">
                      {w.fiatCbuCvu}
                      <input
                        type="text"
                        value={fiatForm.cbuOrCvu}
                        onChange={(e) => setFiatForm((prev) => ({ ...prev, cbuOrCvu: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text"
                      />
                    </label>
                    <label className="text-xs text-terminal-muted">
                      {w.fiatAlias}
                      <input
                        type="text"
                        value={fiatForm.alias}
                        onChange={(e) => setFiatForm((prev) => ({ ...prev, alias: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text"
                      />
                    </label>
                    <label className="text-xs text-terminal-muted sm:col-span-2">
                      {w.fiatProviderName}
                      <input
                        type="text"
                        value={fiatForm.providerName}
                        onChange={(e) => setFiatForm((prev) => ({ ...prev, providerName: e.target.value }))}
                        placeholder="Mercado Pago, banco, etc."
                        className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text"
                      />
                    </label>
                  </>
                ) : (
                  <label className="text-xs text-terminal-muted sm:col-span-2">
                    {w.fiatNotes}
                    <textarea
                      value={fiatForm.notes}
                      onChange={(e) => setFiatForm((prev) => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text"
                    />
                  </label>
                )}
              </div>

              <p className="text-xs text-terminal-muted">{w.fiatManualHint}</p>

              <button
                type="button"
                disabled={status === 'withdrawing'}
                onClick={() => void submitFiatWithdrawal()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                {status === 'withdrawing' ? <Loader2 size={16} className="animate-spin" /> : null}
                {w.withdrawSubmitFiat}
              </button>
            </div>
          )}
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
