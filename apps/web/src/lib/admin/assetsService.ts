import { prisma, type FiscalRegime, type Prisma } from '@sanova/database';
import { geocodeLocation } from '../geocoding/geocodeLocation';
import { locationNeedsResolve, resolveLocationInput } from '../geocoding/resolveLocation';
import { mapAdminAssetToMarketplaceListing } from '../marketplace/mapAdminAssetToListing';
import { syncProjectAssetsFromStorage } from '../storage/syncLaunchStorage';
import type { MarketplaceListing } from '../../types/marketplace';
import {
  autoFillCentrifugeChecklist,
  parseAutomationReadiness,
  parseCentrifugeChecklist,
  parseCollateralTargets,
  parseDeploymentEvents,
  parseMediaGallery,
  type AutomationReadinessSummary,
  type CentrifugeChecklist,
  type CollateralProtocol,
  type CollateralTarget,
  type DeploymentEvent,
  type ExplorerVerificationStatus,
  type LaunchContracts,
  type LaunchMediaItem,
  type MorphoLiquidityStatus,
  type TokenDeployStatus,
  type TokenStandard,
  type TokenInstrumentType,
  type VaultFundingStatus
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
  deploymentEvents: DeploymentEvent[];
  automationReadiness: AutomationReadinessSummary;
  automationFailureCount: number;
  automationCircuitBreaker: boolean;
  automationLockStep: string | null;
  automationLockExpiresAt: string | null;
  morphoLiquidityStatus: MorphoLiquidityStatus;
  explorerVerificationStatus: ExplorerVerificationStatus;
  launchAuditHash: string | null;
  readyToBorrow: boolean;
  centrifugeChecklist: CentrifugeChecklist;
  spvEntityName: string | null;
  navOracleUrl: string | null;
  contractAddress: string | null;
  vaultAddress: string | null;
  vaultFundingStatus: VaultFundingStatus;
  vaultFundingAmount: string | null;
  vaultFundingTxHash: string | null;
  vaultFundingError: string | null;
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
  vaultFundingStatus?: VaultFundingStatus;
  vaultFundingAmount?: string | null;
  vaultFundingTxHash?: string | null;
  vaultFundingError?: string | null;
  chainId?: number | null;
  tokenDeployStatus?: TokenDeployStatus;
  deploymentEvents?: DeploymentEvent[];
  automationReadiness?: AutomationReadinessSummary;
  automationFailureCount?: number;
  automationCircuitBreaker?: boolean;
  automationLockStep?: string | null;
  automationLockExpiresAt?: Date | null;
  morphoLiquidityStatus?: MorphoLiquidityStatus;
  explorerVerificationStatus?: ExplorerVerificationStatus;
  launchAuditHash?: string | null;
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

function sha256Json(value: unknown): string {
  let hash = 0;
  const input = JSON.stringify(value);
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

async function auditHashJson(value: unknown): Promise<string> {
  if (typeof window !== 'undefined') {
    return sha256Json(value);
  }

  try {
    const { serverSha256Json } = await import('./serverAuditHash');
    return await serverSha256Json(value);
  } catch {
    return sha256Json(value);
  }
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function item(
  key: string,
  label: string,
  ready: boolean,
  detail: string,
  required = true
): AutomationReadinessSummary['items'][number] {
  return {
    key,
    label,
    status: required ? (ready ? 'READY' : 'PENDING') : 'NOT_REQUIRED',
    detail
  };
}

function buildAutomationReadiness(project: {
  tokenStandard: string;
  tokenDeployStatus: string;
  contractAddress: string | null;
  vaultAddress: string | null;
  vaultFundingStatus: string;
  collateralTargets: unknown;
  deploymentEvents: unknown;
  automationCircuitBreaker?: boolean | null;
  morphoLiquidityStatus?: string | null;
  explorerVerificationStatus?: string | null;
  launchAuditHash?: string | null;
}): AutomationReadinessSummary {
  const targets = parseCollateralTargets(project.collateralTargets);
  const events = parseDeploymentEvents(project.deploymentEvents);
  const morpho = targets.find((target) => target.protocol === 'MORPHO');
  const hasMorpho = Boolean(morpho);
  const requiresVault = project.tokenStandard === 'ERC4626';
  const explorerVerified =
    project.explorerVerificationStatus === 'VERIFIED' ||
    events.some((event) => event.step === 'EXPLORER_VERIFY' && event.status === 'SUCCESS');
  const oracleReady = Boolean(morpho?.oracleAddress);
  const morphoReady = morpho?.status === 'REGISTERED';
  const liquidityReady = !hasMorpho || project.morphoLiquidityStatus === 'LIQUID';
  const circuitOk = !project.automationCircuitBreaker;
  const items: AutomationReadinessSummary['items'] = [
    item('token', 'Token RWA', Boolean(project.contractAddress) && project.tokenDeployStatus === 'DEPLOYED', project.contractAddress ?? 'Token pendiente.'),
    item('vault', 'Vault ERC-4626', Boolean(project.vaultAddress), project.vaultAddress ?? 'Vault pendiente.', requiresVault),
    item('vaultFunding', 'Fondeo vault', project.vaultFundingStatus === 'FUNDED', project.vaultFundingStatus, requiresVault),
    item('oracle', 'Oracle Morpho', oracleReady, morpho?.oracleAddress ?? 'Oracle pendiente.', hasMorpho),
    item('morphoMarket', 'Mercado Morpho', morphoReady, morpho?.externalId ?? morpho?.lastError ?? 'Mercado pendiente.', hasMorpho),
    item('morphoLiquidity', 'Liquidez Morpho', liquidityReady, project.morphoLiquidityStatus ?? 'NOT_CHECKED', hasMorpho),
    item('explorer', 'Verificación explorer', explorerVerified, project.explorerVerificationStatus ?? 'NOT_REQUESTED'),
    item('audit', 'Audit hash', Boolean(project.launchAuditHash), project.launchAuditHash ?? 'Hash pendiente.'),
    item('circuitBreaker', 'Circuit breaker', circuitOk, circuitOk ? 'Automatización activa.' : 'Automatización pausada.')
  ];
  const required = items.filter((entry) => entry.status !== 'NOT_REQUIRED');
  const readyCount = required.filter((entry) => entry.status === 'READY').length;
  const score = required.length ? Math.round((readyCount / required.length) * 100) : 100;

  return {
    status:
      project.automationCircuitBreaker ? 'BLOCKED'
      : score === 100 ? 'READY'
      : 'PENDING',
    score,
    items,
    updatedAt: new Date().toISOString()
  };
}

function deriveReadyToBorrow(input: {
  readiness: AutomationReadinessSummary;
  tokenStandard: string;
  tokenDeployStatus: string;
  contractAddress: string | null;
  vaultAddress: string | null;
  vaultFundingStatus: string;
  collateralTargets: CollateralTarget[];
  morphoLiquidityStatus: MorphoLiquidityStatus;
  automationCircuitBreaker: boolean;
}): boolean {
  const morpho = input.collateralTargets.find((target) => target.protocol === 'MORPHO');
  return Boolean(
    input.readiness.status === 'READY' &&
      input.tokenStandard === 'ERC4626' &&
      input.tokenDeployStatus === 'DEPLOYED' &&
      input.contractAddress &&
      input.vaultAddress &&
      input.vaultFundingStatus === 'FUNDED' &&
      morpho?.status === 'REGISTERED' &&
      morpho.oracleAddress &&
      input.morphoLiquidityStatus === 'LIQUID' &&
      !input.automationCircuitBreaker
  );
}

type AutomationMeta = {
  automationReadiness: AutomationReadinessSummary | null;
  automationFailureCount: number;
  automationCircuitBreaker: boolean;
  automationLockStep: string | null;
  automationLockExpiresAt: string | null;
  morphoLiquidityStatus: MorphoLiquidityStatus;
  explorerVerificationStatus: ExplorerVerificationStatus;
  launchAuditHash: string | null;
};

const EMPTY_AUTOMATION_META: AutomationMeta = {
  automationReadiness: null,
  automationFailureCount: 0,
  automationCircuitBreaker: false,
  automationLockStep: null,
  automationLockExpiresAt: null,
  morphoLiquidityStatus: 'NOT_CHECKED',
  explorerVerificationStatus: 'NOT_REQUESTED',
  launchAuditHash: null
};

const automationLocks = new Map<string, { owner: string; step: string; expiresAt: number }>();

function parseAutomationMeta(raw: string): AutomationMeta {
  try {
    const parsed = JSON.parse(raw) as Partial<AutomationMeta>;
    return {
      ...EMPTY_AUTOMATION_META,
      ...parsed,
      automationReadiness: parseAutomationReadiness(parsed.automationReadiness) ?? null,
      morphoLiquidityStatus: (parsed.morphoLiquidityStatus as MorphoLiquidityStatus) ?? 'NOT_CHECKED',
      explorerVerificationStatus:
        (parsed.explorerVerificationStatus as ExplorerVerificationStatus) ?? 'NOT_REQUESTED'
    };
  } catch {
    return EMPTY_AUTOMATION_META;
  }
}

function buildAutomationMetaEvent(meta: AutomationMeta): DeploymentEvent {
  return {
    id: `automation-meta-${Date.now().toString(36)}`,
    step: 'PREFLIGHT',
    status: meta.automationCircuitBreaker ? 'FAILED' : 'SUCCESS',
    message: 'Estado operativo automatizado actualizado.',
    address: JSON.stringify(meta),
    externalId: 'AUTOMATION_META',
    createdAt: new Date().toISOString()
  };
}

function replaceAutomationMetaEvent(events: DeploymentEvent[], meta: AutomationMeta): DeploymentEvent[] {
  return [
    buildAutomationMetaEvent(meta),
    ...events.filter((event) => !(event.step === 'PREFLIGHT' && event.externalId === 'AUTOMATION_META'))
  ].slice(0, 50);
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
    pricePerToken: { toString(): string } | number;
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
    pricePerToken: Number(project.pricePerToken),
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
  deploymentEvents: unknown;
  centrifugeChecklist: unknown;
  spvEntityName: string | null;
  navOracleUrl: string | null;
  contractAddress: string | null;
  vaultAddress: string | null;
  vaultFundingStatus: string;
  vaultFundingAmount: string | null;
  vaultFundingTxHash: string | null;
  vaultFundingError: string | null;
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
  const events = parseDeploymentEvents(project.deploymentEvents);
  const latestMeta = events.find((event) => event.step === 'PREFLIGHT' && event.externalId === 'AUTOMATION_META');
  const meta =
    typeof latestMeta?.address === 'string'
      ? parseAutomationMeta(latestMeta.address)
      : EMPTY_AUTOMATION_META;
  const readiness =
    parseAutomationReadiness(meta.automationReadiness) ??
    buildAutomationReadiness({
      ...project,
      automationCircuitBreaker: meta.automationCircuitBreaker,
      morphoLiquidityStatus: meta.morphoLiquidityStatus,
      explorerVerificationStatus: meta.explorerVerificationStatus,
      launchAuditHash: meta.launchAuditHash
    });
  const collateralTargets = parseCollateralTargets(project.collateralTargets);
  const readyToBorrow = deriveReadyToBorrow({
    readiness,
    tokenStandard: project.tokenStandard,
    tokenDeployStatus: project.tokenDeployStatus,
    contractAddress: project.contractAddress,
    vaultAddress: project.vaultAddress,
    vaultFundingStatus: project.vaultFundingStatus,
    collateralTargets,
    morphoLiquidityStatus: meta.morphoLiquidityStatus,
    automationCircuitBreaker: meta.automationCircuitBreaker
  });

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
    collateralTargets,
    deploymentEvents: events,
    automationReadiness: readiness,
    automationFailureCount: meta.automationFailureCount,
    automationCircuitBreaker: meta.automationCircuitBreaker,
    automationLockStep: meta.automationLockStep,
    automationLockExpiresAt: meta.automationLockExpiresAt,
    morphoLiquidityStatus: meta.morphoLiquidityStatus,
    explorerVerificationStatus:
      meta.explorerVerificationStatus,
    launchAuditHash: meta.launchAuditHash,
    readyToBorrow,
    centrifugeChecklist: parseCentrifugeChecklist(project.centrifugeChecklist),
    spvEntityName: project.spvEntityName,
    navOracleUrl: project.navOracleUrl,
    contractAddress: project.contractAddress,
    vaultAddress: project.vaultAddress,
    vaultFundingStatus: (project.vaultFundingStatus as VaultFundingStatus) ?? 'NOT_REQUIRED',
    vaultFundingAmount: project.vaultFundingAmount,
    vaultFundingTxHash: project.vaultFundingTxHash,
    vaultFundingError: project.vaultFundingError,
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

export async function listAutomationRepairCandidates(limit = 3): Promise<AdminAssetRecord[]> {
  const assets = await listAdminAssets('ALL');
  return assets
    .filter((asset) => {
      const morpho = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
      return (
        asset.tokenDeployStatus === 'FAILED' ||
        asset.tokenDeployStatus === 'PENDING' ||
        (asset.tokenStandard === 'ERC4626' && (!asset.vaultAddress || asset.vaultFundingStatus !== 'FUNDED')) ||
        Boolean(morpho && morpho.status !== 'REGISTERED')
      );
    })
    .slice(0, limit);
}

export async function listAllowlistableAssets(): Promise<Array<{ id: string; title: string; contractAddress: string }>> {
  const assets = await listAdminAssets('ALL');
  return assets
    .filter((asset) => Boolean(asset.contractAddress))
    .map((asset) => ({
      id: asset.id,
      title: asset.title,
      contractAddress: asset.contractAddress!
    }));
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
      pricePerToken: input.pricePerToken,
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
  const collateralTargets = buildCollateralTargets(collateralContext, input.collateralProtocols);
  const deploymentEvents = [
    {
      id: `asset-created-${Date.now().toString(36)}`,
      step: 'PREFLIGHT',
      status: input.deployToken ? 'PENDING' : 'SKIPPED',
      message: input.deployToken
        ? 'Activo creado: automatización token/vault solicitada.'
        : 'Activo creado sin emisión automática.',
      createdAt: new Date().toISOString()
    }
  ] satisfies DeploymentEvent[];
  const launchAuditHash = await auditHashJson({
    id,
    title: input.title.trim(),
    totalTokens: input.totalTokens,
    pricePerToken: input.pricePerToken,
    tokenStandard: input.tokenStandard ?? 'SANOVA_KYC',
    collateralTargets
  });
  const automationReadiness = buildAutomationReadiness({
    tokenStandard: input.tokenStandard ?? 'SANOVA_KYC',
    tokenDeployStatus: input.deployToken ? 'PENDING' : 'NOT_REQUESTED',
    contractAddress: null,
    vaultAddress: null,
    vaultFundingStatus: 'NOT_REQUIRED',
    collateralTargets,
    deploymentEvents,
    automationCircuitBreaker: false,
    morphoLiquidityStatus: 'NOT_CHECKED',
    explorerVerificationStatus: 'NOT_REQUESTED',
    launchAuditHash
  });
  const initialMeta: AutomationMeta = {
    ...EMPTY_AUTOMATION_META,
    automationReadiness,
    launchAuditHash
  };

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
      collateralTargets: collateralTargets as Prisma.InputJsonValue,
      deploymentEvents: replaceAutomationMetaEvent(deploymentEvents, initialMeta) as Prisma.InputJsonValue,
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
  if (input.vaultFundingStatus !== undefined) data.vaultFundingStatus = input.vaultFundingStatus;
  if (input.vaultFundingAmount !== undefined) data.vaultFundingAmount = input.vaultFundingAmount;
  if (input.vaultFundingTxHash !== undefined) data.vaultFundingTxHash = input.vaultFundingTxHash;
  if (input.vaultFundingError !== undefined) data.vaultFundingError = input.vaultFundingError;
  if (input.chainId !== undefined) data.chainId = input.chainId;
  if (input.tokenDeployStatus !== undefined) data.tokenDeployStatus = input.tokenDeployStatus;
  if (input.deploymentEvents !== undefined) data.deploymentEvents = input.deploymentEvents as Prisma.InputJsonValue;

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
      totalTokens: input.totalTokens ?? existing.totalTokens,
      pricePerToken:
        input.pricePerToken ??
        Number(existing.pricePerToken)
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

  const hasAutomationMetaInput =
    input.automationReadiness !== undefined ||
    input.automationFailureCount !== undefined ||
    input.automationCircuitBreaker !== undefined ||
    input.automationLockStep !== undefined ||
    input.automationLockExpiresAt !== undefined ||
    input.morphoLiquidityStatus !== undefined ||
    input.explorerVerificationStatus !== undefined ||
    input.launchAuditHash !== undefined;

  if (Object.keys(data).length === 0 && !hasAutomationMetaInput) {
    return mapProject(existing);
  }

  if (Object.keys(data).length === 0) {
    data.deploymentEvents = parseDeploymentEvents(existing.deploymentEvents) as Prisma.InputJsonValue;
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data,
    include: projectInclude
  });

  const launchAuditHash = await auditHashJson({
    id: updated.id,
    title: updated.title,
    tokenStandard: updated.tokenStandard,
    contractAddress: updated.contractAddress,
    vaultAddress: updated.vaultAddress,
    vaultFundingStatus: updated.vaultFundingStatus,
    collateralTargets: updated.collateralTargets,
    deploymentEvents: updated.deploymentEvents
  });
  const existingEvents = parseDeploymentEvents(updated.deploymentEvents);
  const latestMeta = existingEvents.find((event) => event.step === 'PREFLIGHT' && event.externalId === 'AUTOMATION_META');
  const currentMeta =
    typeof latestMeta?.address === 'string'
      ? parseAutomationMeta(latestMeta.address)
      : EMPTY_AUTOMATION_META;
  const automationReadiness = buildAutomationReadiness({
    ...updated,
    launchAuditHash,
    automationCircuitBreaker: input.automationCircuitBreaker ?? currentMeta.automationCircuitBreaker,
    morphoLiquidityStatus: input.morphoLiquidityStatus ?? currentMeta.morphoLiquidityStatus,
    explorerVerificationStatus: input.explorerVerificationStatus ?? currentMeta.explorerVerificationStatus
  });
  const nextMeta: AutomationMeta = {
    ...currentMeta,
    automationReadiness: input.automationReadiness ?? automationReadiness,
    automationFailureCount: input.automationFailureCount ?? currentMeta.automationFailureCount,
    automationCircuitBreaker: input.automationCircuitBreaker ?? currentMeta.automationCircuitBreaker,
    automationLockStep: input.automationLockStep ?? currentMeta.automationLockStep,
    automationLockExpiresAt:
      input.automationLockExpiresAt !== undefined
        ? input.automationLockExpiresAt?.toISOString() ?? null
        : currentMeta.automationLockExpiresAt,
    morphoLiquidityStatus: input.morphoLiquidityStatus ?? currentMeta.morphoLiquidityStatus,
    explorerVerificationStatus: input.explorerVerificationStatus ?? currentMeta.explorerVerificationStatus,
    launchAuditHash: input.launchAuditHash ?? launchAuditHash
  };

  const finalProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      deploymentEvents: replaceAutomationMetaEvent(existingEvents, nextMeta) as Prisma.InputJsonValue
    },
    include: projectInclude
  });

  return mapProject(finalProject);
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

export async function appendDeploymentEvent(
  projectId: string,
  event: Omit<DeploymentEvent, 'id' | 'createdAt'>
): Promise<AdminAssetRecord | null> {
  const existing = await getAdminAsset(projectId);
  if (!existing) {
    return null;
  }

  const auditHash =
    event.auditHash ??
    (await auditHashJson({
      projectId,
      step: event.step,
      status: event.status,
      message: event.message,
      txHash: event.txHash,
      address: event.address,
      externalId: event.externalId
    }));
  const deploymentEvents: DeploymentEvent[] = [
    {
      id: `${event.step.toLowerCase()}-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      ...event,
      auditHash
    },
    ...existing.deploymentEvents
  ].slice(0, 50);

  return updateAdminAsset(projectId, { deploymentEvents });
}

export async function recordAdminAuditLog(input: {
  actorUserId?: string | null;
  action: string;
  targetUserId?: string | null;
  projectId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const auditHash = await auditHashJson(input);
  try {
    return await prisma.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetUserId: input.targetUserId ?? null,
        projectId: input.projectId ?? null,
        metadata: input.metadata ?? {},
        auditHash
      }
    });
  } catch (error) {
    if (input.projectId) {
      await appendDeploymentEvent(input.projectId, {
        step: 'PREFLIGHT',
        status: 'SUCCESS',
        message: `Audit fallback: ${input.action}`,
        auditHash,
        externalId: 'ADMIN_AUDIT_FALLBACK'
      }).catch(() => undefined);
    }
    console.warn('[recordAdminAuditLog] Falling back to deploymentEvents:', error);
    return null;
  }
}

export async function withProjectAutomationLock<T>(
  projectId: string,
  step: string,
  callback: () => Promise<T>,
  ttlMs = 10 * 60 * 1000
): Promise<T> {
  const now = new Date();
  const owner = randomId();
  const existingLock = automationLocks.get(projectId);

  if (existingLock && existingLock.expiresAt > now.getTime()) {
    throw new Error('AUTOMATION_LOCKED');
  }

  automationLocks.set(projectId, {
    owner,
    step,
    expiresAt: now.getTime() + ttlMs
  });
  await updateAdminAsset(projectId, {
    automationLockStep: step,
    automationLockExpiresAt: new Date(now.getTime() + ttlMs)
  }).catch(() => undefined);

  try {
    return await callback();
  } finally {
    const current = automationLocks.get(projectId);
    if (current?.owner === owner) {
      automationLocks.delete(projectId);
    }
    await updateAdminAsset(projectId, {
      automationLockStep: null,
      automationLockExpiresAt: null
    }).catch(() => undefined);
  }
}

export async function noteAutomationFailure(projectId: string, reason: string) {
  const existing = await getAdminAsset(projectId);
  if (!existing) return null;
  const nextCount = existing.automationFailureCount + 1;
  const event: DeploymentEvent = {
    id: `automation-failure-${Date.now().toString(36)}`,
    step: 'CIRCUIT_BREAKER',
    status: nextCount >= 5 ? 'FAILED' : 'PENDING',
    message:
      nextCount >= 5
        ? `Circuit breaker activado después de ${nextCount} fallos. Último error: ${reason}`
        : `Fallo automático ${nextCount}/5: ${reason}`,
    createdAt: new Date().toISOString()
  };
  return updateAdminAsset(projectId, {
    automationFailureCount: nextCount,
    automationCircuitBreaker: nextCount >= 5 || existing.automationCircuitBreaker,
    deploymentEvents: [
      event,
      ...existing.deploymentEvents
    ].slice(0, 50)
  });
}

export async function clearAutomationFailures(projectId: string) {
  return updateAdminAsset(projectId, {
    automationFailureCount: 0,
    automationCircuitBreaker: false
  });
}

export async function deleteAdminAsset(
  projectId: string
): Promise<{ ok: true } | { ok: false; code: 'NOT_FOUND' | 'ASSET_PUBLISHED' | 'ACTIVE_INVESTMENTS' }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      isActive: true,
      _count: { select: { investments: { where: { status: 'ACTIVE' } } } }
    }
  });

  if (!project) {
    return { ok: false, code: 'NOT_FOUND' };
  }

  if (project.isActive) {
    return { ok: false, code: 'ASSET_PUBLISHED' };
  }

  if (project._count.investments > 0) {
    return { ok: false, code: 'ACTIVE_INVESTMENTS' };
  }

  await prisma.project.delete({ where: { id: projectId } });
  return { ok: true };
}
