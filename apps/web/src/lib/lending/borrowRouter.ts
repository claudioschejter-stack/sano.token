import { fetchLiveBorrowRates } from './fetchLiveBorrowRates';
import {
  getLendingChainConfig,
  isExecutableBorrowProtocol,
  isWethCollateralProtocol,
  listExecutableProtocolsForChain,
  type WethCollateralProtocol
} from './baseContracts';
import {
  ethToWei,
  prepareAaveBorrowUsdc,
  prepareAaveSupplyWeth,
  usdcToBaseUnits,
  type PreparedTransaction
} from './protocols/aaveBorrow';
import {
  buildDefaultMorphoMarketParams,
  prepareMorphoBorrowUsdc
} from './protocols/morphoBorrow';
import { prepareCompoundWethCollateralBorrow } from './protocols/compoundBorrow';
import { prepareMoonwellWethCollateralBorrow } from './protocols/moonwellBorrow';
import { prepareSparkBorrowUsdc, prepareSparkSupplyWeth } from './protocols/sparkBorrow';
import { planMorphoBorrowTransactions, previewMorphoBorrow } from './morphoBorrowPlanner';
import { getAdminAsset } from '../admin/assetsService';
import { allowedExternalContracts, borrowSafetyBps, maxBorrowUsdPerProject } from '../blockchain/securityPolicy';

export type BorrowQuoteRequest = {
  amountUsd: number;
  collateralEth?: number;
  walletAddress: string;
  projectId?: string;
  vaultAddress?: string;
  preferProtocol?: string;
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
  transactions: PreparedTransaction[];
  marketId?: string;
};

const DEFAULT_COLLATERAL_ETH = 0.1;

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

function resolveCollateralEth(collateralEth?: number): number {
  if (collateralEth != null && Number.isFinite(collateralEth) && collateralEth > 0) {
    return collateralEth;
  }
  return DEFAULT_COLLATERAL_ETH;
}

function prepareWethCollateralBorrow(
  protocol: WethCollateralProtocol,
  amountUsd: number,
  collateralEth: number,
  walletAddress: string
): PreparedTransaction[] | null {
  const amountBaseUnits = usdcToBaseUnits(amountUsd);
  const collateralWei = ethToWei(collateralEth);

  switch (protocol) {
    case 'aave': {
      const transactions: PreparedTransaction[] = [];
      transactions.push(prepareAaveSupplyWeth(collateralWei, walletAddress));
      transactions.push(prepareAaveBorrowUsdc(amountBaseUnits, walletAddress));
      return transactions;
    }
    case 'spark': {
      const supply = prepareSparkSupplyWeth(collateralWei, walletAddress);
      const borrow = prepareSparkBorrowUsdc(amountBaseUnits, walletAddress);
      if (!supply || !borrow) {
        return null;
      }
      return [supply, borrow];
    }
    case 'moonwell':
      return prepareMoonwellWethCollateralBorrow(collateralWei, amountBaseUnits);
    case 'compound':
      return prepareCompoundWethCollateralBorrow(collateralWei, amountBaseUnits);
    default:
      return null;
  }
}

export async function quoteBorrow(request: BorrowQuoteRequest): Promise<BorrowQuoteResponse | null> {
  if (!Number.isFinite(request.amountUsd) || request.amountUsd <= 0) {
    return null;
  }

  const chainConfig = getLendingChainConfig();
  const rates = await fetchLiveBorrowRates();
  const executable = rates.quotes.filter((quote) => isExecutableBorrowProtocol(quote.id, chainConfig));

  if (executable.length === 0) {
    return null;
  }

  let selected = executable[0];

  if (request.preferProtocol && isExecutableBorrowProtocol(request.preferProtocol, chainConfig)) {
    const preferred = executable.find((quote) => quote.id === request.preferProtocol);
    if (preferred) {
      selected = preferred;
    }
  } else if (request.vaultAddress && executable.some((q) => q.id === 'morpho')) {
    const morpho = executable.find((q) => q.id === 'morpho');
    if (morpho) {
      selected = morpho;
    }
  }

  return {
    protocol: selected.id,
    protocolName: selected.name,
    borrowApyBps: selected.borrowApyBps,
    amountUsd: request.amountUsd,
    chainId: chainConfig.chainId,
    source: selected.source ?? 'borrow-router'
  };
}

export async function prepareBorrow(request: BorrowQuoteRequest): Promise<PrepareBorrowResponse | null> {
  const quote = await quoteBorrow(request);
  if (!quote) {
    return null;
  }

  const amountBaseUnits = usdcToBaseUnits(request.amountUsd);
  const chainConfig = getLendingChainConfig();
  const { chainId } = chainConfig;

  if (quote.protocol === 'morpho') {
    const vault = request.vaultAddress?.trim();
    if (!vault) {
      return null;
    }

    if (!request.projectId) {
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

    if (planned) {
      return {
        protocol: 'morpho',
        chainId,
        transactions: planned.transactions,
        marketId: planned.marketId
      };
    }

    const marketParams = buildDefaultMorphoMarketParams(vault, oracleAddress);
    if (!marketParams) {
      return null;
    }
    const allowedContracts = new Set(allowedExternalContracts());
    const requiredContracts = [
      marketParams.loanToken,
      marketParams.oracle,
      marketParams.irm,
      chainConfig.morpho
    ].map((address) => address.toLowerCase());
    if (requiredContracts.some((address) => !allowedContracts.has(address))) {
      return null;
    }

    const tx = prepareMorphoBorrowUsdc(
      marketParams,
      amountBaseUnits,
      request.walletAddress,
      request.walletAddress
    );

    return {
      protocol: 'morpho',
      chainId,
      transactions: [tx],
      marketId: tx.marketId
    };
  }

  if (isWethCollateralProtocol(quote.protocol)) {
    const collateralEth = resolveCollateralEth(request.collateralEth);
    const transactions = prepareWethCollateralBorrow(
      quote.protocol,
      request.amountUsd,
      collateralEth,
      request.walletAddress
    );

    if (!transactions || transactions.length === 0) {
      return null;
    }

    return {
      protocol: quote.protocol,
      chainId,
      transactions
    };
  }

  return null;
}

export function listExecutableProtocols(): string[] {
  return [...listExecutableProtocolsForChain()];
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
