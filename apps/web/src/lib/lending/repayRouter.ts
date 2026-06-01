import { prisma } from '@sanova/database';
import { getAdminAsset } from '../admin/assetsService';
import { resolveMorphoDebtPositionsForUser } from '../portfolio/morphoDebtForUser';
import { getLendingChainConfig } from './baseContracts';
import { planMorphoRepayTransactions, previewMorphoRepay } from './morphoRepayPlanner';
import type { PreparedTransaction } from './protocols/aaveBorrow';

export type MorphoRepayPositionSummary = {
  projectId: string | null;
  projectTitle: string | null;
  vaultAddress: string;
  marketId: string;
  debtUsd: number;
};

export type RepayPreviewResponse = {
  chainId: number;
  totalDebtUsd: number;
  positions: MorphoRepayPositionSummary[];
  walletAddress: string | null;
};

export type PrepareRepayResponse = {
  chainId: number;
  transactions: PreparedTransaction[];
  marketId: string;
  repayAssets: string;
};

async function resolveMorphoOracleAddress(projectId: string): Promise<string | null> {
  const asset = await getAdminAsset(projectId);
  const morphoTarget = asset?.collateralTargets.find(
    (target) => target.protocol === 'MORPHO' && target.status === 'REGISTERED'
  );
  return morphoTarget?.oracleAddress ?? null;
}

export async function previewMorphoRepayForUser(userId: string): Promise<RepayPreviewResponse> {
  const [positions, user] = await Promise.all([
    resolveMorphoDebtPositionsForUser(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { investor: { select: { walletAddress: true } } }
    })
  ]);

  const summaries: MorphoRepayPositionSummary[] = positions.map((row) => ({
    projectId: row.projectId,
    projectTitle: row.projectTitle,
    vaultAddress: row.vaultAddress,
    marketId: row.marketId,
    debtUsd: row.debtUsd
  }));

  return {
    chainId: getLendingChainConfig().chainId,
    totalDebtUsd: Math.round(summaries.reduce((sum, row) => sum + row.debtUsd, 0) * 100) / 100,
    positions: summaries,
    walletAddress: user?.investor?.walletAddress ?? null
  };
}

export async function prepareMorphoRepay(input: {
  userId: string;
  projectId: string;
  walletAddress: string;
  amountUsd: number;
}): Promise<PrepareRepayResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { investor: { select: { walletAddress: true } } }
  });

  const registeredWallet = user?.investor?.walletAddress?.trim().toLowerCase();
  if (registeredWallet && registeredWallet !== input.walletAddress.trim().toLowerCase()) {
    return null;
  }

  const asset = await getAdminAsset(input.projectId);
  if (!asset?.vaultAddress) {
    return null;
  }

  const oracleAddress = await resolveMorphoOracleAddress(input.projectId);
  const planned = await planMorphoRepayTransactions({
    asset,
    walletAddress: input.walletAddress,
    amountUsd: input.amountUsd,
    oracleAddress
  });

  if (!planned) {
    return null;
  }

  return {
    chainId: getLendingChainConfig().chainId,
    transactions: planned.transactions,
    marketId: planned.marketId,
    repayAssets: planned.repayAssets
  };
}

export async function previewMorphoRepayForProject(input: {
  projectId: string;
  walletAddress: string;
  amountUsd?: number;
}) {
  const asset = await getAdminAsset(input.projectId);
  if (!asset) {
    return null;
  }

  const oracleAddress = await resolveMorphoOracleAddress(input.projectId);
  return previewMorphoRepay({
    asset,
    walletAddress: input.walletAddress,
    amountUsd: input.amountUsd,
    oracleAddress
  });
}
