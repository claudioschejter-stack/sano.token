'use client';

import { ArrowLeft, ExternalLink, Minus, Plus, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatMessage } from '../../i18n';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { findListingById } from '../../lib/findListing';
import { fetchMarketplaceFeedClient } from '../../lib/marketplaceApi';
import { BASE_USDC_ADDRESS } from '../../lib/web3/config';
import type { MarketplaceListing } from '../../types/marketplace';
import { BuyButton } from './BuyButton';
import { WalletConnectButton } from './WalletConnectButton';

type CheckoutViewProps = {
  projectId: string;
  investorName: string;
  kycApproved: boolean;
};

export function CheckoutView({ projectId, investorName, kycApproved }: CheckoutViewProps) {
  const t = useTranslation();
  const w = t.wallet;
  const { intlLocale } = useLocale();
  const { address, isConnected } = useAccount();
  const walletGuard = useLinkedWalletGuard();
  const { formatFromUsd, currency } = useLocalCurrency();

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [tokenQty, setTokenQty] = useState(10);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('USDC_ONCHAIN');
  const [stablecoinNetwork, setStablecoinNetwork] = useState<StablecoinNetworkId>('BASE');
  const [manualTxHash, setManualTxHash] = useState('');
  const [status, setStatus] = useState<'idle' | 'creating' | 'paying' | 'manual' | 'verifying' | 'done'>('idle');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchMarketplaceFeedClient()
      .then((feed) => {
        if (cancelled) {
          return;
        }
        const match = findListingById(projectId, feed.listings);
        setListing(match ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setListing(findListingById(projectId, []) ?? null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const maxTokens = listing?.availableTokens ?? 1;
  const pricePerToken = listing?.pricePerTokenUsd ?? 0;
  const totalUsd = useMemo(() => pricePerToken * tokenQty, [pricePerToken, tokenQty]);
  const vaultCheckout =
    paymentMethod === 'USDC_ONCHAIN' &&
    stablecoinNetwork === 'BASE' &&
    Boolean(listing?.vaultAddress);

  const createPaymentIntent = async (): Promise<PaymentIntentResponse> => {
    const response = await fetch(`/api/marketplace/${projectId}/payment-intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenCount: tokenQty, walletAddress: address, method: paymentMethod, stablecoinNetwork })
    });

    const data = (await response.json()) as { error?: string; paymentIntent?: PaymentIntentResponse };

      if (!response.ok) {
        if (data.error === 'ACCOUNT_NOT_OPERATIONAL' || data.error === 'KYC_NOT_APPROVED') {
          window.location.href = `/kyc?returnTo=/marketplace/${projectId}/checkout`;
          throw new Error('KYC_REQUIRED');
        }
        if (data.error === 'INVESTOR_ACCESS_NOT_ENABLED') {
          throw new Error('INVESTOR_ACCESS_NOT_ENABLED');
        }
        throw new Error(data.error ?? 'PURCHASE_FAILED');
      }

    if (!data.paymentIntent) {
      throw new Error('PAYMENT_INTENT_FAILED');
    }

    setPaymentIntent(data.paymentIntent);
    return data.paymentIntent;
  };

  const adjustQty = (delta: number) => {
    setTokenQty((current) => {
      const next = current + delta;
      return Math.min(Math.max(1, next), Math.max(1, maxTokens));
    });
  };

  const handlePurchase = async () => {
    if (paymentMethod !== 'INTERNAL_BALANCE') {
      if (!walletGuard.isWalletLinked) {
        setPurchaseError(w.walletNotLinked);
        return;
      }
      if (!walletGuard.canSignOnChain || !address) {
        setPurchaseError(walletGuard.isWrongNetwork ? w.wrongNetwork : walletGuard.isWalletMismatch ? w.walletMismatch : w.noWallet);
        return;
      }
    }

    setStatus('creating');
    setPurchaseError(null);
    setPaymentIntent(null);

    try {
      const intent = await createPaymentIntent();

      if (paymentMethod === 'USDC_ONCHAIN' && vaultCheckout) {
        setStatus('idle');
        return intent;
      }

      if (paymentMethod === 'USDC_ONCHAIN') {
        await payWithUsdcTransfer(intent);
        return;
      }

      if (intent.providerCheckoutUrl) {
        window.location.href = intent.providerCheckoutUrl;
        return;
      }

      setStatus('done');
    } catch {
      setPurchaseError('PURCHASE_FAILED');
      setStatus('idle');
    }
  };

  const payWithUsdcTransfer = async (intent: PaymentIntentResponse) => {
    if (!address) {
      return;
    }

    const metadata = (intent.metadata ?? {}) as { usdcTokenAddress?: string; usdcDecimals?: number; autoTransferSupported?: boolean };
    const tokenAddress = metadata.usdcTokenAddress;
    const decimals = Number(metadata.usdcDecimals ?? 6);

    if (!metadata.autoTransferSupported) {
      setStatus('manual');
      return;
    }

    if (!tokenAddress || !intent.payToAddress || !intent.chainId) {
      setPurchaseError('USDC_PAYMENT_NOT_CONFIGURED');
      setStatus('idle');
      return;
    }

    setPurchaseError('LEGACY_TREASURY_TRANSFER_USE_WALLET');
    setStatus('manual');
  };

  const verifyManualStablecoinTx = async () => {
    if (!paymentIntent || !address || !manualTxHash.trim()) {
      return;
    }

    setStatus('verifying');
    setPurchaseError(null);

    const response = await fetch('/api/payments/usdc/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId: paymentIntent.id,
        txHash: manualTxHash.trim(),
        walletAddress: stablecoinNetwork === 'BASE' || stablecoinNetwork === 'POLYGON' ? address : undefined
      })
    });

    const data = (await response.json()) as { error?: string; paymentIntent?: PaymentIntentResponse };
    if (!response.ok || !data.paymentIntent) {
      setPurchaseError(data.error ?? 'STABLECOIN_VERIFY_FAILED');
      setStatus('manual');
      return;
    }

    setPaymentIntent(data.paymentIntent);
    setListing((current) =>
      current ? { ...current, availableTokens: Math.max(0, current.availableTokens - tokenQty) } : current
    );
    setStatus('done');
  };

  if (!listing) {
    return (
      <section className="mx-auto max-w-2xl">
        <Link
          href="/marketplace"
          className="mb-6 inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text"
        >
          <ArrowLeft size={16} />
          {t.common.backToMarketplace}
        </Link>
        <p className="text-terminal-muted">{t.checkout.notFound}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl">
      <Link
        href="/marketplace"
        className="mb-6 inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text"
      >
        <ArrowLeft size={16} />
        {t.common.backToMarketplace}
      </Link>

      <article className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
        <div className="relative h-40 w-full">
          <Image src={listing.imageUrl} alt={listing.title} fill className="object-cover" sizes="672px" />
          <div className="absolute inset-0 bg-gradient-to-t from-terminal-card to-transparent" />
        </div>

        <div className="space-y-6 p-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-terminal-primary">{t.checkout.title}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-terminal-text">{investorName}</span>
              <span className="rounded-full border border-terminal-border bg-terminal-bg px-2.5 py-1 text-xs font-semibold text-terminal-muted">
                {t.checkout.investorRole}
              </span>
              {kycApproved ? (
                <span className="rounded-full border border-terminal-success/30 bg-terminal-success/10 px-2.5 py-1 text-xs font-semibold text-terminal-success">
                  {t.checkout.approvedStatus}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-terminal-text">{listing.title}</h1>
            <p className="mt-1 text-sm text-terminal-muted">{listing.location}</p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-3 py-2 text-xs text-terminal-success">
            <ShieldCheck size={14} />
            {t.checkout.kycReady}
          </div>

          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-terminal-muted">{t.checkout.tokenQuantity}</p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustQty(-1)}
                  className="rounded-lg border border-terminal-border p-2 text-terminal-muted hover:text-terminal-text"
                  aria-label={t.checkout.lessTokens}
                >
                  <Minus size={16} />
                </button>
                <span className="min-w-[4rem] text-center font-mono text-2xl font-bold text-terminal-text">
                  {tokenQty}
                </span>
                <button
                  type="button"
                  onClick={() => adjustQty(1)}
                  className="rounded-lg border border-terminal-border p-2 text-terminal-muted hover:text-terminal-text"
                  aria-label={t.checkout.moreTokens}
                >
                  <Plus size={16} />
                </button>
              </div>
              <p className="text-right text-xs text-terminal-muted">
                {formatMessage(t.checkout.maxAvailable, {
                  count: maxTokens.toLocaleString(intlLocale)
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-terminal-border p-4">
            <div className="flex justify-between text-sm text-terminal-muted">
              <span>{t.checkout.pricePerToken}</span>
              <span className="font-mono text-terminal-text">{formatFromUsd(pricePerToken)}</span>
            </div>
            <div className="flex justify-between text-sm text-terminal-muted">
              <span>{formatMessage(t.checkout.subtotal, { count: tokenQty })}</span>
              <span className="font-mono text-terminal-text">{formatFromUsd(totalUsd)}</span>
            </div>
            <div className="flex justify-between border-t border-terminal-border pt-3 text-base font-semibold text-terminal-text">
              <span>{formatMessage(t.checkout.total, { currency })}</span>
              <span className="font-mono text-terminal-primary">{formatFromUsd(totalUsd)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-xs leading-relaxed text-terminal-muted">
              {t.checkout.subscriptionNotice}
            </p>
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-terminal-muted">
                {t.checkout.paymentMethodsTitle}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {PAYMENT_METHODS.map((method) => (
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
                    <span className="block font-semibold">{method.label}</span>
                    <span className="mt-1 block">{method.description}</span>
                  </button>
                ))}
              </div>
              {paymentMethod === 'USDC_ONCHAIN' ? (
                <div className="mt-4 space-y-2 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-xs text-terminal-muted">
                  <p>USDC en Base (chainId 8453)</p>
                  <p className="text-terminal-text">{t.checkout.compartmentPayee}</p>
                </div>
              ) : null}
            </div>

            <WalletConnectButton />
            {!walletGuard.isWalletLinked ? (
              <p className="text-xs font-medium text-terminal-warning">{w.walletNotLinked}</p>
            ) : null}
            {walletGuard.isWalletMismatch ? (
              <p className="text-xs font-medium text-terminal-warning">{w.walletMismatch}</p>
            ) : null}
            {walletGuard.isWrongNetwork ? (
              <p className="text-xs font-medium text-terminal-warning">{w.wrongNetwork}</p>
            ) : null}
            {vaultCheckout ? (
              <BuyButton
                vaultAddress={listing.vaultAddress}
                usdcAddress={BASE_USDC_ADDRESS}
                amountUsd={totalUsd.toFixed(6).replace(/\.?0+$/, '') || '0'}
                chainId={8453}
                disabled={status === 'done' || status === 'verifying'}
                onPrepare={async () => {
                  setPurchaseError(null);
                  setStatus('creating');
                  try {
                    const intent = await createPaymentIntent();
                    setStatus('idle');
                    return { paymentIntentId: intent.id };
                  } catch (error) {
                    setPurchaseError(error instanceof Error ? error.message : 'PURCHASE_FAILED');
                    setStatus('idle');
                    throw error;
                  }
                }}
                onSuccess={async ({ depositTxHash, paymentIntentId }) => {
                  if (!paymentIntentId || !address) return;
                  setStatus('verifying');
                  setPurchaseError(null);

                  const response = await fetch('/api/payments/usdc/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      paymentIntentId,
                      txHash: depositTxHash,
                      walletAddress: address
                    })
                  });

                  const data = (await response.json()) as { error?: string; paymentIntent?: PaymentIntentResponse };
                  if (!response.ok || !data.paymentIntent) {
                    setPurchaseError(data.error ?? 'USDC_VERIFY_FAILED');
                    setStatus('idle');
                    return;
                  }

                  setPaymentIntent(data.paymentIntent);
                  setListing((current) =>
                    current ? { ...current, availableTokens: Math.max(0, current.availableTokens - tokenQty) } : current
                  );
                  setStatus('done');
                  void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' });
                }}
              />
            ) : null}
            {status === 'done' ? (
              <div className="space-y-3 rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-4 py-3 text-sm text-terminal-success">
                <p className="font-semibold">{t.checkout.purchaseComplete}</p>
                <Link
                  href="/dashboard/portfolio"
                  className="inline-flex rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  {t.checkout.viewPortfolio}
                </Link>
              </div>
            ) : null}
            {paymentIntent ? (
              <div className="space-y-2 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-xs text-terminal-muted">
                <p>
                  Orden: <span className="font-mono text-terminal-text">{paymentIntent.id}</span>
                </p>
                <p>
                  Estado: <span className="font-semibold text-terminal-primary">{paymentIntent.status}</span>
                </p>
                {paymentIntent.providerCheckoutUrl ? (
                  <a
                    href={paymentIntent.providerCheckoutUrl}
                    className="inline-flex items-center gap-1 text-terminal-primary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir pasarela <ExternalLink size={12} />
                  </a>
                ) : null}
                {status === 'manual' && paymentIntent.payToAddress ? (
                  <div className="space-y-2 rounded-lg border border-terminal-warning/30 bg-terminal-warning/10 p-3">
                    <p>{t.checkout.sendToCompartment}</p>
                    <p className="break-all font-mono text-terminal-text">{paymentIntent.payToAddress}</p>
                    <input
                      value={manualTxHash}
                      onChange={(event) => setManualTxHash(event.target.value)}
                      placeholder="Tx hash"
                      className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
                    />
                    <button
                      type="button"
                      onClick={() => void verifyManualStablecoinTx()}
                      className="rounded-lg bg-terminal-primary px-3 py-2 text-xs font-semibold text-white"
                    >
                      Verificar tx
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {purchaseError ? (
              <p className="rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-3 py-2 text-xs text-terminal-warning">
                {purchaseError}
              </p>
            ) : null}
            {!vaultCheckout ? (
            <button
              type="button"
              disabled={(paymentMethod !== 'INTERNAL_BALANCE' && !isConnected) || status !== 'idle'}
              onClick={() => void handlePurchase()}
              className="w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'done'
                ? 'Pago confirmado'
                : status === 'creating'
                  ? 'Creando orden…'
                  : status === 'paying'
                    ? 'Enviando USDC…'
                    : status === 'manual'
                      ? 'Esperando tx hash…'
                    : status === 'verifying'
                      ? 'Verificando pago…'
                  : isConnected || paymentMethod === 'INTERNAL_BALANCE'
                    ? t.checkout.createOrderPay
                    : t.checkout.connectToContinue}
            </button>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
}

type PaymentMethod = 'INTERNAL_BALANCE' | 'USDC_ONCHAIN' | 'STRIPE' | 'MERCADO_PAGO' | 'COINBASE' | 'CUSTODIAL_STABLECOIN';
type StablecoinNetworkId = 'BASE' | 'POLYGON' | 'TRON' | 'SOLANA';

type PaymentIntentResponse = {
  id: string;
  method: PaymentMethod;
  status: string;
  tokenCount: number;
  amountUsd: string;
  currency: string;
  chainId: number | null;
  payToAddress: string | null;
  providerCheckoutUrl: string | null;
  metadata: unknown;
};

const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string; description: string }> = [
  {
    id: 'INTERNAL_BALANCE',
    label: 'Saldo Sanova',
    description: 'Usa fondos ya depositados en tu cuenta interna.'
  },
  {
    id: 'USDC_ONCHAIN',
    label: 'USDC on-chain',
    description: 'Pago desde tu wallet al patrimonio fiduciario del Compartimento.'
  },
  {
    id: 'STRIPE',
    label: 'Stripe',
    description: 'Tarjeta o banco, con confirmación por webhook.'
  },
  {
    id: 'MERCADO_PAGO',
    label: 'Mercado Pago',
    description: 'Pago fiat LatAm con conciliación automática.'
  },
  {
    id: 'COINBASE',
    label: 'Coinbase',
    description: 'Checkout cripto/onramp internacional.'
  }
];

const STABLECOIN_NETWORKS: Array<{ id: StablecoinNetworkId; label: string; description: string }> = [
  {
    id: 'BASE',
    label: 'Base',
    description: 'Recomendada: normalmente la más barata para USDC.'
  },
  {
    id: 'POLYGON',
    label: 'Polygon',
    description: 'Bajo costo y amplia compatibilidad EVM.'
  },
  {
    id: 'SOLANA',
    label: 'Solana',
    description: 'Muy barata, verifica tx hash manualmente.'
  },
  {
    id: 'TRON',
    label: 'TRON',
    description: 'Útil para USDT global, verifica tx hash manualmente.'
  }
];

function decimalToBaseUnits(value: string, decimals: number): string {
  const [whole, fraction = ''] = value.split('.');
  const padded = fraction.padEnd(decimals, '0').slice(0, decimals);
  return `${whole}${padded}`.replace(/^0+(?=\d)/, '') || '0';
}
