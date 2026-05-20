'use client';

import { ArrowLeft, Minus, Plus, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatMessage } from '../../i18n';
import { useInjectedWallet } from '../../hooks/useInjectedWallet';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { findListingById } from '../../lib/findListing';
import { fetchMarketplaceFeedClient } from '../../lib/marketplaceApi';
import type { MarketplaceListing } from '../../types/marketplace';
import { WalletConnectButton } from './WalletConnectButton';

type CheckoutViewProps = {
  projectId: string;
};

export function CheckoutView({ projectId }: CheckoutViewProps) {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { address, isConnected } = useInjectedWallet();
  const { formatFromUsd, currency } = useLocalCurrency();

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [tokenQty, setTokenQty] = useState(10);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');

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

  const adjustQty = (delta: number) => {
    setTokenQty((current) => {
      const next = current + delta;
      return Math.min(Math.max(1, next), Math.max(1, maxTokens));
    });
  };

  const handlePurchase = async () => {
    if (!isConnected || !address) {
      return;
    }

    setStatus('submitting');
    await new Promise((resolve) => setTimeout(resolve, 900));
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
            <WalletConnectButton />
            <button
              type="button"
              disabled={!isConnected || status === 'submitting'}
              onClick={() => void handlePurchase()}
              className="w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'done'
                ? t.checkout.requestSent
                : status === 'submitting'
                  ? t.checkout.signing
                  : isConnected
                    ? t.checkout.confirmPurchase
                    : t.checkout.connectToContinue}
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
