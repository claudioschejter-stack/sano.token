'use client';

import { ArrowLeft, Minus, Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatMessage } from '../../i18n';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { findListingById } from '../../lib/findListing';
import { fetchMarketplaceFeedClient } from '../../lib/marketplaceApi';
import type { MarketplaceListing } from '../../types/marketplace';
import { useCartStore } from '../../store/useCartStore';
import { StickyActionBar } from '../mobile/StickyActionBar';

type AddToCartViewProps = {
  projectId: string;
};

export function AddToCartView({ projectId }: AddToCartViewProps) {
  const t = useTranslation();
  const a = t.marketplace.addToCart;
  const { intlLocale } = useLocale();
  const { formatUsdPlain } = useLocalCurrency();
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenQty, setTokenQty] = useState(1);

  useEffect(() => {
    let cancelled = false;

    void fetchMarketplaceFeedClient()
      .then((feed) => {
        if (cancelled) {
          return;
        }
        setListing(findListingById(projectId, feed.listings) ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setListing(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const maxTokens = listing?.availableTokens ?? 0;
  const pricePerToken = listing?.pricePerTokenUsd ?? 0;
  const totalUsdc = useMemo(() => pricePerToken * tokenQty, [pricePerToken, tokenQty]);
  const isSoldOut = maxTokens <= 0;

  const adjustQty = (delta: number) => {
    setTokenQty((current) => {
      const next = current + delta;
      return Math.min(Math.max(1, next), Math.max(1, maxTokens));
    });
  };

  const handleAddToCart = () => {
    if (!listing || isSoldOut) {
      return;
    }

    addItem({
      projectId: listing.id,
      title: listing.title,
      location: listing.location,
      imageUrl: listing.imageUrl,
      pricePerTokenUsd: listing.pricePerTokenUsd,
      availableTokens: listing.availableTokens,
      tokenSymbol: listing.tokenSymbol,
      tokenCount: tokenQty
    });

    router.push('/marketplace');
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-lg animate-pulse space-y-4">
        <div className="h-4 w-40 rounded bg-terminal-border" />
        <div className="h-48 rounded-xl bg-terminal-border" />
        <div className="h-32 rounded-xl bg-terminal-border" />
      </section>
    );
  }

  if (!listing) {
    return (
      <section className="mx-auto max-w-lg">
        <Link
          href="/marketplace"
          className="mb-6 inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text"
        >
          <ArrowLeft size={16} />
          {t.common.backToMarketplace}
        </Link>
        <p className="text-sm text-terminal-muted">{t.marketplace.empty}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-lg pb-28 md:pb-0">
      <Link
        href="/marketplace"
        className="mb-6 inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text"
      >
        <ArrowLeft size={16} />
        {t.common.backToMarketplace}
      </Link>

      <article className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
        <div className="relative h-36 w-full">
          <Image src={listing.imageUrl} alt={listing.title} fill className="object-cover" sizes="512px" />
          <div className="absolute inset-0 bg-gradient-to-t from-terminal-card to-transparent" />
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-terminal-primary">{a.eyebrow}</p>
            <h1 className="mt-1 text-xl font-bold text-terminal-text">{listing.title}</h1>
            {listing.tokenSymbol ? (
              <p className="mt-1 font-mono text-sm text-terminal-muted">
                {a.tokenSymbol}: {listing.tokenSymbol}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-terminal-muted">{a.quantity}</p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustQty(-1)}
                  disabled={isSoldOut || tokenQty <= 1}
                  className="rounded-lg border border-terminal-border p-2 text-terminal-muted hover:text-terminal-text disabled:opacity-40"
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
                  disabled={isSoldOut || tokenQty >= maxTokens}
                  className="rounded-lg border border-terminal-border p-2 text-terminal-muted hover:text-terminal-text disabled:opacity-40"
                  aria-label={t.checkout.moreTokens}
                >
                  <Plus size={16} />
                </button>
              </div>
              <p className="text-right text-xs text-terminal-muted">
                {formatMessage(a.maxAvailable, { count: maxTokens.toLocaleString(intlLocale) })}
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-terminal-border p-4">
            <div className="flex justify-between text-sm text-terminal-muted">
              <span>{a.priceUsdc}</span>
              <span className="font-mono text-terminal-text">USDC {formatUsdPlain(pricePerToken, { min: 2, max: 2 })}</span>
            </div>
            <div className="flex justify-between border-t border-terminal-border pt-3 text-base font-semibold text-terminal-text">
              <span>{a.lineTotal}</span>
              <span className="font-mono text-terminal-primary">USDC {formatUsdPlain(totalUsdc, { min: 2, max: 2 })}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isSoldOut}
            className="hidden w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex md:justify-center"
          >
            {a.addButton}
          </button>
        </div>
      </article>

      <StickyActionBar className="md:hidden">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isSoldOut}
          className="w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {a.addButton}
        </button>
      </StickyActionBar>
    </section>
  );
}
