'use client';

import Link from 'next/link';
import { ChevronRight, MapPin, ShoppingCart, TrendingUp } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { formatMessage } from '../../i18n';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { MarketplaceListing } from '../../types/marketplace';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  listing: MarketplaceListing;
  compact?: boolean;
  variant?: 'default' | 'feed';
  /** When set, card becomes a button (e.g. marketplace KYC gate). Otherwise navigates to add-to-cart. */
  onSelect?: (listing: MarketplaceListing) => void;
};

function TokenAvailability({
  available,
  total,
  intlLocale,
  labelTemplate
}: {
  available: number;
  total: number;
  intlLocale: string;
  labelTemplate: string;
}) {
  return (
    <span className="text-xs text-slate-500">
      {formatMessage(labelTemplate, {
        available: available.toLocaleString(intlLocale),
        total: total.toLocaleString(intlLocale)
      })}
    </span>
  );
}

export function PwaPropertyCard({ listing, compact = false, variant = 'default', onSelect }: Props) {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatPercent } = useMemo(
    () => createIntlFormatters(intlLocale),
    [intlLocale]
  );
  const formatTokenPrice = useMemo(
    () =>
      (value: number) =>
        new Intl.NumberFormat(intlLocale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value),
    [intlLocale]
  );

  const href = `/marketplace/${listing.id}/agregar`;
  const addLabel = t.marketplace.addToCart.addButton;
  const availabilityLabel = t.marketplace.tokensAvailableOfTotal;

  const wrapInteractive = (content: ReactNode, className: string) => {
    if (onSelect) {
      return (
        <button
          type="button"
          className={`${className} select-none text-left [-webkit-touch-callout:none]`}
          onClick={() => onSelect(listing)}
        >
          {content}
        </button>
      );
    }

    return (
      <Link
        href={href}
        className={`${className} select-none [-webkit-touch-callout:none]`}
        prefetch={false}
      >
        {content}
      </Link>
    );
  };

  if (variant === 'feed') {
    return wrapInteractive(
      <>
        <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
          {listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.imageUrl} alt={listing.title} className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">RWA</div>
          )}
        </div>
        <div className="p-4">
          <h4 className="line-clamp-1 text-base font-bold text-slate-900">{listing.title}</h4>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <MapPin size={12} />
            {listing.location}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
              <TrendingUp size={14} />
              {formatPercent(listing.apyPercent)} APY
            </span>
            <TokenAvailability
              available={listing.availableTokens}
              total={listing.totalTokens}
              intlLocale={intlLocale}
              labelTemplate={availabilityLabel}
            />
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {formatTokenPrice(listing.pricePerTokenUsd)} USDC/token
          </p>
          <div
            className="pointer-events-none mt-4 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: MP_ACCENT }}
            aria-hidden
          >
            <ShoppingCart size={16} />
            {addLabel}
          </div>
        </div>
      </>,
      'block w-full overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 transition active:bg-slate-50'
    );
  }

  if (compact) {
    return wrapInteractive(
      <>
        <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-slate-100">
          {listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.imageUrl} alt={listing.title} className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">RWA</div>
          )}
        </div>
        <h4 className="mt-3 line-clamp-1 text-base font-bold text-slate-900">{listing.title}</h4>
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <MapPin size={12} />
          {listing.location}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={{ color: MP_ACCENT }}>
            {formatPercent(listing.apyPercent)} APY
          </span>
          <TokenAvailability
            available={listing.availableTokens}
            total={listing.totalTokens}
            intlLocale={intlLocale}
            labelTemplate={availabilityLabel}
          />
        </div>
        <p className="mt-1 text-xs text-slate-600">
          {formatTokenPrice(listing.pricePerTokenUsd)} USDC/token
        </p>
      </>,
      'relative min-w-[280px] snap-start overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100'
    );
  }

  return wrapInteractive(
    <>
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.imageUrl} alt={listing.title} className="h-full w-full object-cover" draggable={false} />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-1 font-bold text-slate-900">{listing.title}</h4>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
          <MapPin size={12} />
          {listing.location}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
            <TrendingUp size={12} />
            {formatPercent(listing.apyPercent)} APY
          </span>
          <TokenAvailability
            available={listing.availableTokens}
            total={listing.totalTokens}
            intlLocale={intlLocale}
            labelTemplate={availabilityLabel}
          />
          <span className="text-slate-600">{formatTokenPrice(listing.pricePerTokenUsd)} USDC/tk</span>
        </div>
      </div>
      <ChevronRight size={20} className="shrink-0 self-center text-slate-300" />
    </>,
    'flex w-full gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition active:bg-slate-50'
  );
}
