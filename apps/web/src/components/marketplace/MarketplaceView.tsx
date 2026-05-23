'use client';

import { useRouter } from 'next/navigation';
import { Percent } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useMarketplaceFeed } from '../../hooks/useMarketplaceFeed';
import type { MarketplaceFeed } from '../../types/marketplace';
import { PropertyCard } from './PropertyCard';
import { TrustStrip } from './TrustStrip';

type MarketplaceViewProps = {
  initialFeed: MarketplaceFeed;
};

export function MarketplaceView({ initialFeed }: MarketplaceViewProps) {
  const router = useRouter();
  const t = useTranslation();
  const { checklist } = useAccountStatus();
  const kycStatus = checklist?.operational
    ? 'APPROVED'
    : checklist?.kycStatus ?? 'PENDING';
  const { feed, isRefreshing } = useMarketplaceFeed(initialFeed);

  const { listings, borrowRate, usedFallback } = feed;
  const bestApyPercent = borrowRate ? (borrowRate.best.borrowApyBps / 100).toFixed(2) : null;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-6 w-full">
        <p className="text-xs font-medium uppercase tracking-wider text-terminal-primary md:text-sm">
          {t.marketplace.brandLabel}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-terminal-text md:text-3xl">{t.marketplace.title}</h1>
        <p className="mt-2 max-w-2xl text-base text-terminal-muted md:text-lg">{t.marketplace.subtitle}</p>
      </header>

      <TrustStrip />

      {bestApyPercent ? (
        <section className="mb-8 flex items-start gap-3 rounded-xl border border-terminal-primary/30 bg-terminal-card p-4">
          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-2 text-terminal-primary">
            <Percent size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-terminal-text">{t.marketplace.bestBorrowRate}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-terminal-success">{bestApyPercent}% APY</p>
            <p className="mt-1 text-xs text-terminal-muted">
              {borrowRate?.best.protocol.toUpperCase()} · {t.marketplace.lendingBanner}
            </p>
          </div>
        </section>
      ) : null}

      {usedFallback ? (
        <p className="mb-6 rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-4 py-3 text-sm text-terminal-warning">
          {t.marketplace.error}
        </p>
      ) : null}

      {isRefreshing ? (
        <p className="mb-4 text-xs text-terminal-muted">{t.marketplace.syncing}</p>
      ) : null}

      {listings.length === 0 ? (
        <p className="text-terminal-muted">{t.marketplace.empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <PropertyCard
              key={listing.id}
              id={listing.id}
              title={listing.title}
              location={listing.location}
              imageUrl={listing.imageUrl}
              mapEmbedUrl={listing.mapEmbedUrl}
              apyPercent={listing.apyPercent}
              pricePerTokenUsd={listing.pricePerTokenUsd}
              availableTokens={listing.availableTokens}
              totalTokens={listing.totalTokens}
              soldPercent={listing.soldPercent}
              jurisdiction={listing.jurisdiction}
              fiscalRegime={listing.fiscalRegime}
              tokenInstrumentType={listing.tokenInstrumentType}
              maturityDate={listing.maturityDate}
              equitySharePercent={listing.equitySharePercent}
              tokenSymbol={listing.tokenSymbol}
              mediaGallery={listing.mediaGallery}
              contracts={listing.contracts}
              kycStatus={kycStatus}
              onBuy={() => router.push(`/marketplace/${listing.id}/checkout`)}
              onStartKyc={() => router.push(`/kyc?returnTo=/marketplace/${listing.id}/checkout`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
