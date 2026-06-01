import { buildMapEmbedUrl, type LaunchContracts, type LaunchMediaItem } from '../admin/launchTypes';
import type { MarketplaceListing } from '../../types/marketplace';

/** Subset of admin editor fields used to render marketplace cards. */
export type MarketplaceAssetSource = {
  id: string;
  title: string;
  description: string;
  location: string;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  mediaGallery: LaunchMediaItem[];
  contracts: LaunchContracts;
  targetYield: number;
  pricePerToken: number;
  availableTokens: number;
  totalTokens: number;
  soldPercent: number;
  tokenInstrumentType: 'DEBT' | 'EQUITY';
  maturityDate: string | null;
  equitySharePercent: number | null;
  fiscalRegime: string;
  jurisdiction: string | null;
  tokenSymbol: string | null;
  tokenName?: string | null;
  vaultAddress?: string | null;
  readyToBorrow?: boolean;
};

function fallbackImage(seed: string) {
  return `https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80&sig=${encodeURIComponent(seed)}`;
}

/** Known hero images for seeded marketplace projects (survives broken legacy URLs in DB). */
const PROJECT_HERO_IMAGES: Record<string, string> = {
  'proj-san-patricio-industrial':
    'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80'
};

function normalizeUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Maps admin editor asset data to the marketplace card payload (single source of truth). */
export function mapAdminAssetToMarketplaceListing(asset: MarketplaceAssetSource): MarketplaceListing {
  const gallery = asset.mediaGallery;
  const primaryImage =
    PROJECT_HERO_IMAGES[asset.id] ??
    normalizeUrl(asset.image) ??
    gallery.find((item) => item.type === 'image')?.url ??
    fallbackImage(asset.id);

  return {
    id: asset.id,
    title: asset.title,
    description: asset.description,
    location: asset.location,
    imageUrl: primaryImage,
    mapEmbedUrl: buildMapEmbedUrl(asset.location, asset.latitude, asset.longitude),
    apyPercent: asset.targetYield,
    pricePerTokenUsd: asset.pricePerToken,
    availableTokens: asset.availableTokens,
    totalTokens: asset.totalTokens,
    soldPercent: asset.soldPercent,
    tokenInstrumentType: asset.tokenInstrumentType,
    maturityDate: asset.maturityDate,
    equitySharePercent: asset.equitySharePercent,
    fiscalRegime: asset.fiscalRegime,
    jurisdiction: asset.jurisdiction,
    tokenSymbol: asset.tokenSymbol,
    tokenName: asset.tokenName ?? null,
    vaultAddress: asset.vaultAddress ?? null,
    readyToBorrow: Boolean(asset.readyToBorrow),
    mediaGallery: gallery,
    contracts: {
      trust: normalizeUrl(asset.contracts.trust),
      purchase: normalizeUrl(asset.contracts.purchase),
      lease: normalizeUrl(asset.contracts.lease),
      smartContract: normalizeUrl(asset.contracts.smartContract)
    }
  };
}
