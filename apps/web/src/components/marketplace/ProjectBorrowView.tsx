'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { findListingById } from '../../lib/findListing';
import { fetchMarketplaceFeedClient } from '../../lib/marketplaceApi';
import type { BestBorrowRateResponse, MarketplaceListing } from '../../types/marketplace';
import { BorrowPanel } from './BorrowPanel';

type ProjectBorrowViewProps = {
  projectId: string;
};

export function ProjectBorrowView({ projectId }: ProjectBorrowViewProps) {
  const t = useTranslation();
  const pb = t.marketplace.projectBorrow;

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [borrowRate, setBorrowRate] = useState<BestBorrowRateResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchMarketplaceFeedClient(), fetch('/api/marketplace/feed', { cache: 'no-store' })])
      .then(async ([feed, response]) => {
        if (cancelled) {
          return;
        }

        setListing(findListingById(projectId, feed.listings) ?? null);

        if (response.ok) {
          const data = (await response.json()) as { borrowRate?: BestBorrowRateResponse | null };
          setBorrowRate(data.borrowRate ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setListing(findListingById(projectId, []) ?? null);
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-2 text-sm text-terminal-muted transition-colors hover:text-terminal-primary"
      >
        <ArrowLeft size={16} />
        {pb.backToMarketplace}
      </Link>

      <header className="border-b border-terminal-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-terminal-primary">{pb.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold text-terminal-text md:text-3xl">
          {listing?.title ?? pb.titleFallback}
        </h1>
        <p className="mt-3 text-sm text-terminal-muted">{pb.subtitle}</p>
      </header>

      {loading ? (
        <p className="text-sm text-terminal-muted">{pb.loading}</p>
      ) : !borrowRate ? (
        <p className="rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-4 py-3 text-sm text-terminal-warning">
          {pb.ratesUnavailable}
        </p>
      ) : (
        <BorrowPanel
          borrowRate={borrowRate}
          projectId={projectId}
          vaultAddress={listing?.vaultAddress}
          readyToBorrow={Boolean(listing?.readyToBorrow && listing?.vaultAddress)}
        />
      )}
    </div>
  );
}
