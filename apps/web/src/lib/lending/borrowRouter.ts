import { fetchLiveBorrowRates } from './fetchLiveBorrowRates';
import { getLendingChainConfig } from './baseContracts';
import { planMorphoBorrowTransactions, previewMorphoBorrow } from './morphoBorrowPlanner';
import { getAdminAsset } from '../admin/assetsService';
import { borrowSafetyBps, maxBorrowUsdPerProject } from '../blockchain/securityPolicy';

export type BorrowQuoteRequest = {
  amountUsd: number;
  walletAddress: string;
  projectId?: string;
  vaultAddress?: string;
};

export type BorrowQuoteResponse = {
  protocol: string;
  protocolName: string;
  borrowApyBps: number;
  amountUsd: number;
  chainId: number;
  source: string;
};

export type PrepareBorrowResponse = {
  protocol: string;
  chainId: number;
  transactions: Array<{
    to: string;
    data: string;
    value?: string;
    description?: string;
  }>;
  marketId?: string;
};

function maxSafeBorrowUsd(asset: NonNullable<Awaited<ReturnType<typeof getAdminAsset>>>): number {
  const navUsd = asset.totalTokens * asset.pricePerToken;
  const lltvBpsRaw = Number(process.env.MORPHO_DEFAULT_LLTV_BPS ?? '6000');
  const lltvBps = Number.isFinite(lltvBpsRaw) && lltvBpsRaw > 0 ? lltvBpsRaw : 6000;
  return (navUsd * lltvBps * borrowSafetyBps()) / 100_000_000;
}

async function resolveMorphoOracleAddress(projectId?: string): Promise<string | null> {
  if (!projectId) {
    return null;
  }

  const asset = await getAdminAsset(projectId);
  const morphoTarget = asset?.collateralTargets.find(
    (target) => target.protocol === 'MORPHO' && target.status === 'REGISTERED'
  );

  return morphoTarget?.oracleAddress ?? null;
}

export async function quoteBorrow(request: BorrowQuoteRequest): Promise<BorrowQuoteResponse | null> {
  if (!Number.isFinite(request.amountUsd) || request.amountUsd <= 0) {
    return null;
  }

  const chainConfig = getLendingChainConfig();
  const rates = await fetchLiveBorrowRates();
  const morpho = rates.quotes.find((quote) => quote.id === 'morpho');

  if (!morpho) {
    return null;
  }

  return {
    protocol: 'morpho',
    protocolName: morpho.name,
    borrowApyBps: morpho.borrowApyBps,
    amountUsd: request.amountUsd,
    chainId: chainConfig.chainId,
    source: morpho.source ?? 'morpho-base'
  };
}

export async function prepareBorrow(request: BorrowQuoteRequest): Promise<PrepareBorrowResponse | null> {
  const quote = await quoteBorrow(request);
  if (!quote) {
    return null;
  }

  const chainConfig = getLendingChainConfig();
  const vault = request.vaultAddress?.trim();
  if (!vault || !request.projectId) {
    return null;
  }

  const asset = await getAdminAsset(request.projectId);
  if (!asset?.readyToBorrow || asset.vaultAddress?.toLowerCase() !== vault.toLowerCase()) {
    return null;
  }

  const maxDaily = maxBorrowUsdPerProject();
  const maxByLtv = maxSafeBorrowUsd(asset);
  if (request.amountUsd > Math.min(maxDaily, maxByLtv)) {
    return null;
  }

  const oracleAddress = await resolveMorphoOracleAddress(request.projectId);
  const planned = await planMorphoBorrowTransactions({
    asset,
    walletAddress: request.walletAddress,
    amountUsd: request.amountUsd,
    oracleAddress
  });

  if (!planned) {
    return null;
  }

  return {
    protocol: 'morpho',
    chainId: chainConfig.chainId,
    transactions: planned.transactions,
    marketId: planned.marketId
  };
}

export function listExecutableProtocols(): string[] {
  return ['morpho'];
}

export async function previewMorphoBorrowForProject(input: {
  projectId: string;
  walletAddress: string;
  amountUsd?: number;
}) {
  const asset = await getAdminAsset(input.projectId);
  if (!asset) {
    return null;
  }

  const morphoTarget = asset.collateralTargets.find(
    (target) => target.protocol === 'MORPHO' && target.status === 'REGISTERED'
  );

  return previewMorphoBorrow({
    asset,
    walletAddress: input.walletAddress,
    amountUsd: input.amountUsd,
    oracleAddress: morphoTarget?.oracleAddress ?? null
  });
}
