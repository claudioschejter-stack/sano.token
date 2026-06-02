'use client';

import Link from 'next/link';
import { Building2, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useMarketplaceFeed } from '../../hooks/useMarketplaceFeed';
import type { SystemRole } from '../../lib/auth/roles';
import { getMarketplaceCapabilities } from '../../lib/marketplace/marketplaceCapabilities';
import type { MarketplaceFeed } from '../../types/marketplace';
import type { SecondaryMarketHolding } from '../../types/secondaryMarket';
import { LegalDisclaimerBanner } from '../legal/LegalDisclaimerBanner';
import { PropertyCard } from './PropertyCard';

type MarketplaceViewProps = {
  initialFeed: MarketplaceFeed;
};

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
  const roleLabels = t.access.roles as Record<SystemRole, string>;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-6 w-full">
        <p className="text-xs font-medium uppercase tracking-wider text-terminal-primary md:text-sm">
          {t.marketplace.brandLabel}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-terminal-text md:text-3xl">{t.marketplace.title}</h1>
          {role ? (
            <span className="rounded-full border border-terminal-primary/30 bg-terminal-bg px-2.5 py-1 text-xs font-semibold text-terminal-primary">
              {roleLabels[role]}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-base text-terminal-muted md:text-lg whitespace-nowrap">{t.marketplace.subtitle}</p>
      </header>

      <LegalDisclaimerBanner className="mb-6" compact />

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
        <p className="mb-6 mt-6 rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-4 py-3 text-sm text-terminal-warning">
          {t.marketplace.error}
        </p>
      ) : null}

      {isRefreshing ? (
        <p className="mb-4 mt-6 text-xs text-terminal-muted">{t.marketplace.syncing}</p>
      ) : null}

      {listings.length === 0 ? (
        <p className="mt-6 text-terminal-muted">{t.marketplace.empty}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
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
              staffPreviewHint={capabilities.showPurchaseActions ? undefined : t.marketplace.staffPreviewHint}
              onBuy={() => {
                if (!session?.user) {
                  router.push(
                    `/acceso?returnTo=${encodeURIComponent(`/marketplace/${listing.id}/checkout`)}`
                  );
                  return;
                }
                router.push(`/marketplace/${listing.id}/checkout`);
              }}
              onStartKyc={() => router.push(`/kyc?returnTo=/marketplace/${listing.id}/checkout`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
