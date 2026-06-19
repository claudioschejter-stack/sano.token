'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import type {
  SecondaryMarketFeed,
  SecondaryMarketHolding,
  SecondaryMarketOrder,
  SecondaryMarketPlatformBuyback,
  SecondaryMarketProperty
} from '../../types/secondaryMarket';
import { SecondaryMarketLedger } from './SecondaryMarketLedger';

type SecondaryMarketViewProps = {
  initialFeed: SecondaryMarketFeed;
};

export function SecondaryMarketView({ initialFeed }: SecondaryMarketViewProps) {
  const router = useRouter();
  const t = useTranslation();
  const sm = t.secondaryMarket;
  const legal = t.legal;
  const searchParams = useSearchParams();
  const sellProjectFromQuery = searchParams.get('sell');
  const { intlLocale } = useLocale();
  const { formatUsd } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const { checklist } = useAccountStatus();
  const kycApproved = checklist?.kycApproved ?? false;

  const [feed, setFeed] = useState(initialFeed);
  const [holdings, setHoldings] = useState<SecondaryMarketHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const holdingsByProject = useMemo(() => {
    return new Map(holdings.map((row) => [row.projectId, row]));
  }, [holdings]);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const [feedResponse, holdingsResponse] = await Promise.all([
        fetch('/api/secondary-market/feed', { cache: 'no-store' }),
        kycApproved
          ? fetch('/api/secondary-market/holdings', { cache: 'no-store' })
          : Promise.resolve(null)
      ]);

      if (feedResponse.ok) {
        setFeed((await feedResponse.json()) as SecondaryMarketFeed);
      }

      if (holdingsResponse?.ok) {
        const data = (await holdingsResponse.json()) as { holdings: SecondaryMarketHolding[] };
        setHoldings(data.holdings);
      }
    } finally {
      setLoading(false);
    }
  }, [kycApproved]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!sellProjectFromQuery || !kycApproved || loading) {
      return;
    }

    const holding = holdingsByProject.get(sellProjectFromQuery);
    if ((holding?.availableToSell ?? 0) <= 0) {
      return;
    }

    router.replace(
      `/mercado-secundario/checkout?projectId=${encodeURIComponent(sellProjectFromQuery)}&tokenCount=1`
    );
  }, [holdingsByProject, kycApproved, loading, router, sellProjectFromQuery]);

  function goToBuyListing(order: SecondaryMarketOrder) {
    if (!kycApproved || order.isOwnListing) {
      return;
    }

    router.push(`/mercado-secundario/checkout?listingId=${encodeURIComponent(order.id)}`);
  }

  function goToPlatformBuyback(property: SecondaryMarketProperty, buyback: SecondaryMarketPlatformBuyback) {
    if (!kycApproved) {
      return;
    }

    const holding = holdingsByProject.get(property.listing.id);
    if ((holding?.availableToSell ?? 0) <= 0) {
      setActionMessage(sm.noTokensToSell);
      return;
    }

    router.push(
      `/mercado-secundario/checkout?projectId=${encodeURIComponent(buyback.projectId)}&tokenCount=1`
    );
  }

  async function cancelOwnListing(orderId: string) {
    setActionMessage(null);

    try {
      const response = await fetch(`/api/secondary-market/listings/${orderId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('cancel failed');
      }

      setActionMessage(sm.cancelSuccess);
      await refresh();
    } catch {
      setActionMessage(sm.cancelError);
    }
  }

  function handleSelectSell(property: SecondaryMarketProperty, order: SecondaryMarketOrder) {
    if (order.isOwnListing) {
      void cancelOwnListing(order.id);
      return;
    }

    goToBuyListing(order);
  }

  const formatQty = (value: number) => value.toLocaleString(intlLocale);

  return (
    <div className="w-full">
      <header className="mb-6 w-full">
        <p className="text-xs font-medium uppercase tracking-wider text-terminal-primary md:text-sm">
          {sm.brandLabel}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-terminal-text md:text-3xl">{sm.title}</h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-terminal-primary/30 bg-terminal-bg px-2.5 py-1 text-xs font-semibold text-terminal-primary">
            <ArrowLeftRight size={14} />
            {legal.secondaryInternalBadge}
          </span>
        </div>
        <div className="mt-2 w-full space-y-2 text-sm text-terminal-muted md:text-base">
          <p className="w-full">{sm.subtitle}</p>
          <p className="w-full">{sm.subtitleBuyback}</p>
        </div>
      </header>

      {!kycApproved ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-4 py-3 text-sm text-terminal-warning">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <p>{sm.kycRequired}</p>
            <Link href="/kyc?returnTo=/mercado-secundario" className="mt-2 inline-flex font-semibold underline">
              {sm.completeKyc}
            </Link>
          </div>
        </div>
      ) : null}

      {actionMessage ? (
        <p className="mb-4 rounded-lg border border-terminal-border bg-terminal-card px-4 py-3 text-sm text-terminal-text">
          {actionMessage}
        </p>
      ) : null}

      {loading ? <p className="mb-4 text-xs text-terminal-muted">{sm.syncing}</p> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {feed.properties.map((property) => {
          const holding = holdingsByProject.get(property.listing.id);

          return (
            <article
              key={property.listing.id}
              className="overflow-hidden rounded-lg border border-terminal-border bg-terminal-card shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-terminal-border p-2">
                <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-md bg-terminal-bg">
                  {property.listing.imageUrl ? (
                    <Image
                      src={property.listing.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-terminal-text">{property.listing.title}</h2>
                  <p className="truncate text-[10px] text-terminal-muted">
                    {property.listing.location} · {property.listing.tokenSymbol}
                    {property.listing.apyPercent != null ? ` · ${property.listing.apyPercent}% APY` : ''}
                  </p>
                  <p className="text-[10px] font-mono text-terminal-primary">
                    {formatUsd(property.listing.pricePerTokenUsd)} ·{' '}
                    {sm.holdingAvailable.replace('{count}', String(holding?.availableToSell ?? 0))}
                  </p>
                </div>
              </div>

              <SecondaryMarketLedger
                buyLabel={sm.colBuy}
                sellLabel={sm.colSell}
                colPrice={sm.ledgerPrice}
                colQty={sm.ledgerQty}
                emptyBuy={sm.emptyBuy}
                emptySell={sm.emptySell}
                ownListingHint={sm.cancelListing}
                platformBuyback={property.platformBuyback}
                sellOrders={property.orders}
                formatUsd={formatUsd}
                formatQty={formatQty}
                onSelectBuy={() => goToPlatformBuyback(property, property.platformBuyback)}
                onSelectSell={(order) => handleSelectSell(property, order)}
              />
            </article>
          );
        })}
      </div>

      {feed.properties.length === 0 ? (
        <p className="mt-6 text-terminal-muted">{sm.empty}</p>
      ) : null}
    </div>
  );
}
