'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ShieldAlert } from 'lucide-react';
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
import { SecondaryMarketLedger } from '../secondaryMarket/SecondaryMarketLedger';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  initialFeed: SecondaryMarketFeed;
};

export function PwaSecondaryMarketView({ initialFeed }: Props) {
  const router = useRouter();
  const t = useTranslation();
  const sm = t.secondaryMarket;
  const legal = t.legal;
  const searchParams = useSearchParams();
  const sellProjectFromQuery = searchParams.get('sell');
  const { intlLocale } = useLocale();
  const { formatUsd } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const { checklist, loading: accountLoading } = useAccountStatus();
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
    <div className="-mx-4 space-y-4 pb-2 font-sans">
      <header className="px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">{sm.title}</h1>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ color: MP_ACCENT, backgroundColor: `${MP_ACCENT}14` }}
          >
            <ArrowLeftRight size={12} />
            {legal.secondaryInternalBadge}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{sm.subtitle}</p>
        <p className="mt-1 text-sm text-slate-500">{sm.subtitleBuyback}</p>
      </header>

      {!accountLoading && !kycApproved ? (
        <div className="mx-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <p>{sm.kycRequired}</p>
            <Link
              href="/kyc?returnTo=/mercado-secundario"
              className="mt-2 inline-flex font-semibold underline"
              style={{ color: MP_ACCENT }}
            >
              {sm.completeKyc}
            </Link>
          </div>
        </div>
      ) : null}

      {actionMessage ? (
        <p className="mx-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {actionMessage}
        </p>
      ) : null}

      {loading ? <p className="px-4 text-xs text-slate-400">{sm.syncing}</p> : null}

      <div className="space-y-3 px-4">
        {feed.properties.map((property) => {
          const holding = holdingsByProject.get(property.listing.id);

          return (
            <article
              key={property.listing.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 p-3">
                <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
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
                  <h2 className="truncate text-sm font-semibold text-slate-900">{property.listing.title}</h2>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="truncate text-[11px] text-slate-500">{property.listing.location}</span>
                    {property.listing.tokenSymbol ? (
                      <>
                        <span className="text-[11px] text-slate-400" aria-hidden>
                          ·
                        </span>
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
                          style={{ color: MP_ACCENT, backgroundColor: `${MP_ACCENT}14` }}
                        >
                          {property.listing.tokenSymbol}
                        </span>
                      </>
                    ) : null}
                    {property.listing.apyPercent != null ? (
                      <>
                        <span className="text-[11px] text-slate-400" aria-hidden>
                          ·
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-600">
                          {property.listing.apyPercent}% APY
                        </span>
                      </>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] font-medium" style={{ color: MP_ACCENT }}>
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
        <p className="px-4 text-sm text-slate-500">{sm.empty}</p>
      ) : null}
    </div>
  );
}
