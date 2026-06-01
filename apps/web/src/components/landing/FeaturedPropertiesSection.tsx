'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { formatMessage } from '../../i18n';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useMarketplaceFeed } from '../../hooks/useMarketplaceFeed';
import { getMarketplaceCapabilities } from '../../lib/marketplace/marketplaceCapabilities';
import { pickFeaturedListings } from '../../lib/marketplace/pickFeaturedListings';
import type { MarketplaceFeed } from '../../types/marketplace';
import type { SecondaryMarketHolding } from '../../types/secondaryMarket';
import { PropertyCardActions } from '../marketplace/PropertyCardActions';
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
    <section id="properties" className="bg-slate-50 py-16 md:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="flex w-full flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="w-full">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">{l.featured.title}</h2>
            <p className="mt-2 text-base text-slate-600 md:text-lg">{l.featured.subtitle}</p>
          </div>
          <MarketplaceCtaLink className="md:shrink-0">{l.featured.viewAll}</MarketplaceCtaLink>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:mt-10 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {featuredListings.map((listing) => (
            <article
              key={listing.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative h-48 overflow-hidden sm:h-52">
                <Image
                  src={listing.imageUrl}
                  alt={listing.title}
                  width={600}
                  height={400}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
                  {formatMessage(l.featured.apyBadge, { apy: listing.apyPercent })}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold text-slate-900">{listing.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{listing.location}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    ${Math.round(listing.pricePerTokenUsd)} / {t.propertyCard.perToken}
                  </span>
                  <span className="font-medium text-slate-900">
                    {formatMessage(l.featured.soldPercent, { percent: listing.soldPercent })}
                  </span>
                </div>
                <div className="mt-5">
                  <PropertyCardActions
                    projectId={listing.id}
                    availableTokens={listing.availableTokens}
                    kycStatus={kycStatus}
                    role={role}
                    investorHolding={holdingsByProject.get(listing.id) ?? null}
                    readyToBorrow={listing.readyToBorrow}
                    purchaseEnabled={capabilities.showPurchaseActions}
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
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
