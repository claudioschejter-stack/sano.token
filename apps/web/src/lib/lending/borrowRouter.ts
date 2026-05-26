import { fetchLiveBorrowRates } from './fetchLiveBorrowRates';
import {
  EXECUTABLE_BORROW_PROTOCOLS,
  getLendingChainConfig,
  isExecutableBorrowProtocol
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
import { getAdminAsset } from '../admin/assetsService';

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

  const rates = await fetchLiveBorrowRates();
  const executable = rates.quotes.filter((quote) => isExecutableBorrowProtocol(quote.id));

  if (executable.length === 0) {
    return null;
  }

  let selected = executable[0];
  if (request.preferProtocol && isExecutableBorrowProtocol(request.preferProtocol)) {
    const preferred = executable.find((quote) => quote.id === request.preferProtocol);
    if (preferred) {
      selected = preferred;
    }
  }

  if (request.vaultAddress && rates.quotes.some((q) => q.id === 'morpho')) {
    const morpho = rates.quotes.find((q) => q.id === 'morpho');
    if (morpho) {
      selected = morpho;
    }
  }

  const { chainId } = getLendingChainConfig();

  return {
    protocol: selected.id,
    protocolName: selected.name,
    borrowApyBps: selected.borrowApyBps,
    amountUsd: request.amountUsd,
    chainId,
    source: selected.source ?? 'borrow-router'
  };
}

export async function prepareBorrow(request: BorrowQuoteRequest): Promise<PrepareBorrowResponse | null> {
  const quote = await quoteBorrow(request);
  if (!quote) {
    return null;
  }

  const amountBaseUnits = usdcToBaseUnits(request.amountUsd);
  const { chainId } = getLendingChainConfig();

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

    const oracleAddress = await resolveMorphoOracleAddress(request.projectId);
    const marketParams = buildDefaultMorphoMarketParams(vault, oracleAddress);
    if (!marketParams) {
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

  const transactions: PreparedTransaction[] = [];

  if (request.collateralEth && request.collateralEth > 0) {
    transactions.push(
      prepareAaveSupplyWeth(ethToWei(request.collateralEth), request.walletAddress)
    );
  }

  transactions.push(prepareAaveBorrowUsdc(amountBaseUnits, request.walletAddress));

  return {
    protocol: 'aave',
    chainId,
    transactions
  };
}

export function listExecutableProtocols(): string[] {
  return [...EXECUTABLE_BORROW_PROTOCOLS];
}
