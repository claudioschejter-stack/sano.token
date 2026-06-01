import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { parseCollateralTargets } from '../admin/launchTypes';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import { getLendingChainConfig } from '../lending/baseContracts';
import {
  buildDefaultMorphoMarketParams,
  morphoMarketId,
  type MorphoMarketParams
} from '../lending/protocols/morphoBorrow';

const MORPHO_DEBT_ABI = [
  'function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)',
  'function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)'
];

export type MorphoDebtProjectInput = {
  projectId?: string;
  projectTitle?: string;
  vaultAddress: string | null;
  collateralTargets: unknown;
};

export type MorphoBorrowPosition = {
  projectId: string | null;
  projectTitle: string | null;
  vaultAddress: string;
  marketId: string;
  marketParams: MorphoMarketParams;
  debtUsd: number;
  debtAssets: string;
  borrowShares: string;
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

function borrowAssetsFromShares(
  borrowShares: bigint,
  totalBorrowAssets: bigint,
  totalBorrowShares: bigint
): bigint {
  if (borrowShares <= 0n || totalBorrowShares <= 0n) {
    return 0n;
  }
  return (borrowShares * totalBorrowAssets) / totalBorrowShares;
}

export async function readMorphoBorrowPositions(input: {
  walletAddress: string | null | undefined;
  projects: MorphoDebtProjectInput[];
}): Promise<MorphoBorrowPosition[]> {
  const wallet = input.walletAddress?.trim();
  if (!wallet || input.projects.length === 0) {
    return [];
  }

  const chainId = resolveMorphoChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const morpho = new Contract(getLendingChainConfig().morpho, MORPHO_DEBT_ABI, provider);
  const seenMarketIds = new Set<string>();
  const positions: MorphoBorrowPosition[] = [];

  try {
    for (const project of input.projects) {
      const vault = project.vaultAddress?.trim();
      if (!vault) {
        continue;
      }

      const morphoTarget = parseCollateralTargets(project.collateralTargets).find(
        (target) => target.protocol === 'MORPHO'
      );
      const marketParams = buildDefaultMorphoMarketParams(vault, morphoTarget?.oracleAddress);
      if (!marketParams) {
        continue;
      }

      const marketId = morphoMarketId(marketParams);
      if (seenMarketIds.has(marketId)) {
        continue;
      }
      seenMarketIds.add(marketId);

      const position = await morpho.position(marketId, wallet);
      const borrowShares = BigInt(position.borrowShares ?? position[1] ?? 0);
      if (borrowShares <= 0n) {
        continue;
      }

      const market = await morpho.market(marketId);
      const totalBorrowAssets = BigInt(market.totalBorrowAssets ?? market[2] ?? 0);
      const totalBorrowShares = BigInt(market.totalBorrowShares ?? market[3] ?? 0);
      const borrowAssets = borrowAssetsFromShares(borrowShares, totalBorrowAssets, totalBorrowShares);
      const debtUsd = Math.round(Number(formatUnits(borrowAssets, 6)) * 100) / 100;

      positions.push({
        projectId: project.projectId ?? null,
        projectTitle: project.projectTitle ?? null,
        vaultAddress: vault,
        marketId,
        marketParams,
        debtUsd,
        debtAssets: borrowAssets.toString(),
        borrowShares: borrowShares.toString()
      });
    }
  } catch (error) {
    console.error('[readMorphoBorrowPositions]', error);
    return [];
  } finally {
    provider.destroy();
  }

  return positions;
}

export async function readMorphoOnChainDebtUsd(input: {
  walletAddress: string | null | undefined;
  projects: MorphoDebtProjectInput[];
}): Promise<number> {
  const positions = await readMorphoBorrowPositions(input);
  return Math.round(positions.reduce((sum, row) => sum + row.debtUsd, 0) * 100) / 100;
}
