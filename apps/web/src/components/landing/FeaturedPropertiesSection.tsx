'use client';

import Image from 'next/image';
import { formatMessage } from '../../i18n';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useMarketplaceFeed } from '../../hooks/useMarketplaceFeed';
import { pickFeaturedListings } from '../../lib/marketplace/pickFeaturedListings';
import type { MarketplaceFeed } from '../../types/marketplace';
import { MarketplaceCtaLink } from './MarketplaceCtaLink';

type FeaturedPropertiesSectionProps = {
  initialFeed: MarketplaceFeed;
};

export function FeaturedPropertiesSection({ initialFeed }: FeaturedPropertiesSectionProps) {
  const t = useTranslation();
  const l = t.landing;
  const { feed } = useMarketplaceFeed(initialFeed);
  const featuredListings = pickFeaturedListings(feed.listings);

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
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
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
              <div className="p-5">
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
                <MarketplaceCtaLink className="mt-5">{t.common.investNow}</MarketplaceCtaLink>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
