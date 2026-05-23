import { prisma } from '@sanova/database';
import { parseMediaGallery } from '../admin/launchTypes';
import { geocodeLocation } from '../geocoding/geocodeLocation';
import { fetchBestBorrowRate } from '../lending/bestBorrowRate';
import { syncActiveProjectsFromStorage } from '../storage/syncLaunchStorage';
import type { MarketplaceFeed, MarketplaceListing } from '../../types/marketplace';

function buildMapEmbedUrl(location: string, latitude?: unknown, longitude?: unknown) {
  const lat = latitude != null ? Number(latitude) : null;
  const lng = longitude != null ? Number(longitude) : null;

  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=es&z=16&output=embed`;
  }

  const query = encodeURIComponent(location);
  return `https://maps.google.com/maps?q=${query}&hl=es&z=14&output=embed`;
}

function fallbackImage(seed: string) {
  return `https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80&sig=${encodeURIComponent(seed)}`;
}

function computeSoldPercent(availableTokens: number, totalTokens: number) {
  if (totalTokens <= 0) {
    return 0;
  }

  const sold = totalTokens - availableTokens;
  return Math.min(100, Math.max(0, Math.round((sold / totalTokens) * 100)));
}

function mapProject(project: {
  id: string;
  title: string;
  description: string;
  location: string;
  image: string | null;
  latitude: { toString(): string } | null;
  longitude: { toString(): string } | null;
  mediaGallery: unknown;
  targetYield: { toString(): string } | number;
  pricePerToken: { toString(): string } | number;
  availableTokens: number;
  totalTokens: number;
  tokenInstrumentType: string;
  maturityDate: Date | null;
  equitySharePercent: { toString(): string } | null;
  fiscalRegime: string;
  jurisdiction: string | null;
  tokenSymbol: string | null;
  contractTrustUrl: string | null;
  contractPurchaseUrl: string | null;
  contractLeaseUrl: string | null;
  contractSmartUrl: string | null;
}): MarketplaceListing {
  const gallery = parseMediaGallery(project.mediaGallery);
  const primaryImage =
    project.image ?? gallery.find((item) => item.type === 'image')?.url ?? fallbackImage(project.id);

  return {
    id: project.id,
    title: project.title,
    description: project.description,
    location: project.location,
    imageUrl: primaryImage,
    mapEmbedUrl: buildMapEmbedUrl(project.location, project.latitude, project.longitude),
    apyPercent: Number(project.targetYield),
    pricePerTokenUsd: Number(project.pricePerToken),
    availableTokens: project.availableTokens,
    totalTokens: project.totalTokens,
    soldPercent: computeSoldPercent(project.availableTokens, project.totalTokens),
    tokenInstrumentType: (project.tokenInstrumentType as 'DEBT' | 'EQUITY') ?? 'EQUITY',
    maturityDate: project.maturityDate ? project.maturityDate.toISOString() : null,
    equitySharePercent:
      project.equitySharePercent != null ? Number(project.equitySharePercent) : null,
    fiscalRegime: project.fiscalRegime,
    jurisdiction: project.jurisdiction,
    tokenSymbol: project.tokenSymbol,
    mediaGallery: gallery,
    contracts: {
      trust: project.contractTrustUrl,
      purchase: project.contractPurchaseUrl,
      lease: project.contractLeaseUrl,
      smartContract: project.contractSmartUrl
    }
  };
}

async function backfillProjectCoordinates(project: {
  id: string;
  location: string;
  latitude: { toString(): string } | null;
  longitude: { toString(): string } | null;
}) {
  if (project.latitude != null && project.longitude != null) {
    return;
  }

  const coords = await geocodeLocation(project.location);
  if (!coords) {
    return;
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      latitude: coords.latitude,
      longitude: coords.longitude
    }
  });

  Object.assign(project, {
    latitude: coords.latitude,
    longitude: coords.longitude
  });
}

export async function fetchMarketplaceFeedFromDb(): Promise<MarketplaceFeed> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY) {
    await syncActiveProjectsFromStorage().catch(() => undefined);
  }

  const projects = await prisma.project.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });

  await Promise.all(projects.map((project) => backfillProjectCoordinates(project)));

  const borrowRate = await fetchBestBorrowRate().catch(() => null);
  const listings = projects.map(mapProject);

  return {
    listings,
    borrowRate,
    cachedAt: new Date().toISOString(),
    dataSource: listings.length > 0 ? 'live' : 'empty',
    usedFallback: false
  };
}
