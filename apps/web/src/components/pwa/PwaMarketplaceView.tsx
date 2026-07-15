'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useMarketplaceFeed } from '../../hooks/useMarketplaceFeed';
import { isMarketplaceTradingRole } from '../../lib/auth/roles';
import { getMarketplaceCapabilities } from '../../lib/marketplace/marketplaceCapabilities';
import { splitMarketplaceListings } from '../../lib/marketplace/splitMarketplaceListings';
import type { MarketplaceFeed, MarketplaceListing } from '../../types/marketplace';
import type { SecondaryMarketHolding } from '../../types/secondaryMarket';
import { PwaAdCarousel } from './PwaAdCarousel';
import { MarketplaceCartButton } from '../marketplace/MarketplaceCartButton';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  initialFeed: MarketplaceFeed;
};

export function PwaMarketplaceView({ initialFeed }: Props) {
  const router = useRouter();
  const t = useTranslation();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const capabilities = getMarketplaceCapabilities(role);
  const { checklist } = useAccountStatus();
  const { feed, isRefreshing } = useMarketplaceFeed(initialFeed);
  const [holdings, setHoldings] = useState<SecondaryMarketHolding[]>([]);

  const kycStatus = capabilities.useInvestorKycStatus
    ? checklist?.kycApproved
      ? 'APPROVED'
      : checklist?.kycStatus ?? 'PENDING'
    : 'APPROVED';

  useEffect(() => {
    if (!isMarketplaceTradingRole(role) || !checklist?.operational) {
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

  const { available, sold } = useMemo(
    () => splitMarketplaceListings(feed.listings),
    [feed.listings]
  );

  const handleOpen = (listing: MarketplaceListing) => {
    if (!session?.user) {
      router.push(`/acceso?returnTo=${encodeURIComponent(`/marketplace/${listing.id}/agregar`)}`);
      return;
    }
    if (isMarketplaceTradingRole(role) && !checklist?.operational) {
      router.push(`/kyc?returnTo=${encodeURIComponent(`/marketplace/${listing.id}/agregar`)}`);
      return;
    }
    if (kycStatus !== 'APPROVED' && capabilities.useInvestorKycStatus) {
      router.push(`/kyc?returnTo=${encodeURIComponent(`/marketplace/${listing.id}/agregar`)}`);
      return;
    }
    router.push(`/marketplace/${listing.id}/agregar`);
  };

  return (
    <div className="-mx-4 space-y-6 pb-2 font-sans">
      <div className="flex items-center justify-between px-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.marketplace.title}</h1>
          <p className="mt-1 text-sm text-slate-500">Rendimientos y tokens disponibles</p>
        </div>
        <MarketplaceCartButton />
      </div>

      {isRefreshing ? <p className="px-4 text-xs text-slate-400">{t.marketplace.syncing}</p> : null}

      <section className="space-y-3">
        <div className="px-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t.marketplace.availableSectionTitle}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">{t.marketplace.availableSectionSubtitle}</p>
        </div>
        {available.length > 0 ? (
          <PwaAdCarousel listings={available} onSelect={handleOpen} />
        ) : (
          <p className="mx-4 rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            {t.marketplace.availableSectionEmpty}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="px-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t.marketplace.soldSectionTitle}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">{t.marketplace.soldSectionSubtitle}</p>
        </div>
        {sold.length > 0 ? (
          <PwaAdCarousel listings={sold} disabled soldBadgeLabel={t.marketplace.soldBadge} />
        ) : (
          <p className="mx-4 rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            {t.marketplace.soldSectionEmpty}
          </p>
        )}
      </section>

      {holdings.length > 0 ? (
        <section className="space-y-3 px-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Tus tokens</h2>
          {holdings.map((holding) => {
            const listing = feed.listings.find((l) => l.id === holding.projectId);
            return (
              <div
                key={holding.projectId}
                className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-100"
              >
                <p className="font-semibold text-slate-900">{listing?.title ?? holding.projectId}</p>
                <p className="mt-1 text-slate-600">{holding.ownedTokens} tokens en cartera</p>
              </div>
            );
          })}
        </section>
      ) : null}

      <p className="px-4 text-center text-xs text-slate-400">
        Datos en vivo ·{' '}
        <span style={{ color: MP_ACCENT }}>{feed.dataSource === 'live' ? 'conectado' : feed.dataSource}</span>
      </p>
    </div>
  );
}
