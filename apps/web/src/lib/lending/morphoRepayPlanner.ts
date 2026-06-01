import { Contract, JsonRpcProvider, MaxUint256 } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import { getLendingChainConfig } from './baseContracts';
import {
  buildDefaultMorphoMarketParams,
  morphoMarketId,
  type MorphoMarketParams
} from './protocols/morphoBorrow';
import type { PreparedTransaction } from './protocols/aaveBorrow';
import { readMorphoBorrowPositions } from '../portfolio/onChainMorphoDebtReader';

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return (
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      process.env.BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
    );
  }
  return process.env.BASE_SEPOLIA_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
}

function usdcToBaseUnits(amountUsd: number): bigint {
  return BigInt(Math.round(amountUsd * 1_000_000));
}

function encodeApprove(token: string, spender: string, amount: bigint): PreparedTransaction {
  const iface = new Contract(token, ERC20_ABI).interface;
  return {
    to: token,
    data: iface.encodeFunctionData('approve', [spender, amount]),
    value: '0',
    description: 'Approve USDC for Morpho repay'
  };
}

function encodeRepay(
  params: MorphoMarketParams,
  assets: bigint,
  onBehalf: string
): PreparedTransaction {
  const { morpho } = getLendingChainConfig();
  const iface = new Contract(
    morpho,
    ['function repay((address,address,address,address,uint256),uint256,uint256,address,bytes)']
  ).interface;

  return {
    to: morpho,
    data: iface.encodeFunctionData('repay', [
      [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv],
      assets,
      0,
      onBehalf,
      '0x'
    ]),
    value: '0',
    description: 'Repay USDC on Morpho Blue'
  };
}

export type MorphoRepayPreview = {
  chainId: number;
  projectId: string;
  vaultAddress: string;
  marketId: string;
  debtUsd: number;
  maxRepayUsd: number;
  suggestedRepayUsd: number;
  ready: boolean;
  message?: string;
};

export async function previewMorphoRepay(input: {
  asset: AdminAssetRecord;
  walletAddress: string;
  amountUsd?: number;
  oracleAddress?: string | null;
}): Promise<MorphoRepayPreview | null> {
  const vault = input.asset.vaultAddress?.trim();
  if (!vault) {
    return null;
  }

  const positions = await readMorphoBorrowPositions({
    walletAddress: input.walletAddress,
    projects: [
      {
        projectId: input.asset.id,
        projectTitle: input.asset.title,
        vaultAddress: vault,
        collateralTargets: input.asset.collateralTargets
      }
    ]
  });

  const position = positions.find((row) => row.vaultAddress.toLowerCase() === vault.toLowerCase());
  if (!position || position.debtUsd <= 0) {
    return {
      chainId: resolveMorphoChainId(),
      projectId: input.asset.id,
      vaultAddress: vault,
      marketId: position?.marketId ?? '',
      debtUsd: 0,
      maxRepayUsd: 0,
      suggestedRepayUsd: 0,
      ready: false,
      message: 'No hay préstamo Morpho activo para este activo.'
    };
  }

  const maxRepayUsd = position.debtUsd;
  const requested = input.amountUsd && input.amountUsd > 0 ? input.amountUsd : maxRepayUsd;
  const suggestedRepayUsd = Math.min(requested, maxRepayUsd);

  return {
    chainId: resolveMorphoChainId(),
    projectId: input.asset.id,
    vaultAddress: vault,
    marketId: position.marketId,
    debtUsd: maxRepayUsd,
    maxRepayUsd,
    suggestedRepayUsd: Math.round(suggestedRepayUsd * 100) / 100,
    ready: suggestedRepayUsd > 0
  };
}

export async function planMorphoRepayTransactions(input: {
  asset: AdminAssetRecord;
  walletAddress: string;
  amountUsd: number;
  oracleAddress?: string | null;
}): Promise<{ transactions: PreparedTransaction[]; marketId: string; repayAssets: string } | null> {
  const vault = input.asset.vaultAddress?.trim();
  if (!vault || input.amountUsd <= 0) {
    return null;
  }

  const preview = await previewMorphoRepay({
    asset: input.asset,
    walletAddress: input.walletAddress,
    amountUsd: input.amountUsd,
    oracleAddress: input.oracleAddress
  });

  if (!preview?.ready || preview.suggestedRepayUsd <= 0) {
    return null;
  }

  const marketParams = buildDefaultMorphoMarketParams(vault, input.oracleAddress);
  if (!marketParams) {
    return null;
  }

  const repayAssets = usdcToBaseUnits(preview.suggestedRepayUsd);
  const chainId = resolveMorphoChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const transactions: PreparedTransaction[] = [];

  try {
    const { usdc, morpho } = getLendingChainConfig();
    const token = new Contract(usdc, ERC20_ABI, provider);
    const allowance = (await token.allowance(input.walletAddress, morpho)) as bigint;

    if (allowance < repayAssets) {
      transactions.push(encodeApprove(usdc, morpho, MaxUint256));
    }

    transactions.push(encodeRepay(marketParams, repayAssets, input.walletAddress));

    return {
      transactions,
      marketId: morphoMarketId(marketParams),
      repayAssets: repayAssets.toString()
    };
  } finally {
    provider.destroy();
  }
}
