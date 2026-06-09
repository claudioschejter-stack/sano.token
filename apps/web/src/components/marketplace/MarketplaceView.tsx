'use client';

import Link from 'next/link';
import { Building2, ShoppingCart, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useMarketplaceFeed } from '../../hooks/useMarketplaceFeed';
import type { SystemRole } from '../../lib/auth/roles';
import { getMarketplaceCapabilities } from '../../lib/marketplace/marketplaceCapabilities';
import { LEGAL_CONTACT_PATH } from '../../lib/legal/legalConfig';
import { splitMarketplaceListings } from '../../lib/marketplace/splitMarketplaceListings';
import { useCartStore } from '../../store/useCartStore';
import type { MarketplaceFeed, MarketplaceListing } from '../../types/marketplace';
import type { SecondaryMarketHolding } from '../../types/secondaryMarket';
import { PropertyCard } from './PropertyCard';

type MarketplaceViewProps = {
  initialFeed: MarketplaceFeed;
};

function MarketplaceListingGrid({
  listings,
  kycStatus,
  role,
  holdingsByProject,
  capabilities,
  staffPreviewHint,
  onBuy,
  onAddToCart,
  onStartKyc
}: {
  listings: MarketplaceListing[];
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  role?: SystemRole;
  holdingsByProject: Map<string, SecondaryMarketHolding>;
  capabilities: ReturnType<typeof getMarketplaceCapabilities>;
  staffPreviewHint?: string;
  onBuy: (listing: MarketplaceListing) => void;
  onAddToCart: (listing: MarketplaceListing) => void;
  onStartKyc: (listing: MarketplaceListing) => void;
}) {
  if (listings.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <PropertyCard
          key={listing.id}
          className="h-full"
          id={listing.id}
          title={listing.title}
          description={listing.description}
          location={listing.location}
          imageUrl={listing.imageUrl}
          mapEmbedUrl={listing.mapEmbedUrl}
          apyPercent={listing.apyPercent}
          pricePerTokenUsd={listing.pricePerTokenUsd}
          availableTokens={listing.availableTokens}
          totalTokens={listing.totalTokens}
          soldPercent={listing.soldPercent}
          tokenInstrumentType={listing.tokenInstrumentType}
          maturityDate={listing.maturityDate}
          equitySharePercent={listing.equitySharePercent}
          tokenSymbol={listing.tokenSymbol}
          mediaGallery={listing.mediaGallery}
          contracts={listing.contracts}
          kycStatus={kycStatus}
          role={role}
          investorHolding={holdingsByProject.get(listing.id) ?? null}
          readyToBorrow={listing.readyToBorrow}
          purchaseEnabled={capabilities.showPurchaseActions}
          staffPreviewHint={staffPreviewHint}
          onBuy={() => onBuy(listing)}
          onAddToCart={() => onAddToCart(listing)}
          onStartKyc={() => onStartKyc(listing)}
        />
      ))}
    </div>
  );
}

export function MarketplaceView({ initialFeed }: MarketplaceViewProps) {
  const router = useRouter();
  const t = useTranslation();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const capabilities = getMarketplaceCapabilities(role);
  const { checklist } = useAccountStatus();
  const kycStatus = capabilities.useInvestorKycStatus
    ? checklist?.operational
      ? 'APPROVED'
      : checklist?.kycStatus ?? 'PENDING'
    : 'APPROVED';
  const { feed, isRefreshing } = useMarketplaceFeed(initialFeed);
  const [holdings, setHoldings] = useState<SecondaryMarketHolding[]>([]);
  const addItem = useCartStore((state) => state.addItem);
  const cartItemCount = useCartStore((state) => state.itemCount());
  const cc = t.cartCheckout;

  const holdingsByProject = useMemo(
    () => new Map(holdings.map((row) => [row.projectId, row])),
    [holdings]
  );

  useEffect(() => {
    if (role !== 'INVESTOR' || !checklist?.operational) {
      setHoldings([]);
      return;
    }

    void fetch('/api/secondary-market/holdings', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { holdings?: SecondaryMarketHolding[] } | null) => {
        setHoldings(data?.holdings ?? []);
      })
      .catch(() => setHoldings([]));
  }, [checklist?.operational, role]);

  const { listings, usedFallback } = feed;
  const { available, sold } = useMemo(() => splitMarketplaceListings(listings), [listings]);
  const roleLabels = t.access.roles as Record<SystemRole, string>;
  const staffPreviewHint = capabilities.showPurchaseActions ? undefined : t.marketplace.staffPreviewHint;

  const handleBuy = (listing: MarketplaceListing) => {
    if (!session?.user) {
      router.push(`/acceso?returnTo=${encodeURIComponent(`/marketplace/${listing.id}/checkout`)}`);
      return;
    }
    router.push(`/marketplace/${listing.id}/checkout`);
  };

  const handleAddToCart = (listing: MarketplaceListing) => {
    if (!session?.user) {
      router.push(`/acceso?returnTo=${encodeURIComponent('/marketplace/carrito')}`);
      return;
    }
    addItem({
      projectId: listing.id,
      title: listing.title,
      location: listing.location,
      imageUrl: listing.imageUrl,
      pricePerTokenUsd: listing.pricePerTokenUsd,
      availableTokens: listing.availableTokens,
      tokenSymbol: listing.tokenSymbol
    });
  };

  const handleStartKyc = (listing: MarketplaceListing) => {
    router.push(`/kyc?returnTo=/marketplace/${listing.id}/checkout`);
  };

  const gridProps = {
    kycStatus,
    role,
    holdingsByProject,
    capabilities,
    staffPreviewHint,
    onBuy: handleBuy,
    onAddToCart: handleAddToCart,
    onStartKyc: handleStartKyc
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-6 w-full">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-terminal-text md:text-3xl">{t.marketplace.title}</h1>
          {role ? (
            <span className="rounded-full border border-terminal-primary/30 bg-terminal-bg px-2.5 py-1 text-xs font-semibold text-terminal-primary">
              {roleLabels[role]}
            </span>
          ) : null}
          {session?.user && cartItemCount > 0 ? (
            <Link
              href="/marketplace/carrito"
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-3 py-1.5 text-xs font-semibold text-terminal-primary hover:bg-terminal-primary/20"
            >
              <ShoppingCart size={14} />
              {cc.viewCart} ({cartItemCount})
            </Link>
          ) : null}
        </div>
        <p className="mt-2 text-base text-terminal-muted md:text-lg">{t.marketplace.subtitle}</p>
      </header>

      {capabilities.showAdminToolbar ? (
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/assets"
            className="inline-flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-4 py-2.5 text-sm font-semibold text-terminal-text transition-colors hover:border-terminal-primary/40 hover:text-terminal-primary"
          >
            <Building2 size={16} />
            {t.marketplace.adminManageAssets}
          </Link>
          <Link
            href="/dashboard/treasury"
            className="inline-flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-4 py-2.5 text-sm font-semibold text-terminal-text transition-colors hover:border-terminal-primary/40 hover:text-terminal-primary"
          >
            <Wallet size={16} />
            {t.marketplace.adminManageTreasury}
          </Link>
        </div>
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
        <p className="mt-6 text-terminal-muted">{t.marketplace.empty}</p>
      ) : (
        <div className="space-y-12">
          <section>
            <div className="mb-6 flex flex-col gap-4 border-b border-terminal-border pb-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold uppercase tracking-wide text-terminal-text md:text-xl">
                  {t.marketplace.availableSectionTitle}
                </h2>
                <p className="mt-1 text-sm text-terminal-muted">{t.marketplace.availableSectionSubtitle}</p>
              </div>
              <Link
                href={LEGAL_CONTACT_PATH}
                className="marketplace-publish-cta inline-flex max-w-xl shrink-0 items-center justify-center rounded-lg border-2 border-terminal-primary bg-terminal-primary/10 px-4 py-3 text-center text-xs font-bold uppercase leading-snug tracking-wide text-terminal-primary transition-colors hover:border-blue-400 hover:bg-terminal-primary/20 md:text-sm"
              >
                {t.marketplace.publishPropertyCta}
              </Link>
            </div>
            {available.length > 0 ? (
              <MarketplaceListingGrid listings={available} {...gridProps} />
            ) : (
              <p
                role="status"
                className="inline-block rounded-md border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500"
              >
                {t.marketplace.availableSectionEmpty}
              </p>
            )}
          </section>

          <section>
            <div className="mb-6 border-b border-terminal-border pb-4">
              <h2 className="text-lg font-bold uppercase tracking-wide text-terminal-text md:text-xl">
                {t.marketplace.soldSectionTitle}
              </h2>
              <p className="mt-1 text-sm text-terminal-muted">{t.marketplace.soldSectionSubtitle}</p>
            </div>
            {sold.length > 0 ? (
              <MarketplaceListingGrid listings={sold} {...gridProps} />
            ) : (
              <p className="text-sm text-terminal-muted">{t.marketplace.soldSectionEmpty}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
