'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { getMarketplaceCapabilities } from '../../lib/marketplace/marketplaceCapabilities';
import { PropertyCard } from '../marketplace/PropertyCard';
import type {
  SecondaryMarketFeed,
  SecondaryMarketHolding,
  SecondaryMarketProperty
} from '../../types/secondaryMarket';

type SecondaryMarketViewProps = {
  initialFeed: SecondaryMarketFeed;
};

export function SecondaryMarketView({ initialFeed }: SecondaryMarketViewProps) {
  const router = useRouter();
  const t = useTranslation();
  const sm = t.secondaryMarket;
  const legal = t.legal;
  const searchParams = useSearchParams();
  const sellProjectFromQuery = searchParams.get('sell');
  const { data: session } = useSession();
  const role = session?.user?.role;
  const capabilities = getMarketplaceCapabilities(role);
  const { checklist } = useAccountStatus();
  const kycApproved = checklist?.kycApproved ?? false;
  const kycStatus = capabilities.useInvestorKycStatus
    ? checklist?.operational
      ? 'APPROVED'
      : checklist?.kycStatus ?? 'PENDING'
    : 'APPROVED';

  const [feed, setFeed] = useState(initialFeed);
  const [holdings, setHoldings] = useState<SecondaryMarketHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [sellProjectId, setSellProjectId] = useState<string | null>(null);
  const [sellForm, setSellForm] = useState({ tokenCount: '1', pricePerTokenUsd: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const holdingsByProject = useMemo(() => {
    return new Map(holdings.map((row) => [row.projectId, row]));
  }, [holdings]);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const [feedResponse, holdingsResponse] = await Promise.all([
        fetch('/api/secondary-market/feed', { cache: 'no-store' }),
        kycApproved
          ? fetch('/api/secondary-market/holdings', { cache: 'no-store' })
          : Promise.resolve(null)
      ]);

      if (feedResponse.ok) {
        setFeed((await feedResponse.json()) as SecondaryMarketFeed);
      }

      if (holdingsResponse?.ok) {
        const data = (await holdingsResponse.json()) as { holdings: SecondaryMarketHolding[] };
        setHoldings(data.holdings);
      }
    } finally {
      setLoading(false);
    }
  }, [kycApproved]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!sellProjectFromQuery || !kycApproved || loading) {
      return;
    }

    const property = feed.properties.find((row) => row.listing.id === sellProjectFromQuery);
    if (!property) {
      return;
    }

    const holding = holdingsByProject.get(property.listing.id);
    if ((holding?.availableToSell ?? 0) <= 0) {
      return;
    }

    setSellProjectId(property.listing.id);
    setSellForm({
      tokenCount: '1',
      pricePerTokenUsd: String(property.listing.pricePerTokenUsd)
    });
  }, [feed.properties, holdingsByProject, kycApproved, loading, sellProjectFromQuery]);

  async function handleBuy(orderId: string) {
    if (!kycApproved) {
      return;
    }

    if (!window.confirm(sm.confirmBuy)) {
      return;
    }

    setActionLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/secondary-market/listings/${orderId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('buy failed');
      }

      setActionMessage(sm.buySuccess);
      await refresh();
    } catch {
      setActionMessage(sm.buyError);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel(orderId: string) {
    setActionLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/secondary-market/listings/${orderId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('cancel failed');
      }

      setActionMessage(sm.cancelSuccess);
      await refresh();
    } catch {
      setActionMessage(sm.cancelError);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSellSubmit(event: React.FormEvent<HTMLFormElement>, property: SecondaryMarketProperty) {
    event.preventDefault();

    if (!kycApproved) {
      return;
    }

    setActionLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch('/api/secondary-market/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: property.listing.id,
          tokenCount: Number(sellForm.tokenCount),
          pricePerTokenUsd: Number(sellForm.pricePerTokenUsd)
        })
      });

      if (!response.ok) {
        throw new Error('sell failed');
      }

      setSellProjectId(null);
      setSellForm({ tokenCount: '1', pricePerTokenUsd: '' });
      setActionMessage(sm.sellSuccess);
      await refresh();
    } catch {
      setActionMessage(sm.sellError);
    } finally {
      setActionLoading(false);
    }
  }

  function openSellForm(property: SecondaryMarketProperty) {
    setSellProjectId(property.listing.id);
    setSellForm({
      tokenCount: '1',
      pricePerTokenUsd: String(property.listing.pricePerTokenUsd)
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-terminal-primary md:text-sm">
          {sm.brandLabel}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-terminal-text md:text-3xl">{sm.title}</h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-terminal-primary/30 bg-terminal-bg px-2.5 py-1 text-xs font-semibold text-terminal-primary">
            <ArrowLeftRight size={14} />
            {legal.secondaryInternalBadge}
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-base text-terminal-muted md:text-lg">{sm.subtitle}</p>
      </header>

      {!kycApproved ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-4 py-3 text-sm text-terminal-warning">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <p>{sm.kycRequired}</p>
            <Link href="/kyc?returnTo=/mercado-secundario" className="mt-2 inline-flex font-semibold underline">
              {sm.completeKyc}
            </Link>
          </div>
        </div>
      ) : null}

      {actionMessage ? (
        <p className="mb-4 rounded-lg border border-terminal-border bg-terminal-card px-4 py-3 text-sm text-terminal-text">
          {actionMessage}
        </p>
      ) : null}

      {loading ? <p className="mb-4 text-xs text-terminal-muted">{sm.syncing}</p> : null}

      <div className="grid grid-cols-1 gap-8">
        {feed.properties.map((property) => {
          const holding = holdingsByProject.get(property.listing.id);
          const canSell = kycApproved && (holding?.availableToSell ?? 0) > 0;
          const isSelling = sellProjectId === property.listing.id;

          return (
            <section
              key={property.listing.id}
              className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card"
            >
              <PropertyCard
                className="h-full rounded-none border-0 shadow-none hover:shadow-none"
                id={property.listing.id}
                title={property.listing.title}
                description={property.listing.description}
                location={property.listing.location}
                imageUrl={property.listing.imageUrl}
                mapEmbedUrl={property.listing.mapEmbedUrl}
                apyPercent={property.listing.apyPercent}
                pricePerTokenUsd={property.listing.pricePerTokenUsd}
                availableTokens={property.listing.availableTokens}
                totalTokens={property.listing.totalTokens}
                soldPercent={property.listing.soldPercent}
                tokenInstrumentType={property.listing.tokenInstrumentType}
                maturityDate={property.listing.maturityDate}
                equitySharePercent={property.listing.equitySharePercent}
                tokenSymbol={property.listing.tokenSymbol}
                mediaGallery={property.listing.mediaGallery}
                contracts={property.listing.contracts}
                kycStatus={kycStatus}
                role={role}
                investorHolding={holding ?? null}
                readyToBorrow={property.listing.readyToBorrow}
                purchaseEnabled={capabilities.showPurchaseActions}
                staffPreviewHint={
                  capabilities.showPurchaseActions ? undefined : t.marketplace.staffPreviewHint
                }
                onBuy={() => {
                  if (!session?.user) {
                    router.push(
                      `/acceso?returnTo=${encodeURIComponent(`/marketplace/${property.listing.id}/checkout`)}`
                    );
                    return;
                  }
                  router.push(`/marketplace/${property.listing.id}/checkout`);
                }}
                onStartKyc={() =>
                  router.push(
                    `/kyc?returnTo=${encodeURIComponent(`/marketplace/${property.listing.id}/checkout`)}`
                  )
                }
              />

              <div className="space-y-4 border-t border-terminal-border p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-terminal-text">{sm.ordersTitle}</p>
                    <p className="text-xs text-terminal-muted">
                      {property.totalTokensForSale > 0
                        ? sm.ordersSummary
                            .replace('{count}', String(property.totalTokensForSale))
                            .replace(
                              '{price}',
                              property.lowestAskUsd != null ? String(property.lowestAskUsd) : '—'
                            )
                        : sm.noOrders}
                    </p>
                  </div>
                </div>

                {isSelling ? (
                  <form
                    className="grid gap-3 rounded-lg border border-terminal-border bg-terminal-bg p-4 md:grid-cols-3"
                    onSubmit={(event) => void handleSellSubmit(event, property)}
                  >
                    <label className="space-y-1 text-sm">
                      <span className="text-terminal-muted">{sm.sellQuantity}</span>
                      <input
                        type="number"
                        min={1}
                        max={holding?.availableToSell ?? 1}
                        required
                        value={sellForm.tokenCount}
                        onChange={(event) =>
                          setSellForm((current) => ({ ...current, tokenCount: event.target.value }))
                        }
                        className="w-full rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-terminal-text"
                      />
                      <span className="text-xs text-terminal-muted">
                        {sm.availableToSell.replace('{count}', String(holding?.availableToSell ?? 0))}
                      </span>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="text-terminal-muted">{sm.sellPrice}</span>
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        required
                        value={sellForm.pricePerTokenUsd}
                        onChange={(event) =>
                          setSellForm((current) => ({
                            ...current,
                            pricePerTokenUsd: event.target.value
                          }))
                        }
                        className="w-full rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-terminal-text"
                      />
                    </label>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {actionLoading ? sm.publishing : sm.publishListing}
                      </button>
                    </div>
                  </form>
                ) : null}

                {property.orders.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-terminal-border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-terminal-bg text-left text-xs uppercase tracking-wide text-terminal-muted">
                        <tr>
                          <th className="px-4 py-3">{sm.colSeller}</th>
                          <th className="px-4 py-3">{sm.colTokens}</th>
                          <th className="px-4 py-3">{sm.colPrice}</th>
                          <th className="px-4 py-3">{sm.colTotal}</th>
                          <th className="px-4 py-3">{sm.colAction}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {property.orders.map((order) => (
                          <tr key={order.id} className="border-t border-terminal-border">
                            <td className="px-4 py-3 text-terminal-text">{order.sellerName ?? sm.anonymousSeller}</td>
                            <td className="px-4 py-3 font-mono">{order.tokenCount}</td>
                            <td className="px-4 py-3 font-mono">USD {order.pricePerTokenUsd.toFixed(2)}</td>
                            <td className="px-4 py-3 font-mono">USD {order.totalUsd.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              {order.isOwnListing ? (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => void handleCancel(order.id)}
                                  className="text-xs font-semibold text-terminal-warning hover:underline disabled:opacity-50"
                                >
                                  {sm.cancelListing}
                                </button>
                              ) : kycApproved ? (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => void handleBuy(order.id)}
                                  className="rounded-md border border-terminal-success/40 bg-terminal-success/10 px-3 py-1.5 text-xs font-semibold text-terminal-success disabled:opacity-50"
                                >
                                  {sm.buyTokens}
                                </button>
                              ) : (
                                <span className="text-xs text-terminal-muted">{sm.kycRequiredShort}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {feed.properties.length === 0 ? (
        <p className="mt-6 text-terminal-muted">{sm.empty}</p>
      ) : null}
    </div>
  );
}
