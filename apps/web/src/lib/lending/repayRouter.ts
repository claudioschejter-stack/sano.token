import { getAdminAsset } from '../admin/assetsService';
import { getLinkedWalletForUser, resolveInvestorLinkedWallet } from '../investor/linkedWalletPolicy';
import { resolveMorphoDebtPositionsForUser } from '../portfolio/morphoDebtForUser';
import { getLendingChainConfig } from './baseContracts';
import { planMorphoRepayTransactions, previewMorphoRepay } from './morphoRepayPlanner';
import type { PreparedTransaction } from './preparedTransaction';

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
  const [positions, linkedWallet] = await Promise.all([
    resolveMorphoDebtPositionsForUser(userId),
    getLinkedWalletForUser(userId)
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
    walletAddress: linkedWallet
  };
}

export async function prepareMorphoRepay(input: {
  userId: string;
  projectId: string;
  walletAddress: string;
  amountUsd: number;
}): Promise<PrepareRepayResponse | null> {
  const linkedWallet = await resolveInvestorLinkedWallet(input.userId, input.walletAddress);

  const asset = await getAdminAsset(input.projectId);
  if (!asset?.vaultAddress) {
    return null;
  }

  const oracleAddress = await resolveMorphoOracleAddress(input.projectId);
  const planned = await planMorphoRepayTransactions({
    asset,
    walletAddress: linkedWallet,
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
