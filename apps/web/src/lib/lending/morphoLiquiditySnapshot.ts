import { Contract, JsonRpcProvider } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import { getLendingChainConfig } from './baseContracts';
import { buildMorphoMarketPoolUrl, buildSanovaBorrowPath } from './morphoMarketUrls';
import { buildDefaultMorphoMarketParams, morphoMarketId } from './protocols/morphoBorrow';

export type MorphoLiquidityMarketRow = {
  projectId: string;
  title: string;
  availableUsdc: number;
  totalSupplyUsdc: number;
  totalBorrowUsdc: number;
  status: 'LIQUID' | 'NO_LIQUIDITY' | 'NO_MARKET' | 'FAILED';
  poolUrl: string | null;
  borrowUrl: string | null;
  marketId: string | null;
  readyToBorrow: boolean;
  cachedStatus: string | null;
};

export type MorphoLiquiditySnapshot = {
  chainId: number;
  totalAvailableUsdc: number;
  markets: MorphoLiquidityMarketRow[];
  updatedAt: string;
};

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return (
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      process.env.BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
    );
  }
  if (chainId === 84532) {
    return process.env.BASE_SEPOLIA_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
  }
  return process.env.LENDING_BASE_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

function baseUnitsToUsdc(value: bigint): number {
  return Number(value) / 1_000_000;
}

export async function readMorphoMarketLiquidity(asset: AdminAssetRecord): Promise<MorphoLiquidityMarketRow> {
  const morphoTarget = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
  const baseRow = {
    projectId: asset.id,
    title: asset.title,
    availableUsdc: 0,
    totalSupplyUsdc: 0,
    totalBorrowUsdc: 0,
    status: 'NO_MARKET' as const,
    poolUrl: morphoTarget?.externalId
      ? buildMorphoMarketPoolUrl(morphoTarget.externalId, asset.tokenSymbol)
      : morphoTarget?.poolUrl ?? null,
    borrowUrl: asset.readyToBorrow ? buildSanovaBorrowPath(asset.id) : null,
    marketId: morphoTarget?.externalId ?? null,
    readyToBorrow: asset.readyToBorrow,
    cachedStatus: asset.morphoLiquidityStatus ?? null
  };

  if (!morphoTarget || !asset.vaultAddress || !morphoTarget.oracleAddress) {
    return baseRow;
  }

  const params = buildDefaultMorphoMarketParams(asset.vaultAddress, morphoTarget.oracleAddress);
  if (!params) {
    return baseRow;
  }

  const chainId = resolveMorphoChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));

  try {
    const morpho = new Contract(
      getLendingChainConfig().morpho,
      [
        'function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)'
      ],
      provider
    );
    const marketId = morphoMarketId(params);
    const market = await morpho.market(marketId);
    const totalSupplyAssets = BigInt(market.totalSupplyAssets ?? market[0] ?? 0);
    const totalBorrowAssets = BigInt(market.totalBorrowAssets ?? market[2] ?? 0);
    const availableAssets =
      totalSupplyAssets > totalBorrowAssets ? totalSupplyAssets - totalBorrowAssets : 0n;
    const availableUsdc = baseUnitsToUsdc(availableAssets);

    return {
      ...baseRow,
      availableUsdc,
      totalSupplyUsdc: baseUnitsToUsdc(totalSupplyAssets),
      totalBorrowUsdc: baseUnitsToUsdc(totalBorrowAssets),
      status: availableAssets > 0n ? 'LIQUID' : 'NO_LIQUIDITY',
      marketId,
      poolUrl: morphoTarget.poolUrl ?? buildMorphoMarketPoolUrl(marketId, asset.tokenSymbol),
      borrowUrl: availableAssets > 0n && asset.readyToBorrow ? buildSanovaBorrowPath(asset.id) : null
    };
  } catch {
    return {
      ...baseRow,
      status: 'FAILED'
    };
  } finally {
    provider.destroy();
  }
}

export async function buildMorphoLiquiditySnapshot(assets: AdminAssetRecord[]): Promise<MorphoLiquiditySnapshot> {
  const morphoAssets = assets.filter(
    (asset) =>
      (asset.tokenStandard === 'ERC4626') &&
      asset.collateralTargets.some((target) => target.protocol === 'MORPHO')
  );

  const markets = await Promise.all(morphoAssets.map((asset) => readMorphoMarketLiquidity(asset)));
  const totalAvailableUsdc = markets.reduce((sum, row) => sum + row.availableUsdc, 0);

  return {
    chainId: resolveMorphoChainId(),
    totalAvailableUsdc: Math.round(totalAvailableUsdc * 100) / 100,
    markets: markets.sort((a, b) => b.availableUsdc - a.availableUsdc),
    updatedAt: new Date().toISOString()
  };
}
