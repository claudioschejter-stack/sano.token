'use client';

import Link from 'next/link';
import { ChevronRight, MapPin, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale } from '../../i18n/LocaleProvider';
import type { MarketplaceListing } from '../../types/marketplace';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  listing: MarketplaceListing;
  compact?: boolean;
  variant?: 'default' | 'feed';
};

export function PwaPropertyCard({ listing, compact = false, variant = 'default' }: Props) {
  const { intlLocale } = useLocale();
  const { formatUsd, formatPercent } = useMemo(
    () => createIntlFormatters(intlLocale),
    [intlLocale]
  );

  const href = `/marketplace/${listing.id}/agregar`;

  if (variant === 'feed') {
    return (
      <Link
        href={href}
        className="block overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 transition active:bg-slate-50"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
          {listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.imageUrl} alt={listing.title} className="h-full w-full object-cover" />
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
              {formatPercent(listing.apyPercent / 100)} APY
            </span>
            <span className="text-xs text-slate-500">{listing.availableTokens} tokens</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Desde {formatUsd(listing.pricePerTokenUsd)} / token
          </p>
        </div>
      </Link>
    );
  }

  if (compact) {
    return (
      <Link
        href={href}
        className="relative min-w-[280px] snap-start overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
      >
        <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-slate-100">
          {listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.imageUrl} alt={listing.title} className="h-full w-full object-cover" />
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
            {formatPercent(listing.apyPercent / 100)} APY
          </span>
          <span className="text-xs text-slate-500">{listing.availableTokens} tokens</span>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Desde {formatUsd(listing.pricePerTokenUsd)} / token
        </p>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="flex gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition active:bg-slate-50"
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.imageUrl} alt={listing.title} className="h-full w-full object-cover" />
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
            {formatPercent(listing.apyPercent / 100)} APY
          </span>
          <span className="text-slate-500">{listing.availableTokens} disp.</span>
          <span className="text-slate-600">{formatUsd(listing.pricePerTokenUsd)}/tk</span>
        </div>
      </div>
      <ChevronRight size={20} className="shrink-0 self-center text-slate-300" />
    </Link>
  );
}
