'use client';

import { ArrowLeft, ExternalLink, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatMessage } from '../../i18n';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { PaymentMethod } from '@sanova/database';
import { useCartStore } from '../../store/useCartStore';
import { WalletConnectButton } from './WalletConnectButton';

type CheckoutMethodOption = {
  id: PaymentMethod;
  label: string;
  description: string;
  configured: boolean;
  automatic: boolean;
  supportsDeposit: boolean;
  supportsPurchase: boolean;
};

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
};

type CartCheckoutViewProps = {
  investorName: string;
  initialMode?: 'purchase' | 'deposit';
};

export function CartCheckoutView({ investorName, initialMode = 'purchase' }: CartCheckoutViewProps) {
  const t = useTranslation();
  const c = t.cartCheckout;
  const w = t.wallet;
  const { intlLocale } = useLocale();
  const { formatFromUsd, currency } = useLocalCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const walletGuard = useLinkedWalletGuard();

  const mode = searchParams.get('mode') === 'deposit' ? 'deposit' : initialMode;
  const returnStatus = searchParams.get('status');
  const batchFromQuery = searchParams.get('batch');

  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const setTokenCount = useCartStore((state) => state.setTokenCount);
  const clearCart = useCartStore((state) => state.clearCart);
  const cartTotalUsd = useCartStore((state) => state.totalUsd());
  const cartItemCount = useCartStore((state) => state.itemCount());

  const [methods, setMethods] = useState<CheckoutMethodOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('USDC_ONCHAIN');
  const [stablecoinNetwork, setStablecoinNetwork] = useState('BASE');
  const [depositAmount, setDepositAmount] = useState('100');
  const [manualTxHash, setManualTxHash] = useState('');
  const [batchId, setBatchId] = useState<string | null>(batchFromQuery);
  const [checkout, setCheckout] = useState<CartCheckoutResult | null>(null);
  const [deposit, setDeposit] = useState<DepositResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'manual' | 'verifying' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const totalUsd = mode === 'deposit' ? Number(depositAmount) || 0 : cartTotalUsd;
  const requiresWallet = paymentMethod !== 'INTERNAL_BALANCE';

  useEffect(() => {
    void fetch(`/api/marketplace/cart/methods?mode=${mode}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { methods?: CheckoutMethodOption[] } | null) => {
        const next = data?.methods ?? [];
        setMethods(next);
        if (next.length) {
          setPaymentMethod((current) => (next.some((row) => row.id === current) ? current : next[0].id));
        }
      })
      .catch(() => setMethods([]));
  }, [mode]);

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

  const methodLabels = useMemo(() => {
    const map = new Map<string, CheckoutMethodOption>();
    for (const method of methods) {
      map.set(method.id, method);
    }
    return map;
  }, [methods]);

  const handleConfirm = async () => {
    if (mode === 'purchase' && items.length === 0) {
      setError(c.emptyCart);
      return;
    }

    if (mode === 'deposit' && (!Number.isFinite(totalUsd) || totalUsd <= 0)) {
      setError(c.invalidAmount);
      return;
    }

    if (requiresWallet) {
      if (!walletGuard.isWalletLinked) {
        setError(w.walletNotLinked);
        return;
      }
      if (!walletGuard.canSignOnChain || !address) {
        setError(
          walletGuard.isWrongNetwork ? w.wrongNetwork : walletGuard.isWalletMismatch ? w.walletMismatch : w.noWallet
        );
        return;
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
            auto: false,
            stablecoinNetwork,
            walletAddress: address
          })
        });

        const data = (await response.json()) as { error?: string; deposit?: DepositResponse };
        if (!response.ok || !data.deposit) {
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

        setStatus('done');
        return;
      }

      const response = await fetch('/api/marketplace/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((row) => ({ projectId: row.projectId, tokenCount: row.tokenCount })),
          method: paymentMethod,
          walletAddress: address,
          stablecoinNetwork
        })
      });

      const data = (await response.json()) as { error?: string; checkout?: CartCheckoutResult };
      if (!response.ok || !data.checkout) {
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
        walletAddress: address
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

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={mode === 'deposit' ? '/dashboard/wallet' : '/marketplace'}
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
              <label className="text-xs font-medium uppercase tracking-wider text-terminal-muted">{c.depositAmount}</label>
              <input
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                inputMode="decimal"
                className="mt-2 w-full rounded-lg border border-terminal-border bg-terminal-card px-3 py-2.5 font-mono text-lg text-terminal-text outline-none focus:border-terminal-primary/50"
                placeholder="100"
              />
            </div>
          )}

          <div className="rounded-lg border border-terminal-border p-4">
            <div className="flex justify-between border-t border-terminal-border pt-3 text-base font-semibold text-terminal-text">
              <span>{formatMessage(c.totalUsdc, { currency })}</span>
              <span className="font-mono text-terminal-primary">{formatFromUsd(totalUsd)}</span>
            </div>
          </div>

          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-terminal-muted">{c.paymentMethodsTitle}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {methods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    paymentMethod === method.id
                      ? 'border-terminal-primary bg-terminal-primary/10 text-terminal-primary'
                      : 'border-terminal-border text-terminal-muted hover:text-terminal-text'
                  }`}
                >
                  <span className="block font-semibold">{methodLabels.get(method.id)?.label ?? method.label}</span>
                  <span className="mt-1 block">{methodLabels.get(method.id)?.description ?? method.description}</span>
                </button>
              ))}
            </div>
            {methods.length === 0 ? (
              <p className="mt-3 text-xs text-terminal-warning">{c.noMethodsConfigured}</p>
            ) : null}
            {(paymentMethod === 'USDC_ONCHAIN' || paymentMethod === 'CUSTODIAL_STABLECOIN') && (
              <div className="mt-4 rounded-lg border border-terminal-border px-3 py-2 text-xs text-terminal-muted">
                <label className="block font-medium text-terminal-text">{c.networkLabel}</label>
                <select
                  value={stablecoinNetwork}
                  onChange={(event) => setStablecoinNetwork(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-terminal-text"
                >
                  <option value="BASE">Base (USDC)</option>
                </select>
              </div>
            )}
          </div>

          {requiresWallet ? (
            <>
              <WalletConnectButton />
              {!walletGuard.isWalletLinked ? (
                <p className="text-xs font-medium text-terminal-warning">{w.walletNotLinked}</p>
              ) : null}
            </>
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
                  href="/dashboard/wallet"
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
            <button
              type="button"
              disabled={
                (status !== 'idle' && status !== 'manual') ||
                (mode === 'purchase' && items.length === 0) ||
                (requiresWallet && !walletGuard.canSignOnChain)
              }
              onClick={() => void handleConfirm()}
              className="w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'processing'
                ? c.processing
                : status === 'verifying'
                  ? c.verifying
                  : c.confirmButton}
            </button>
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
