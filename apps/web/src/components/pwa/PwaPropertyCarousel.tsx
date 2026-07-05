'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { fetchMarketplaceFeedClient } from '../../lib/marketplaceApi';
import { splitMarketplaceListings } from '../../lib/marketplace/splitMarketplaceListings';
import type { MarketplaceListing } from '../../types/marketplace';
import { PwaPropertyCard } from './PwaPropertyCard';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  title?: string;
  limit?: number;
  compact?: boolean;
  showViewAll?: boolean;
  layout?: 'horizontal' | 'list' | 'feed';
};

export function PwaPropertyCarousel({
  title = 'Propiedades disponibles',
  limit = 6,
  compact = true,
  showViewAll = true,
  layout
}: Props) {
  const resolvedLayout = layout ?? (compact ? 'horizontal' : 'list');
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetchMarketplaceFeedClient()
      .then((feed) => {
        if (cancelled) return;
        const { available } = splitMarketplaceListings(feed.listings);
        setListings(available.slice(0, limit));
      })
      .catch(() => {
        if (!cancelled) setListings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-3 px-4">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 min-w-[280px] animate-pulse rounded-3xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="px-4">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-3 rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          No hay propiedades disponibles en este momento.
        </p>
      </div>
    );
  }

  if (resolvedLayout === 'horizontal') {
    return (
      <div>
        <div className="flex items-center justify-between px-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          {showViewAll ? (
            <Link href="/marketplace" className="text-sm font-medium" style={{ color: MP_ACCENT }}>
              Ver todas <ChevronRight size={14} className="inline" />
            </Link>
          ) : null}
        </div>
        <div className="hide-scrollbar mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
          {listings.map((listing) => (
            <PwaPropertyCard key={listing.id} listing={listing} compact />
          ))}
        </div>
      </div>
    );
  }

  if (resolvedLayout === 'feed') {
    return (
      <div className="space-y-3 px-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          {showViewAll ? (
            <Link href="/marketplace" className="text-sm font-medium" style={{ color: MP_ACCENT }}>
              Ver todas <ChevronRight size={14} className="inline" />
            </Link>
          ) : null}
        </div>
        <div className="space-y-4">
          {listings.map((listing) => (
            <PwaPropertyCard key={listing.id} listing={listing} variant="feed" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {showViewAll ? (
          <Link href="/marketplace" className="text-sm font-medium" style={{ color: MP_ACCENT }}>
            Ver todas
          </Link>
        ) : null}
      </div>
      {listings.map((listing) => (
        <PwaPropertyCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
