import { Injectable, Logger } from '@nestjs/common';
import type { Project } from '@prisma/client';
import { LendingAggregatorService } from '../lending/lending-aggregator.service';
import { PrismaService } from '../prisma/prisma.service';
import { MarketplaceFeedCacheService } from './marketplace-feed-cache.service';
import type { MarketplaceFeedDto, MarketplaceListingDto } from './marketplace.types';

function buildMapEmbedUrl(location: string, latitude?: unknown, longitude?: unknown) {
  const lat = latitude != null ? Number(latitude) : null;
  const lng = longitude != null ? Number(longitude) : null;

  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=es&z=16&output=embed`;
  }

  const query = encodeURIComponent(location);
  return `https://maps.google.com/maps?q=${query}&hl=es&z=14&output=embed`;
}

function parseMediaGallery(raw: unknown): MarketplaceListingDto['mediaGallery'] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is MarketplaceListingDto['mediaGallery'][number] =>
      typeof item === 'object' && item !== null && typeof (item as { url?: string }).url === 'string'
  );
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

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lendingAggregator: LendingAggregatorService,
    private readonly feedCache: MarketplaceFeedCacheService
  ) {}

  async listActiveListings(): Promise<MarketplaceListingDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    return projects.map((project) => this.mapProject(project));
  }

  getFeed(): Promise<MarketplaceFeedDto> {
    return this.feedCache.getOrSet(async () => {
      const [listings, borrowRate] = await Promise.all([
        this.listActiveListings(),
        this.lendingAggregator.getBestBorrowRate().catch((error) => {
          this.logger.warn(`Borrow rate aggregation failed: ${error}`);
          return null;
        })
      ]);

      return {
        listings,
        borrowRate,
        cachedAt: new Date().toISOString(),
        dataSource: listings.length > 0 ? 'live' : 'empty'
      };
    });
  }

  private mapProject(project: Project): MarketplaceListingDto {
    const apyPercent = Number(project.targetYield);
    const pricePerTokenUsd = Number(project.pricePerToken);
    const gallery = parseMediaGallery(project.mediaGallery);
    const primaryImage = project.image ?? gallery.find((item) => item.type === 'image')?.url ?? fallbackImage(project.id);

    return {
      id: project.id,
      title: project.title,
      description: project.description,
      location: project.location,
      imageUrl: primaryImage,
      mapEmbedUrl: buildMapEmbedUrl(project.location, project.latitude, project.longitude),
      apyPercent,
      pricePerTokenUsd,
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
}
