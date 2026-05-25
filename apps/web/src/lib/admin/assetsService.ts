import { prisma, type FiscalRegime, type Prisma } from '@sanova/database';
import { geocodeLocation } from '../geocoding/geocodeLocation';
import { locationNeedsResolve, resolveLocationInput } from '../geocoding/resolveLocation';
import { mapAdminAssetToMarketplaceListing } from '../marketplace/mapAdminAssetToListing';
import { syncProjectAssetsFromStorage } from '../storage/syncLaunchStorage';
import type { MarketplaceListing } from '../../types/marketplace';
import {
  autoFillCentrifugeChecklist,
  parseCentrifugeChecklist,
  parseCollateralTargets,
  parseMediaGallery,
  type CentrifugeChecklist,
  type CollateralProtocol,
  type CollateralTarget,
  type LaunchContracts,
  type LaunchMediaItem,
  type TokenDeployStatus,
  type TokenStandard,
  type TokenInstrumentType
} from './launchTypes';
import { buildInitialCollateralTargets, mergeCollateralTargets } from '../collateral/collateralTargetsService';
import type { CollateralProjectContext } from '../collateral/collateralRegistry';

export type AdminAssetRecord = {
  id: string;
  title: string;
  description: string;
  location: string;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  mediaGallery: LaunchMediaItem[];
  contracts: LaunchContracts;
  tokenName: string | null;
  tokenSymbol: string | null;
  tokenStandard: TokenStandard;
  tokenInstrumentType: TokenInstrumentType;
  maturityDate: string | null;
  equitySharePercent: number | null;
  tokenDeployStatus: TokenDeployStatus;
  collateralTargets: CollateralTarget[];
  centrifugeChecklist: CentrifugeChecklist;
  spvEntityName: string | null;
  navOracleUrl: string | null;
  contractAddress: string | null;
  vaultAddress: string | null;
  chainId: number | null;
  totalTokens: number;
  availableTokens: number;
  soldPercent: number;
  pricePerToken: number;
  targetYield: number;
  fiscalRegime: FiscalRegime;
  jurisdiction: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activeInvestments: number;
};

export type AssetListFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export type CreateAdminAssetInput = {
  title: string;
  description: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  image?: string | null;
  mediaGallery?: LaunchMediaItem[];
  contracts?: LaunchContracts;
  tokenName?: string | null;
  tokenSymbol?: string | null;
  tokenStandard?: TokenStandard;
  tokenInstrumentType?: TokenInstrumentType;
  maturityDate?: string | null;
  equitySharePercent?: number | null;
  spvEntityName?: string | null;
  navOracleUrl?: string | null;
  centrifugeChecklist?: CentrifugeChecklist;
  totalTokens: number;
  pricePerToken: number;
  targetYield: number;
  fiscalRegime?: FiscalRegime;
  jurisdiction?: string | null;
  isActive?: boolean;
  collateralProtocols?: CollateralProtocol[];
  collateralTargets?: CollateralTarget[];
  deployToken?: boolean;
};

export type UpdateAdminAssetInput = {
  title?: string;
  description?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  image?: string | null;
  mediaGallery?: LaunchMediaItem[];
  contracts?: LaunchContracts;
  tokenName?: string | null;
  tokenSymbol?: string | null;
  tokenStandard?: TokenStandard;
  tokenInstrumentType?: TokenInstrumentType;
  maturityDate?: string | null;
  equitySharePercent?: number | null;
  spvEntityName?: string | null;
  navOracleUrl?: string | null;
  centrifugeChecklist?: CentrifugeChecklist;
  isActive?: boolean;
  availableTokens?: number;
  pricePerToken?: number;
  targetYield?: number;
  totalTokens?: number;
  fiscalRegime?: FiscalRegime;
  jurisdiction?: string | null;
  collateralProtocols?: CollateralProtocol[];
  collateralTargets?: CollateralTarget[];
  contractAddress?: string | null;
  vaultAddress?: string | null;
  chainId?: number | null;
  tokenDeployStatus?: TokenDeployStatus;
  deployToken?: boolean;
};

async function resolveLocationFields(input: {
  location: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ location: string; latitude: number | null; longitude: number | null }> {
  if (input.latitude != null && input.longitude != null) {
    return {
      location: input.location.trim(),
      latitude: input.latitude,
      longitude: input.longitude
    };
  }

  const resolved = await resolveLocationInput(input.location);
  if (!resolved) {
    return { location: input.location.trim(), latitude: null, longitude: null };
  }

  return resolved;
}

async function applyGeocodingIfNeeded(input: {
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ latitude?: number | null; longitude?: number | null }> {
  if (input.latitude != null && input.longitude != null) {
    return { latitude: input.latitude, longitude: input.longitude };
  }

  if (!input.location?.trim()) {
    return {};
  }

  const coords = await geocodeLocation(input.location);
  if (!coords) {
    return {};
  }

  return { latitude: coords.latitude, longitude: coords.longitude };
}

function computeSoldPercent(availableTokens: number, totalTokens: number): number {
  if (totalTokens <= 0) {
    return 0;
  }

  const sold = totalTokens - availableTokens;
  return Math.min(100, Math.max(0, Math.round((sold / totalTokens) * 100)));
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function generateProjectId(title: string): Promise<string> {
  const base = `proj-${slugifyTitle(title) || 'activo'}`;
  const existing = await prisma.project.findUnique({ where: { id: base } });

  if (!existing) {
    return base;
  }

  return `${base}-${Date.now().toString(36)}`;
}

function toCollateralContext(
  project: {
    id: string;
    title: string;
    tokenName: string | null;
    tokenSymbol: string | null;
    tokenStandard: string;
    tokenInstrumentType: string;
    maturityDate: Date | null;
    equitySharePercent: { toString(): string } | null;
    tokenDeployStatus: string;
    contractAddress: string | null;
    vaultAddress: string | null;
    chainId: number | null;
    totalTokens: number;
    spvEntityName: string | null;
    navOracleUrl: string | null;
    jurisdiction: string | null;
    centrifugeChecklist: unknown;
    contractTrustUrl: string | null;
    contractPurchaseUrl: string | null;
    contractLeaseUrl: string | null;
    collateralTargets: unknown;
  },
  overrides?: Partial<CollateralProjectContext>
): CollateralProjectContext {
  const checklist = parseCentrifugeChecklist(project.centrifugeChecklist);
  return {
    id: project.id,
    title: project.title,
    tokenName: project.tokenName,
    tokenSymbol: project.tokenSymbol,
    tokenStandard: (project.tokenStandard as TokenStandard) ?? 'SANOVA_KYC',
    tokenInstrumentType: (project.tokenInstrumentType as TokenInstrumentType) ?? 'EQUITY',
    maturityDate: project.maturityDate ? project.maturityDate.toISOString() : null,
    tokenDeployStatus: project.tokenDeployStatus as TokenDeployStatus,
    contractAddress: project.contractAddress,
    vaultAddress: project.vaultAddress,
    chainId: project.chainId,
    totalTokens: project.totalTokens,
    spvEntityName: project.spvEntityName,
    navOracleUrl: project.navOracleUrl,
    jurisdiction: project.jurisdiction,
    centrifugeChecklist: checklist,
    contracts: {
      trust: project.contractTrustUrl,
      purchase: project.contractPurchaseUrl,
      lease: project.contractLeaseUrl
    },
    collateralTargets: parseCollateralTargets(project.collateralTargets),
    ...overrides
  };
}

function buildCollateralTargets(
  project: CollateralProjectContext,
  protocols: CollateralProtocol[] | undefined
): CollateralTarget[] {
  return buildInitialCollateralTargets(project, protocols);
}

function normalizeOptionalUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
  contractTrustUrl: string | null;
  contractPurchaseUrl: string | null;
  contractLeaseUrl: string | null;
  contractSmartUrl: string | null;
  tokenName: string | null;
  tokenSymbol: string | null;
  tokenStandard: string;
  tokenInstrumentType: string;
  maturityDate: Date | null;
  equitySharePercent: { toString(): string } | null;
  tokenDeployStatus: string;
  collateralTargets: unknown;
  centrifugeChecklist: unknown;
  spvEntityName: string | null;
  navOracleUrl: string | null;
  contractAddress: string | null;
  vaultAddress: string | null;
  chainId: number | null;
  totalTokens: number;
  availableTokens: number;
  pricePerToken: { toString(): string } | number;
  targetYield: { toString(): string } | number;
  fiscalRegime: FiscalRegime;
  jurisdiction: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { investments: number };
}): AdminAssetRecord {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    location: project.location,
    image: project.image,
    latitude: project.latitude != null ? Number(project.latitude) : null,
    longitude: project.longitude != null ? Number(project.longitude) : null,
    mediaGallery: parseMediaGallery(project.mediaGallery),
    contracts: {
      trust: normalizeOptionalUrl(project.contractTrustUrl),
      purchase: normalizeOptionalUrl(project.contractPurchaseUrl),
      lease: normalizeOptionalUrl(project.contractLeaseUrl),
      smartContract: normalizeOptionalUrl(project.contractSmartUrl)
    },
    tokenName: project.tokenName,
    tokenSymbol: project.tokenSymbol,
    tokenStandard: (project.tokenStandard as TokenStandard) ?? 'SANOVA_KYC',
    tokenInstrumentType: (project.tokenInstrumentType as TokenInstrumentType) ?? 'EQUITY',
    maturityDate: project.maturityDate ? project.maturityDate.toISOString() : null,
    equitySharePercent:
      project.equitySharePercent != null ? Number(project.equitySharePercent) : null,
    tokenDeployStatus: project.tokenDeployStatus as TokenDeployStatus,
    collateralTargets: parseCollateralTargets(project.collateralTargets),
    centrifugeChecklist: parseCentrifugeChecklist(project.centrifugeChecklist),
    spvEntityName: project.spvEntityName,
    navOracleUrl: project.navOracleUrl,
    contractAddress: project.contractAddress,
    vaultAddress: project.vaultAddress,
    chainId: project.chainId,
    totalTokens: project.totalTokens,
    availableTokens: project.availableTokens,
    soldPercent: computeSoldPercent(project.availableTokens, project.totalTokens),
    pricePerToken: Number(project.pricePerToken),
    targetYield: Number(project.targetYield),
    fiscalRegime: project.fiscalRegime,
    jurisdiction: project.jurisdiction,
    isActive: project.isActive,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    activeInvestments: project._count.investments
  };
}

const projectInclude = {
  _count: {
    select: {
      investments: {
        where: { status: 'ACTIVE' as const }
      }
    }
  }
} as const;

export async function listAdminAssets(filter: AssetListFilter = 'ALL'): Promise<AdminAssetRecord[]> {
  const projects = await prisma.project.findMany({
    where:
      filter === 'ALL'
        ? undefined
        : {
            isActive: filter === 'ACTIVE'
          },
    include: projectInclude,
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
  });

  return projects.map(mapProject);
}

export async function getAdminAsset(projectId: string): Promise<AdminAssetRecord | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: projectInclude
  });

  return project ? mapProject(project) : null;
}

export async function createAdminAsset(input: CreateAdminAssetInput): Promise<AdminAssetRecord> {
  if (!input.title.trim() || !input.description.trim() || !input.location.trim()) {
    throw new Error('MISSING_REQUIRED_FIELDS');
  }

  if (!Number.isInteger(input.totalTokens) || input.totalTokens <= 0) {
    throw new Error('INVALID_TOTAL_TOKENS');
  }

  if (!Number.isFinite(input.pricePerToken) || input.pricePerToken <= 0) {
    throw new Error('INVALID_PRICE');
  }

  if (!Number.isFinite(input.targetYield) || input.targetYield < 0) {
    throw new Error('INVALID_YIELD');
  }

  const id = await generateProjectId(input.title);
  const gallery = input.mediaGallery ?? [];
  const primaryImage = input.image ?? gallery.find((item) => item.type === 'image')?.url ?? null;
  const geocoded = await resolveLocationFields({
    location: input.location.trim(),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null
  });
  const collateralContext = toCollateralContext(
    {
      id,
      title: input.title.trim(),
      tokenName: input.tokenName?.trim() || input.title.trim(),
      tokenSymbol: input.tokenSymbol?.trim()?.toUpperCase() || null,
      tokenStandard: input.tokenStandard ?? 'SANOVA_KYC',
      tokenInstrumentType: input.tokenInstrumentType ?? 'EQUITY',
      maturityDate: input.maturityDate ? new Date(input.maturityDate) : null,
      equitySharePercent: input.equitySharePercent ?? null,
      tokenDeployStatus: input.deployToken ? 'PENDING' : 'NOT_REQUESTED',
      contractAddress: null,
      vaultAddress: null,
      chainId: null,
      totalTokens: input.totalTokens,
      spvEntityName: input.spvEntityName?.trim() || null,
      navOracleUrl: input.navOracleUrl?.trim() || null,
      jurisdiction: input.jurisdiction ?? null,
      centrifugeChecklist: input.centrifugeChecklist ?? parseCentrifugeChecklist(null),
      contractTrustUrl: input.contracts?.trust ?? null,
      contractPurchaseUrl: input.contracts?.purchase ?? null,
      contractLeaseUrl: input.contracts?.lease ?? null,
      collateralTargets: []
    }
  );

  const project = await prisma.project.create({
    data: {
      id,
      title: input.title.trim(),
      description: input.description.trim(),
      location: geocoded.location,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      image: primaryImage,
      mediaGallery: gallery as Prisma.InputJsonValue,
      contractTrustUrl: input.contracts?.trust ?? null,
      contractPurchaseUrl: input.contracts?.purchase ?? null,
      contractLeaseUrl: input.contracts?.lease ?? null,
      contractSmartUrl: input.contracts?.smartContract ?? null,
      tokenName: input.tokenName?.trim() || input.title.trim(),
      tokenSymbol: input.tokenSymbol?.trim()?.toUpperCase() || null,
      tokenStandard: input.tokenStandard ?? 'SANOVA_KYC',
      tokenInstrumentType: input.tokenInstrumentType ?? 'EQUITY',
      maturityDate: input.maturityDate ? new Date(input.maturityDate) : null,
      equitySharePercent: input.equitySharePercent ?? null,
      tokenDeployStatus: input.deployToken ? 'PENDING' : 'NOT_REQUESTED',
      collateralTargets: buildCollateralTargets(collateralContext, input.collateralProtocols) as Prisma.InputJsonValue,
      centrifugeChecklist: (input.centrifugeChecklist ?? parseCentrifugeChecklist(null)) as Prisma.InputJsonValue,
      spvEntityName: input.spvEntityName?.trim() || null,
      navOracleUrl: input.navOracleUrl?.trim() || null,
      totalTokens: input.totalTokens,
      availableTokens: input.totalTokens,
      pricePerToken: input.pricePerToken,
      targetYield: input.targetYield,
      fiscalRegime: input.fiscalRegime ?? 'LEY_19640',
      jurisdiction: input.jurisdiction ?? null,
      isActive: input.isActive ?? false
    },
    include: projectInclude
  });

  await syncProjectAssetsFromStorage(id).catch(() => undefined);

  const synced = await getAdminAsset(id);
  return synced ?? mapProject(project);
}

export async function updateAdminAsset(
  projectId: string,
  input: UpdateAdminAssetInput
): Promise<AdminAssetRecord | null> {
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    include: projectInclude
  });

  if (!existing) {
    return null;
  }

  const data: Prisma.ProjectUpdateInput = {};

  if (typeof input.title === 'string') data.title = input.title.trim();
  if (typeof input.description === 'string') data.description = input.description.trim();

  if (typeof input.location === 'string') {
    const trimmed = input.location.trim();
    const locationChanged = trimmed !== existing.location.trim();
    const hasManualCoords = input.latitude != null && input.longitude != null;

    if (hasManualCoords) {
      data.location = trimmed;
      data.latitude = input.latitude;
      data.longitude = input.longitude;
    } else if (
      locationChanged ||
      existing.latitude == null ||
      existing.longitude == null ||
      locationNeedsResolve(trimmed, existing.latitude != null ? Number(existing.latitude) : null, existing.longitude != null ? Number(existing.longitude) : null)
    ) {
      const resolved = await resolveLocationInput(trimmed);
      if (resolved) {
        data.location = resolved.location;
        data.latitude = resolved.latitude;
        data.longitude = resolved.longitude;
      } else {
        data.location = trimmed;
      }
    } else {
      data.location = trimmed;
    }
  } else {
    if (input.latitude !== undefined) data.latitude = input.latitude;
    if (input.longitude !== undefined) data.longitude = input.longitude;
  }

  if (input.image !== undefined) data.image = input.image;
  if (input.mediaGallery !== undefined) {
    data.mediaGallery = input.mediaGallery as Prisma.InputJsonValue;
    const primaryImage = input.mediaGallery.find((item) => item.type === 'image')?.url ?? null;
    if (primaryImage) {
      data.image = primaryImage;
    }
  }
  if (input.contracts?.trust !== undefined) {
    data.contractTrustUrl = normalizeOptionalUrl(input.contracts.trust);
  }
  if (input.contracts?.purchase !== undefined) {
    data.contractPurchaseUrl = normalizeOptionalUrl(input.contracts.purchase);
  }
  if (input.contracts?.lease !== undefined) {
    data.contractLeaseUrl = normalizeOptionalUrl(input.contracts.lease);
  }
  if (input.contracts?.smartContract !== undefined) {
    data.contractSmartUrl = normalizeOptionalUrl(input.contracts.smartContract);
  }
  if (input.tokenName !== undefined) data.tokenName = input.tokenName;
  if (input.tokenSymbol !== undefined) data.tokenSymbol = input.tokenSymbol?.toUpperCase() ?? null;
  if (input.tokenStandard !== undefined) data.tokenStandard = input.tokenStandard;
  if (input.tokenInstrumentType !== undefined) data.tokenInstrumentType = input.tokenInstrumentType;
  if (input.maturityDate !== undefined) {
    data.maturityDate = input.maturityDate ? new Date(input.maturityDate) : null;
  }
  if (input.equitySharePercent !== undefined) data.equitySharePercent = input.equitySharePercent;
  if (input.spvEntityName !== undefined) data.spvEntityName = input.spvEntityName;
  if (input.navOracleUrl !== undefined) data.navOracleUrl = input.navOracleUrl;
  if (input.centrifugeChecklist !== undefined) {
    data.centrifugeChecklist = input.centrifugeChecklist as Prisma.InputJsonValue;
  } else if (
    input.spvEntityName !== undefined ||
    input.navOracleUrl !== undefined ||
    input.contracts !== undefined ||
    input.contractAddress !== undefined
  ) {
    const checklist = autoFillCentrifugeChecklist({
      checklist: parseCentrifugeChecklist(existing.centrifugeChecklist),
      hasTrustContract: Boolean(
        input.contracts?.trust ?? existing.contractTrustUrl
      ),
      hasNavOracleUrl: Boolean(input.navOracleUrl ?? existing.navOracleUrl),
      hasSpvName: Boolean(input.spvEntityName ?? existing.spvEntityName),
      tokenDeployed: Boolean(input.contractAddress ?? existing.contractAddress)
    });
    data.centrifugeChecklist = checklist as Prisma.InputJsonValue;
  }
  if (typeof input.isActive === 'boolean') data.isActive = input.isActive;
  if (typeof input.targetYield === 'number') data.targetYield = input.targetYield;
  if (input.fiscalRegime !== undefined) data.fiscalRegime = input.fiscalRegime;
  if (input.jurisdiction !== undefined) data.jurisdiction = input.jurisdiction;
  if (input.contractAddress !== undefined) data.contractAddress = input.contractAddress;
  if (input.vaultAddress !== undefined) data.vaultAddress = input.vaultAddress;
  if (input.chainId !== undefined) data.chainId = input.chainId;
  if (input.tokenDeployStatus !== undefined) data.tokenDeployStatus = input.tokenDeployStatus;

  if (input.collateralTargets !== undefined) {
    data.collateralTargets = input.collateralTargets as Prisma.InputJsonValue;
  } else if (input.collateralProtocols !== undefined) {
    const context = toCollateralContext(existing, {
      centrifugeChecklist:
        input.centrifugeChecklist ?? parseCentrifugeChecklist(existing.centrifugeChecklist),
      contracts: {
        trust: input.contracts?.trust ?? existing.contractTrustUrl,
        purchase: input.contracts?.purchase ?? existing.contractPurchaseUrl,
        lease: input.contracts?.lease ?? existing.contractLeaseUrl
      },
      tokenStandard: (input.tokenStandard ?? existing.tokenStandard) as TokenStandard,
      contractAddress: input.contractAddress ?? existing.contractAddress,
      vaultAddress: input.vaultAddress ?? existing.vaultAddress,
      chainId: input.chainId ?? existing.chainId,
      spvEntityName: input.spvEntityName ?? existing.spvEntityName,
      navOracleUrl: input.navOracleUrl ?? existing.navOracleUrl,
      jurisdiction: input.jurisdiction ?? existing.jurisdiction,
      totalTokens: input.totalTokens ?? existing.totalTokens
    });
    data.collateralTargets = mergeCollateralTargets(context, input.collateralProtocols) as Prisma.InputJsonValue;
  }

  if (typeof input.availableTokens === 'number') {
    if (!Number.isInteger(input.availableTokens) || input.availableTokens < 0) {
      throw new Error('INVALID_AVAILABLE_TOKENS');
    }

    const total = input.totalTokens ?? existing.totalTokens;
    if (input.availableTokens > total) {
      throw new Error('AVAILABLE_EXCEEDS_TOTAL');
    }

    data.availableTokens = input.availableTokens;
  }

  if (typeof input.totalTokens === 'number') {
    if (!Number.isInteger(input.totalTokens) || input.totalTokens <= 0) {
      throw new Error('INVALID_TOTAL_TOKENS');
    }

    if (existing.availableTokens > input.totalTokens) {
      data.availableTokens = input.totalTokens;
    }

    data.totalTokens = input.totalTokens;
  }

  if (typeof input.pricePerToken === 'number') {
    if (!Number.isFinite(input.pricePerToken) || input.pricePerToken <= 0) {
      throw new Error('INVALID_PRICE');
    }

    data.pricePerToken = input.pricePerToken;
  }

  if (Object.keys(data).length === 0) {
    return mapProject(existing);
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data,
    include: projectInclude
  });

  return mapProject(updated);
}

/** Published assets from the admin editor, synced for marketplace cards. */
export async function listMarketplaceListings(): Promise<MarketplaceListing[]> {
  const activeProjects = await prisma.project.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'desc' }
  });

  const listings: MarketplaceListing[] = [];

  for (const { id } of activeProjects) {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY) {
      await syncProjectAssetsFromStorage(id).catch(() => undefined);
    }

    const asset = await getAdminAsset(id);
    if (!asset) {
      continue;
    }

    if (locationNeedsResolve(asset.location, asset.latitude, asset.longitude)) {
      const resolved = await resolveLocationInput(asset.location);
      if (resolved?.latitude != null && resolved.longitude != null) {
        await prisma.project.update({
          where: { id },
          data: {
            location: resolved.location,
            latitude: resolved.latitude,
            longitude: resolved.longitude
          }
        });
        asset.location = resolved.location;
        asset.latitude = resolved.latitude;
        asset.longitude = resolved.longitude;
      }
    }

    listings.push(mapAdminAssetToMarketplaceListing(asset));
  }

  return listings;
}

export async function markTokenDeployResult(
  projectId: string,
  result: {
    status: TokenDeployStatus;
    contractAddress?: string;
    vaultAddress?: string;
    chainId?: number;
  }
): Promise<AdminAssetRecord | null> {
  return updateAdminAsset(projectId, {
    tokenDeployStatus: result.status,
    contractAddress: result.contractAddress ?? undefined,
    vaultAddress: result.vaultAddress ?? undefined,
    chainId: result.chainId ?? undefined
  });
}
