'use client';

import { ArrowLeft, ExternalLink, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatMessage } from '../../i18n';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { PaymentMethod } from '@sanova/database';
import {
  groupDepositPaymentOptions,
  sortDepositPaymentOptions,
  type DepositPaymentOption,
  type DepositPaymentOptionGroup
} from '../../lib/payments/depositPaymentOptions';
import { collectionWalletHref } from '../../lib/navigation/collectionWalletPath';
import { isLocalRailManualResult } from '../../lib/payments/stripeCheckoutOptions';
import { useCartStore } from '../../store/useCartStore';
import { InvestorWalletLinker } from '../wallet/InvestorWalletLinker';

type CartCheckoutResult = {
  batchId: string;
  totalUsd: string;
  totalTokens: number;
  method: PaymentMethod;
  confirmed: boolean;
  providerCheckoutUrl: string | null;
  payToAddress: string | null;
  stablecoinNetwork: string | null;
};

type DepositResponse = {
  id: string;
  status: string;
  amountUsd: string;
  method: string;
  payToAddress: string | null;
  providerCheckoutUrl: string | null;
  metadata?: Record<string, unknown> | null;
};

type DepositQuoteResponse = {
  options?: DepositPaymentOption[];
  groups?: DepositPaymentOptionGroup[];
  quoteExpiresAt?: string;
  quoteTtlSeconds?: number;
};

function formatDepositLocal(amount: number, currencyCode: string, intlLocale: string) {
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0
  }).format(amount);
}

const CURRENCY_COUNTRY: Record<string, string> = {
  ARS: 'AR',
  BRL: 'BR',
  USD: 'US',
  EUR: 'EU',
  INR: 'IN',
  MXN: 'MX'
};

type CartCheckoutViewProps = {
  investorName: string;
  initialMode?: 'purchase' | 'deposit' | 'wallet';
};

export function CartCheckoutView({ investorName, initialMode = 'purchase' }: CartCheckoutViewProps) {
  const t = useTranslation();
  const c = t.cartCheckout;
  const w = t.wallet;
  const { intlLocale } = useLocale();
  const { formatFromUsd, formatUsd, currency, rates, intlLocale: currencyLocale } = useLocalCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const walletGuard = useLinkedWalletGuard();

  const mode =
    searchParams.get('mode') === 'deposit'
      ? 'deposit'
      : searchParams.get('mode') === 'wallet'
        ? 'wallet'
        : initialMode;
  const returnStatus = searchParams.get('status');
  const batchFromQuery = searchParams.get('batch');

  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const setTokenCount = useCartStore((state) => state.setTokenCount);
  const clearCart = useCartStore((state) => state.clearCart);
  const cartTotalUsd = useCartStore((state) => state.totalUsd());
  const cartItemCount = useCartStore((state) => state.itemCount());

  const [depositOptions, setDepositOptions] = useState<DepositPaymentOption[]>([]);
  const [depositOptionGroups, setDepositOptionGroups] = useState<DepositPaymentOptionGroup[]>([]);
  const [selectedDepositOptionId, setSelectedDepositOptionId] = useState<string | null>(null);
  const [quoteExpiresAt, setQuoteExpiresAt] = useState<string | null>(null);
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MERCADO_PAGO');
  const [stablecoinNetwork, setStablecoinNetwork] = useState('BASE');
  const [depositAmount, setDepositAmount] = useState('100');
  const [manualTxHash, setManualTxHash] = useState('');
  const [batchId, setBatchId] = useState<string | null>(batchFromQuery);
  const [checkout, setCheckout] = useState<CartCheckoutResult | null>(null);
  const [deposit, setDeposit] = useState<DepositResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'manual' | 'pending_gateway' | 'verifying' | 'done'>(
    'idle'
  );
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalUsd = mode === 'deposit' ? Number(depositAmount) || 0 : cartTotalUsd;
  const depositCountry = CURRENCY_COUNTRY[currency] ?? 'AR';
  const sortedDepositOptions = useMemo(() => sortDepositPaymentOptions(depositOptions), [depositOptions]);
  const paymentGroups = useMemo(
    () => (depositOptionGroups.length > 0 ? depositOptionGroups : groupDepositPaymentOptions(depositOptions)),
    [depositOptionGroups, depositOptions]
  );

  const selectedDepositOption = useMemo(
    () => sortedDepositOptions.find((row) => row.id === selectedDepositOptionId) ?? null,
    [sortedDepositOptions, selectedDepositOptionId]
  );
  const showPaymentMethods =
    (mode === 'deposit' && totalUsd > 0) || (mode === 'purchase' && items.length > 0);
  const requiresWallet =
    selectedDepositOption?.method === 'CUSTODIAL_STABLECOIN' ||
    selectedDepositOption?.method === 'USDC_ONCHAIN';
  const showWalletLinker = requiresWallet && mode !== 'deposit';
  const linkedWalletAddress = walletGuard.linkedWallet;
  const paymentQuoteExpired = showPaymentMethods && quoteSecondsLeft <= 0 && quoteExpiresAt !== null;

  const loadDepositQuote = useCallback(() => {
    if (!Number.isFinite(totalUsd) || totalUsd <= 0) {
      setDepositOptions([]);
      setDepositOptionGroups([]);
      setSelectedDepositOptionId(null);
      setQuoteExpiresAt(null);
      setQuoteSecondsLeft(0);
      return () => undefined;
    }

    const controller = new AbortController();
    const fxRate = rates[currency] ?? rates.USD ?? 1;

    void fetch(
      `/api/marketplace/cart/deposit-options?amountUsd=${encodeURIComponent(String(totalUsd))}&country=${encodeURIComponent(depositCountry)}&fxRate=${encodeURIComponent(String(fxRate))}`,
      { cache: 'no-store', signal: controller.signal }
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data: DepositQuoteResponse | null) => {
        const next = sortDepositPaymentOptions(data?.options ?? []);
        setDepositOptions(next);
        setDepositOptionGroups(data?.groups ?? groupDepositPaymentOptions(next));
        setQuoteExpiresAt(data?.quoteExpiresAt ?? null);
        const expiresMs = data?.quoteExpiresAt ? new Date(data.quoteExpiresAt).getTime() - Date.now() : 0;
        setQuoteSecondsLeft(Math.max(0, Math.ceil(expiresMs / 1000)));

        setSelectedDepositOptionId((current) => {
          if (current && next.some((row) => row.id === current && row.configured)) {
            return current;
          }
          return next.find((row) => row.configured)?.id ?? null;
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDepositOptions([]);
          setDepositOptionGroups([]);
          setSelectedDepositOptionId(null);
          setQuoteExpiresAt(null);
          setQuoteSecondsLeft(0);
        }
      });

    return () => controller.abort();
  }, [currency, depositCountry, rates, totalUsd]);

  useEffect(() => {
    if (!showPaymentMethods) {
      setDepositOptions([]);
      setDepositOptionGroups([]);
      setSelectedDepositOptionId(null);
      setQuoteExpiresAt(null);
      setQuoteSecondsLeft(0);
      return;
    }

    const timer = window.setTimeout(() => {
      loadDepositQuote();
    }, 280);

    return () => window.clearTimeout(timer);
  }, [loadDepositQuote, showPaymentMethods, walletGuard.isWalletLinked]);

  useEffect(() => {
    if (!showPaymentMethods || !quoteExpiresAt) {
      return;
    }

    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(quoteExpiresAt).getTime() - Date.now()) / 1000));
      setQuoteSecondsLeft(seconds);
      return seconds;
    };

    if (tick() === 0) {
      loadDepositQuote();
      return;
    }

    const interval = window.setInterval(() => {
      if (tick() === 0) {
        window.clearInterval(interval);
        loadDepositQuote();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loadDepositQuote, quoteExpiresAt, showPaymentMethods]);

  useEffect(() => {
    if (!selectedDepositOption) {
      return;
    }

    setPaymentMethod(selectedDepositOption.method);
    if (selectedDepositOption.stablecoinNetwork) {
      setStablecoinNetwork(selectedDepositOption.stablecoinNetwork);
    }
  }, [selectedDepositOption]);

  useEffect(() => {
    if (returnStatus === 'success' && batchFromQuery) {
      setBatchId(batchFromQuery);
      setStatus('done');
      if (mode === 'purchase') {
        clearCart();
        void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' });
      }
    }
  }, [batchFromQuery, clearCart, mode, returnStatus]);

  const handleConfirm = async () => {
    if (mode === 'purchase' && items.length === 0) {
      setError(c.emptyCart);
      return;
    }

    if (mode === 'deposit' && (!Number.isFinite(totalUsd) || totalUsd <= 0)) {
      setError(c.invalidAmount);
      return;
    }

    if (showPaymentMethods && paymentQuoteExpired) {
      setError(c.quoteExpired);
      loadDepositQuote();
      return;
    }

    if (showPaymentMethods && (!selectedDepositOption?.configured || !selectedDepositOptionId)) {
      setError(c.paymentUnavailable);
      return;
    }

    if (requiresWallet) {
      if (!walletGuard.isWalletLinked || !linkedWalletAddress) {
        setError(w.walletNotLinked);
        return;
      }

      if (mode === 'purchase') {
        if (!walletGuard.canSignOnChain || !address) {
          setError(
            walletGuard.isWrongNetwork ? w.wrongNetwork : walletGuard.isWalletMismatch ? w.walletMismatch : w.noWallet
          );
          return;
        }
      }
    }

    setStatus('processing');
    setError(null);
    setCheckout(null);
    setDeposit(null);

    try {
      if (mode === 'deposit') {
        const response = await fetch('/api/wallet/deposit-intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountUsd: totalUsd,
            method: paymentMethod,
            paymentOptionId: selectedDepositOptionId,
            auto: false,
            stablecoinNetwork,
            walletAddress: linkedWalletAddress
          })
        });

        const data = (await response.json()) as { error?: string; deposit?: DepositResponse };
        if (!response.ok || !data.deposit) {
          if (data.error === 'INVESTOR_WALLET_REQUIRED') {
            window.location.href = collectionWalletHref({ returnTo: '/marketplace/carrito?mode=deposit' });
            return;
          }
          throw new Error(data.error ?? 'DEPOSIT_CREATE_FAILED');
        }

        setDeposit(data.deposit);

        if (data.deposit.providerCheckoutUrl) {
          window.location.href = data.deposit.providerCheckoutUrl;
          return;
        }

        if (paymentMethod === 'USDC_ONCHAIN' || paymentMethod === 'CUSTODIAL_STABLECOIN') {
          setStatus('manual');
          return;
        }

        const providerMeta = (data.deposit.metadata?.provider as Record<string, unknown> | undefined) ?? data.deposit.metadata;
        if (paymentMethod === 'LOCAL_RAIL' || isLocalRailManualResult(providerMeta)) {
          setPendingReference(data.deposit.id);
          setStatus('pending_gateway');
          return;
        }

        setStatus('done');
        return;
      }

      const response = await fetch('/api/marketplace/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((row) => ({ projectId: row.projectId, tokenCount: row.tokenCount })),
          method: paymentMethod,
          paymentOptionId: selectedDepositOptionId,
          walletAddress: address,
          stablecoinNetwork
        })
      });

      const data = (await response.json()) as { error?: string; checkout?: CartCheckoutResult };
      if (!response.ok || !data.checkout) {
        if (data.error === 'INVESTOR_WALLET_REQUIRED') {
          window.location.href = collectionWalletHref({ returnTo: '/marketplace/carrito' });
          return;
        }
        if (data.error === 'ACCOUNT_NOT_OPERATIONAL' || data.error === 'KYC_NOT_APPROVED') {
          window.location.href = `/kyc?returnTo=/marketplace/carrito`;
          return;
        }
        throw new Error(data.error ?? 'CART_CHECKOUT_FAILED');
      }

      setCheckout(data.checkout);
      setBatchId(data.checkout.batchId);

      if (data.checkout.confirmed) {
        clearCart();
        setStatus('done');
        void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' });
        return;
      }

      if (data.checkout.providerCheckoutUrl) {
        window.location.href = data.checkout.providerCheckoutUrl;
        return;
      }

      if (paymentMethod === 'USDC_ONCHAIN' || paymentMethod === 'CUSTODIAL_STABLECOIN') {
        setStatus('manual');
        return;
      }

      if (paymentMethod === 'LOCAL_RAIL') {
        setPendingReference(data.checkout.batchId);
        setStatus('pending_gateway');
        return;
      }

      setStatus('idle');
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'CHECKOUT_FAILED');
      setStatus('idle');
    }
  };

  const verifyUsdcPayment = async () => {
    if (!batchId || !manualTxHash.trim()) {
      return;
    }

    setStatus('verifying');
    setError(null);

    const response = await fetch('/api/marketplace/cart/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId,
        txHash: manualTxHash.trim(),
        walletAddress: address
      })
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? 'STABLECOIN_VERIFY_FAILED');
      setStatus('manual');
      return;
    }

    clearCart();
    setStatus('done');
    void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' });
  };

  const verifyDepositTx = async () => {
    if (!deposit || !manualTxHash.trim()) {
      return;
    }

    setStatus('verifying');
    setError(null);

    const response = await fetch('/api/wallet/deposit-intents/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depositId: deposit.id,
        txHash: manualTxHash.trim(),
        walletAddress: linkedWalletAddress ?? undefined
      })
    });

    const data = (await response.json()) as { error?: string; deposit?: DepositResponse };
    if (!response.ok || !data.deposit) {
      setError(data.error ?? 'STABLECOIN_VERIFY_FAILED');
      setStatus('manual');
      return;
    }

    setDeposit(data.deposit);
    setStatus('done');
  };

  const payToAddress = mode === 'deposit' ? deposit?.payToAddress : checkout?.payToAddress;

  const renderDepositOption = (option: DepositPaymentOption) => {
    const selected = selectedDepositOptionId === option.id;
    const amountPrimary =
      option.usesLocalCurrency && option.totalLocal != null
        ? formatDepositLocal(option.totalLocal, option.displayCurrency, currencyLocale)
        : formatUsd(option.totalUsd);
    const amountSecondary =
      option.usesLocalCurrency && option.totalLocal != null ? formatUsd(option.totalUsd) : null;

    return (
      <div key={option.id} className={`bg-white ${!option.configured ? 'opacity-70' : ''}`}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedDepositOptionId(option.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setSelectedDepositOptionId(option.id);
            }
          }}
          className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors ${
            selected ? 'bg-blue-50' : 'hover:bg-slate-50'
          }`}
        >
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-slate-900">{option.label}</span>
            {!option.configured ? (
              <span className="mt-0.5 block text-[11px] font-medium uppercase text-amber-700">
                {c.paymentUnavailable}
              </span>
            ) : (option.id === 'electronic_wallet' || option.id === 'walletconnect_usdc') &&
              walletGuard.linkedWallet ? (
              <span className="mt-0.5 block text-[11px] text-slate-600">
                {formatMessage(c.electronicWalletLinkedHint, {
                  address: `${walletGuard.linkedWallet.slice(0, 6)}…${walletGuard.linkedWallet.slice(-4)}`
                })}
              </span>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm font-bold text-blue-700">{amountPrimary}</p>
            {amountSecondary ? (
              <p className="font-mono text-[11px] text-slate-500">{amountSecondary}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={option.label}
            aria-pressed={selected}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedDepositOptionId(option.id);
            }}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 bg-white shadow-sm transition-colors ${
              selected
                ? 'border-blue-600 ring-2 ring-blue-600/20'
                : 'border-slate-300 hover:border-blue-400'
            }`}
          >
            {selected ? <span className="h-3 w-3 rounded-sm bg-blue-600" /> : null}
          </button>
        </div>
        {selected ? (
          <div className="space-y-1 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
            <div className="flex justify-between gap-4">
              <span>{c.feeCommission}</span>
              <span className="font-mono font-medium text-slate-900">{formatUsd(option.platformFeeUsd)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>{c.feeGas}</span>
              <span className="font-mono font-medium text-slate-900">{formatUsd(option.gasFeeUsd)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>{c.feeOther}</span>
              <span className="font-mono font-medium text-slate-900">{formatUsd(option.networkFeeUsd)}</span>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={mode === 'deposit' ? '/dashboard/portfolio' : '/marketplace'}
          className="inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text"
        >
          <ArrowLeft size={16} />
          {mode === 'deposit' ? c.backToWallet : t.common.backToMarketplace}
        </Link>
        {mode === 'purchase' ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-terminal-border bg-terminal-card px-3 py-1 text-xs font-semibold text-terminal-muted">
            <ShoppingCart size={14} />
            {formatMessage(c.itemsBadge, { count: cartItemCount })}
          </span>
        ) : null}
      </div>

      <article className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
        <div className="border-b border-terminal-border px-8 py-6">
          <p className="text-sm font-medium uppercase tracking-wider text-terminal-primary">
            {mode === 'deposit' ? c.depositTitle : c.purchaseTitle}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-terminal-text">{investorName}</h1>
          <p className="mt-1 text-sm text-terminal-muted">{mode === 'deposit' ? c.depositSubtitle : c.purchaseSubtitle}</p>
        </div>

        <div className="space-y-6 p-8">
          {mode === 'purchase' ? (
            items.length === 0 ? (
              <p className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-6 text-sm text-terminal-muted">
                {c.emptyCart}
              </p>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.projectId}
                    className="flex gap-4 rounded-lg border border-terminal-border bg-terminal-bg p-4"
                  >
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md">
                      <Image src={item.imageUrl} alt={item.title} fill className="object-cover" sizes="96px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-terminal-text">{item.title}</p>
                          <p className="text-xs text-terminal-muted">{item.location}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.projectId)}
                          className="rounded-lg p-1 text-terminal-muted hover:text-terminal-warning"
                          aria-label={c.removeItem}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setTokenCount(item.projectId, item.tokenCount - 1)}
                            className="rounded-lg border border-terminal-border p-1.5 text-terminal-muted hover:text-terminal-text"
                            aria-label={t.checkout.lessTokens}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="min-w-[3rem] text-center font-mono text-lg font-bold text-terminal-text">
                            {item.tokenCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTokenCount(item.projectId, item.tokenCount + 1)}
                            className="rounded-lg border border-terminal-border p-1.5 text-terminal-muted hover:text-terminal-text"
                            aria-label={t.checkout.moreTokens}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <p className="font-mono text-sm text-terminal-primary">
                          {formatFromUsd(item.pricePerTokenUsd * item.tokenCount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
              <label className="text-xs font-medium uppercase tracking-wider text-terminal-muted">{c.depositAmountUsd}</label>
              <input
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                inputMode="decimal"
                className="mt-2 w-full rounded-lg border border-terminal-border bg-terminal-card px-3 py-2.5 text-right font-mono text-lg text-terminal-text outline-none focus:border-terminal-primary/50"
                placeholder="100"
              />
            </div>
          )}

          {showPaymentMethods ? (
            <div className="rounded-lg border border-terminal-border p-4">
              <div className="flex items-baseline justify-between gap-4 text-base font-semibold text-terminal-text">
                <span>{mode === 'deposit' ? c.totalDepositUsd : formatMessage(c.totalUsdc, { currency })}</span>
                <span className="shrink-0 font-mono text-terminal-primary">
                  {mode === 'deposit' ? formatUsd(totalUsd) : formatFromUsd(totalUsd)}
                </span>
              </div>
            </div>
          ) : null}

          {showPaymentMethods ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm font-semibold text-terminal-text">
                {c.selectPaymentMethod}
              </p>
              {paymentQuoteExpired ? (
                <p className="text-xs text-terminal-warning">{c.quoteExpired}</p>
              ) : null}
              <div className="space-y-5">
                {paymentGroups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <p className="px-1 text-xs font-semibold uppercase tracking-wide text-terminal-muted">
                      {c.paymentGroups[group.id]}
                    </p>
                    {group.available.length > 0 ? (
                      <div className="divide-y divide-terminal-border overflow-hidden rounded-lg border border-terminal-border bg-white">
                        {group.available.map((option) => renderDepositOption(option))}
                      </div>
                    ) : null}
                    {group.unavailable.length > 0 ? (
                      <div className="space-y-1">
                        {group.available.length > 0 ? (
                          <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-terminal-muted/80">
                            {c.paymentMethodsUnavailable}
                          </p>
                        ) : null}
                        <div className="divide-y divide-terminal-border overflow-hidden rounded-lg border border-dashed border-terminal-border bg-white">
                          {group.unavailable.map((option) => renderDepositOption(option))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {sortedDepositOptions.length === 0 && totalUsd > 0 ? (
                <p className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-xs text-terminal-muted">
                  {c.processing}
                </p>
              ) : null}
              {sortedDepositOptions.length === 0 && totalUsd <= 0 ? (
                <p className="text-xs text-terminal-warning">{c.invalidAmount}</p>
              ) : null}

              <div className="rounded-lg border border-terminal-border p-4">
                <div className="flex items-baseline justify-between gap-4 text-base font-semibold text-terminal-text">
                  <span>{c.totalToPayLabel}</span>
                  <span className="shrink-0 font-mono text-terminal-primary">
                    {formatUsd(selectedDepositOption?.totalUsd ?? totalUsd)}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {showWalletLinker ? (
            <InvestorWalletLinker
              variant="checkout"
              allowReplace
              onError={(message) => setError(message)}
              onLinked={() => {
                void loadDepositQuote();
              }}
            />
          ) : null}

          {mode === 'deposit' &&
          requiresWallet &&
          linkedWalletAddress &&
          status === 'manual' &&
          payToAddress ? (
            <p className="text-xs text-terminal-muted">
              {formatMessage(c.depositFromLinkedWalletHint, {
                address: `${linkedWalletAddress.slice(0, 6)}…${linkedWalletAddress.slice(-4)}`
              })}
            </p>
          ) : null}

          {status === 'pending_gateway' && pendingReference ? (
            <div className="space-y-2 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-3 text-sm text-terminal-text">
              <p className="font-semibold text-terminal-primary">{c.localRailPendingTitle}</p>
              <p className="text-xs text-terminal-muted">
                {formatMessage(mode === 'deposit' ? c.localRailPendingBody : c.localRailPendingPurchase, {
                  method: selectedDepositOption?.label ?? paymentMethod,
                  reference: pendingReference
                })}
              </p>
              <Link
                href={mode === 'deposit' ? '/dashboard/portfolio' : '/dashboard/portfolio'}
                className="inline-flex rounded-lg bg-terminal-primary px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                {mode === 'deposit' ? c.backToWallet : t.checkout.viewPortfolio}
              </Link>
            </div>
          ) : null}

          {status === 'done' ? (
            <div className="space-y-3 rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-4 py-3 text-sm text-terminal-success">
              <p className="font-semibold">{mode === 'deposit' ? c.depositComplete : c.purchaseComplete}</p>
              {mode === 'purchase' ? (
                <Link
                  href="/dashboard/portfolio"
                  className="inline-flex rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  {t.checkout.viewPortfolio}
                </Link>
              ) : (
                <Link
                  href="/dashboard/portfolio"
                  className="inline-flex rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  {c.backToWallet}
                </Link>
              )}
            </div>
          ) : null}

          {status === 'manual' && payToAddress ? (
            <div className="space-y-2 rounded-lg border border-terminal-warning/30 bg-terminal-warning/10 p-4 text-xs text-terminal-muted">
              <p>{t.checkout.sendToCompartment}</p>
              <p className="break-all font-mono text-terminal-text">{payToAddress}</p>
              <input
                value={manualTxHash}
                onChange={(event) => setManualTxHash(event.target.value)}
                placeholder={c.txHashPlaceholder}
                className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
              />
              <button
                type="button"
                onClick={() => void (mode === 'deposit' ? verifyDepositTx() : verifyUsdcPayment())}
                className="rounded-lg bg-terminal-primary px-3 py-2 text-xs font-semibold text-white"
              >
                {c.verifyTx}
              </button>
            </div>
          ) : null}

          {checkout?.providerCheckoutUrl && status !== 'done' ? (
            <a
              href={checkout.providerCheckoutUrl}
              className="inline-flex items-center gap-1 text-sm text-terminal-primary"
              target="_blank"
              rel="noreferrer"
            >
              {c.openGateway} <ExternalLink size={12} />
            </a>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-3 py-2 text-xs text-terminal-warning">
              {error}
            </p>
          ) : null}

          {status !== 'done' ? (
            <div className={showPaymentMethods ? 'space-y-1' : undefined}>
              <button
                type="button"
                disabled={
                  (status !== 'idle' && status !== 'manual') ||
                  (mode === 'purchase' && items.length === 0) ||
                  (showPaymentMethods &&
                    (sortedDepositOptions.length === 0 ||
                      !selectedDepositOptionId ||
                      paymentQuoteExpired ||
                      !selectedDepositOption?.configured)) ||
                  (requiresWallet &&
                    (mode === 'deposit' ? !walletGuard.isWalletLinked : !walletGuard.canSignOnChain))
                }
                onClick={() => void handleConfirm()}
                className="w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'processing'
                  ? c.processing
                  : status === 'verifying'
                    ? c.verifying
                    : mode === 'deposit'
                      ? c.continueDeposit
                      : c.confirmButton}
              </button>
              {showPaymentMethods && quoteExpiresAt && quoteSecondsLeft > 0 ? (
                <p className="text-right text-xs font-medium text-terminal-primary">
                  {formatMessage(c.quoteExpiresIn, { seconds: String(quoteSecondsLeft) })}
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === 'purchase' && items.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                clearCart();
                router.push('/marketplace');
              }}
              className="w-full rounded-lg border border-terminal-border px-4 py-2 text-sm text-terminal-muted hover:text-terminal-text"
            >
              {c.clearCart}
            </button>
          ) : null}
        </div>
      </article>
    </section>
  );
}
