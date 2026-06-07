'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useMarketplaceFeed } from '../../hooks/useMarketplaceFeed';
import { getMarketplaceCapabilities } from '../../lib/marketplace/marketplaceCapabilities';
import { pickFeaturedListings } from '../../lib/marketplace/pickFeaturedListings';
import type { MarketplaceFeed } from '../../types/marketplace';
import type { SecondaryMarketHolding } from '../../types/secondaryMarket';
import { BrandGradientText } from '../brand/BrandGradientText';
import { PropertyCard } from '../marketplace/PropertyCard';
import { MarketplaceCtaLink } from './MarketplaceCtaLink';

type FeaturedPropertiesSectionProps = {
  initialFeed: MarketplaceFeed;
};

export function FeaturedPropertiesSection({ initialFeed }: FeaturedPropertiesSectionProps) {
  const router = useRouter();
  const t = useTranslation();
  const l = t.landing;
  const { data: session } = useSession();
  const role = session?.user?.role;
  const capabilities = getMarketplaceCapabilities(role);
  const { checklist } = useAccountStatus();
  const { feed } = useMarketplaceFeed(initialFeed);
  const featuredListings = pickFeaturedListings(feed.listings);
  const hideFinancialMetrics = !session?.user;
  const [holdings, setHoldings] = useState<SecondaryMarketHolding[]>([]);

  const kycStatus = capabilities.useInvestorKycStatus
    ? checklist?.operational
      ? 'APPROVED'
      : checklist?.kycStatus ?? 'PENDING'
    : 'APPROVED';

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

  return (
    <section id="properties" className="overflow-x-hidden bg-slate-50 py-16 md:py-20">
      <div className="mx-auto w-full max-w-7xl overflow-hidden px-4 sm:px-6 md:px-6">
        <div className="flex w-full max-w-full flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="w-full">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
              <BrandGradientText>{l.featured.title}</BrandGradientText>
            </h2>
            <p className="mt-2 text-base text-slate-600 md:text-lg">
              <BrandGradientText>{l.featured.subtitle}</BrandGradientText>
            </p>
          </div>
          <MarketplaceCtaLink className="w-full sm:w-auto md:shrink-0">{l.featured.viewAll}</MarketplaceCtaLink>
        </div>

        <div className="mt-8 grid w-full max-w-full grid-cols-1 items-stretch gap-10 overflow-hidden md:mt-10 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {featuredListings.map((listing) => (
            <PropertyCard
              key={listing.id}
              className="h-full transition hover:-translate-y-1"
              variant="light"
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
              hideFinancialMetrics={hideFinancialMetrics}
              staffPreviewHint={
                capabilities.showPurchaseActions ? undefined : t.marketplace.staffPreviewHint
              }
              onBuy={() => {
                if (!session?.user) {
                  router.push(
                    `/acceso?returnTo=${encodeURIComponent(`/marketplace/${listing.id}/checkout`)}`
                  );
                  return;
                }
                router.push(`/marketplace/${listing.id}/checkout`);
              }}
              onStartKyc={() =>
                router.push(`/kyc?returnTo=${encodeURIComponent(`/marketplace/${listing.id}/checkout`)}`)
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
