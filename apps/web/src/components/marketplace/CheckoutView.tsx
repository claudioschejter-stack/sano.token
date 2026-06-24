'use client';

import { ArrowLeft, Loader2, Minus, Plus, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatMessage } from '../../i18n';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { useCheckoutPaymentCountry } from '../../hooks/useCheckoutPaymentCountry';
import { findListingById } from '../../lib/findListing';
import { fetchMarketplaceFeedClient } from '../../lib/marketplaceApi';
import type { MarketplaceListing } from '../../types/marketplace';
import { StickyActionBar } from '../mobile/StickyActionBar';
import { SimplifiedCheckout } from '../payments/simplified';

type CheckoutViewProps = {
  projectId: string;
  investorName: string;
  kycApproved: boolean;
};

type CreateIntentResult = {
  id: string;
  status: string;
  payToAddress: string | null;
  providerCheckoutUrl: string | null;
};

export function CheckoutView({ projectId, investorName, kycApproved }: CheckoutViewProps) {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatFromUsd, currency } = useLocalCurrency();
  const country = useCheckoutPaymentCountry('USD');

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [tokenQty, setTokenQty] = useState(10);
  const [status, setStatus] = useState<'idle' | 'creating' | 'paying' | 'done'>('idle');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMarketplaceFeedClient()
      .then((feed) => {
        if (!cancelled) {
          const match = findListingById(projectId, feed.listings);
          setListing(match ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setListing(null);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const maxTokens = listing?.availableTokens ?? 1;
  const pricePerToken = listing?.pricePerTokenUsd ?? 0;
  const totalUsd = useMemo(() => pricePerToken * tokenQty, [pricePerToken, tokenQty]);

  const adjustQty = (delta: number) => {
    setTokenQty((current) => Math.min(Math.max(1, current + delta), Math.max(1, maxTokens)));
  };

  const handleProceed = async () => {
    setStatus('creating');
    setPurchaseError(null);
    try {
      const response = await fetch(`/api/marketplace/${projectId}/payment-intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenCount: tokenQty, method: 'USDC_ONCHAIN' })
      });
      const data = (await response.json()) as { error?: string; paymentIntent?: CreateIntentResult };
      if (!response.ok) {
        if (data.error === 'ACCOUNT_NOT_OPERATIONAL' || data.error === 'KYC_NOT_APPROVED') {
          window.location.href = `/kyc?returnTo=${encodeURIComponent('/marketplace/' + projectId + '/checkout')}`;
          return;
        }
        throw new Error(data.error ?? 'PURCHASE_FAILED');
      }
      if (!data.paymentIntent) throw new Error('PAYMENT_INTENT_FAILED');
      setReferenceId(data.paymentIntent.id);
      setStatus('paying');
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : 'PURCHASE_FAILED');
      setStatus('idle');
    }
  };

  if (!listing) {
    return (
      <section className="mx-auto max-w-2xl">
        <Link href="/marketplace" className="mb-6 inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text">
          <ArrowLeft size={16} />
          {t.common.backToMarketplace}
        </Link>
        <p className="text-terminal-muted">{t.checkout.notFound}</p>
      </section>
    );
  }

  const hasVaultSharesDelivery = Boolean(listing.vaultAddress);

  return (
    <section className="mx-auto max-w-2xl pb-28 md:pb-0">
      <Link href="/marketplace" className="mb-6 inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text">
        <ArrowLeft size={16} />
        {t.common.backToMarketplace}
      </Link>

      <article className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
        <div className="relative h-40 w-full">
          <Image src={listing.imageUrl} alt={listing.title} fill className="object-cover" sizes="672px" />
          <div className="absolute inset-0 bg-gradient-to-t from-terminal-card to-transparent" />
        </div>

        <div className="space-y-6 p-4 sm:p-8">
          {/* Investor header */}
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-terminal-primary">{t.checkout.title}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-terminal-text">{investorName}</span>
              <span className="rounded-full border border-terminal-border bg-terminal-bg px-2.5 py-1 text-xs font-semibold text-terminal-muted">
                {t.checkout.investorRole}
              </span>
              {kycApproved && (
                <span className="rounded-full border border-terminal-success/30 bg-terminal-success/10 px-2.5 py-1 text-xs font-semibold text-terminal-success">
                  {t.checkout.approvedStatus}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-terminal-text">{listing.title}</h1>
            <p className="mt-1 text-sm text-terminal-muted">{listing.location}</p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-3 py-2 text-xs text-terminal-success">
            <ShieldCheck size={14} />
            {t.checkout.kycReady}
          </div>

          {/* Token quantity */}
          {status === 'idle' || status === 'creating' ? (
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
                  <span className="min-w-[4rem] text-center font-mono text-2xl font-bold text-terminal-text">{tokenQty}</span>
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
                  {formatMessage(t.checkout.maxAvailable, { count: maxTokens.toLocaleString(intlLocale) })}
                </p>
              </div>
            </div>
          ) : null}

          {/* Order summary */}
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

          {/* Subscription notice */}
          <p className="rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-xs leading-relaxed text-terminal-muted">
            {t.checkout.subscriptionNotice}
          </p>

          {/* Error */}
          {purchaseError && (
            <p className="rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-3 py-2 text-xs text-terminal-warning">
              {purchaseError}
            </p>
          )}

          {/* Success */}
          {status === 'done' && (
            <div className="space-y-3 rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-4 py-3 text-sm">
              <p className="font-semibold text-terminal-success">{t.checkout.purchaseComplete}</p>
              {hasVaultSharesDelivery && (
                <p className="text-xs text-terminal-muted">{t.checkout.purchaseSharesPending}</p>
              )}
              <Link href="/dashboard/portfolio" className="inline-flex rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                {t.checkout.viewPortfolio}
              </Link>
            </div>
          )}

          {/* Payment gateway */}
          {status === 'paying' && referenceId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-terminal-primary/30 bg-terminal-primary/5 px-3 py-2">
                <span className="text-xs font-semibold text-terminal-primary">Orden:</span>
                <span className="font-mono text-xs text-terminal-muted">{referenceId}</span>
              </div>
              <SimplifiedCheckout
                amountUsd={totalUsd}
                referenceId={referenceId}
                investorName={investorName}
                country={country}
                onFunded={() => setStatus('done')}
                onError={(msg) => setPurchaseError(msg)}
              />
            </div>
          ) : null}

          {/* Proceed button (only when idle) */}
          {status === 'idle' && (
            <button
              type="button"
              disabled={totalUsd <= 0}
              onClick={() => void handleProceed()}
              className="hidden w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 md:block"
            >
              Ir a pagar
            </button>
          )}

          {status === 'creating' && (
            <div className="hidden items-center justify-center gap-2 py-3 md:flex">
              <Loader2 className="h-4 w-4 animate-spin text-terminal-primary" />
              <span className="text-sm text-terminal-muted">Preparando orden…</span>
            </div>
          )}
        </div>
      </article>

      {status === 'idle' && (
        <StickyActionBar
          summary={
            <div className="flex items-center justify-between text-sm">
              <span className="text-terminal-muted">{formatMessage(t.checkout.total, { currency })}</span>
              <span className="font-mono font-semibold text-terminal-primary">{formatFromUsd(totalUsd)}</span>
            </div>
          }
        >
          <button
            type="button"
            disabled={totalUsd <= 0}
            onClick={() => void handleProceed()}
            className="min-h-12 w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ir a pagar
          </button>
        </StickyActionBar>
      )}
    </section>
  );
}
