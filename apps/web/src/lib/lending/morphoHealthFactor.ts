import { Contract, JsonRpcProvider } from 'ethers';
import { getLendingChainConfig } from './baseContracts';
import { buildDefaultMorphoMarketParams, morphoMarketId } from './protocols/morphoBorrow';

const MORPHO_POSITION_ABI = [
  'function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)'
];

const MORPHO_MARKET_ABI = [
  'function expectedMarketBalances((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams) view returns (uint256 totalSupplyAssets,uint256 totalSupplyShares,uint256 totalBorrowAssets,uint256 totalBorrowShares)'
];

const ORACLE_ABI = ['function price() view returns (uint256)'];

export type MorphoHealthSnapshot = {
  healthFactor: number;
  borrowCapacityUsd: number;
  debtUsd: number;
  collateralUsd: number;
  lltvRatio: number;
  liquidationThreshold: number;
  marketId: string | null;
  ready: boolean;
  message?: string;
};

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return (
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      process.env.BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
    );
  }
  return process.env.BASE_SEPOLIA_RPC_URL?.trim() || 'https://sepolia.base.org';
}

function lltvBps(): number {
  const raw = Number(process.env.MORPHO_DEFAULT_LLTV_BPS ?? '6250');
  return Number.isFinite(raw) && raw > 0 ? raw : 6250;
}

/** Health factor ≈ (collateralUsd × LLTV) / debtUsd. >1 safe; ≤1 liquidation risk. */
export async function computeMorphoHealthFactor(input: {
  walletAddress: string;
  vaultAddress: string;
  oracleAddress?: string | null;
}): Promise<MorphoHealthSnapshot> {
  const chainConfig = getLendingChainConfig();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainConfig.chainId));

  const marketParams = buildDefaultMorphoMarketParams(input.vaultAddress, input.oracleAddress);
  if (!marketParams) {
    return {
      healthFactor: 0,
      borrowCapacityUsd: 0,
      debtUsd: 0,
      collateralUsd: 0,
      lltvRatio: lltvBps() / 10_000,
      liquidationThreshold: lltvBps() / 10_000,
      marketId: null,
      ready: false,
      message: 'Morpho market not configured (oracle missing)'
    };
  }

  const morpho = new Contract(chainConfig.morpho, MORPHO_POSITION_ABI, provider);
  const marketId = morphoMarketId(marketParams);
  const position = (await morpho.position(marketId, input.walletAddress)) as [
    bigint,
    bigint,
    bigint
  ];

  const [, borrowShares, collateral] = position;
  if (collateral <= 0n && borrowShares <= 0n) {
    return {
      healthFactor: Infinity,
      borrowCapacityUsd: 0,
      debtUsd: 0,
      collateralUsd: 0,
      lltvRatio: lltvBps() / 10_000,
      liquidationThreshold: lltvBps() / 10_000,
      marketId,
      ready: true,
      message: 'No open Morpho position'
    };
  }

  const oracle = new Contract(marketParams.oracle, ORACLE_ABI, provider);
  const priceRaw = (await oracle.price()) as bigint;
  const collateralUsd = Number(collateral * priceRaw) / 1e36;

  const morphoMarket = new Contract(chainConfig.morpho, MORPHO_MARKET_ABI, provider);
  const balances = (await morphoMarket.expectedMarketBalances([
    marketParams.loanToken,
    marketParams.collateralToken,
    marketParams.oracle,
    marketParams.irm,
    marketParams.lltv
  ])) as [bigint, bigint, bigint, bigint];

  const [, , totalBorrowAssets, totalBorrowShares] = balances;
  const debtUsd =
    totalBorrowShares > 0n
      ? Number((borrowShares * totalBorrowAssets) / totalBorrowShares) / 1e6
      : 0;

  const lltv = lltvBps() / 10_000;
  const borrowCapacityUsd = collateralUsd * lltv;
  const healthFactor = debtUsd > 0 ? borrowCapacityUsd / debtUsd : Infinity;

  return {
    healthFactor: Number.isFinite(healthFactor) ? healthFactor : 999,
    borrowCapacityUsd,
    debtUsd,
    collateralUsd,
    lltvRatio: lltv,
    liquidationThreshold: lltv,
    marketId,
    ready: true
  };
}
