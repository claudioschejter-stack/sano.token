import { prisma } from '@sanova/database';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';
import { readVaultPosition } from '../portfolio/onChainVaultReader';
import {
  compareHolding,
  reconcileProjectSupplyMath,
  sharesToTokens,
  type ProjectSupplyReconciliation,
  type ReconcileStatus
} from './tokenReconciliationMath';
import { readVaultShareMovements, readVaultSupplyAndBalance, type VaultShareMovement } from './vaultShareMovements';

export type InvestorHoldingReconciliation = {
  projectId: string;
  projectTitle: string;
  vaultAddress: string | null;
  walletAddress: string | null;
  bookedTokens: number;
  onChainShares: string | null;
  onChainTokens: number | null;
  deltaTokens: number | null;
  status: ReconcileStatus;
  /** Vault share delivery hashes recorded on the payment intents. */
  deliveryTxHashes: string[];
  /** Payments confirmed but with shares not delivered yet. */
  pendingDeliveries: number;
};

export type InvestorReconciliationReport = {
  userId: string;
  email: string | null;
  walletAddress: string | null;
  holdings: InvestorHoldingReconciliation[];
  totals: { bookedTokens: number; onChainTokens: number | null };
  issues: string[];
};

function collectDeliveryHashes(metadataRows: Array<Record<string, unknown>>): {
  hashes: string[];
  pending: number;
} {
  const hashes = new Set<string>();
  let pending = 0;

  for (const metadata of metadataRows) {
    const hash = metadata.vaultShareDeliveryTxHash;
    if (typeof hash === 'string' && hash.startsWith('0x')) {
      hashes.add(hash);
      continue;
    }
    if (metadata.purchaseMode === 'ERC4626_DEPOSIT') {
      pending += 1;
    }
  }

  return { hashes: [...hashes], pending };
}

/** DB holdings vs on-chain vault shares for one investor, per project. */
export async function reconcileInvestorHoldings(
  userId: string
): Promise<InvestorReconciliationReport> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      investor: {
        select: {
          walletAddress: true,
          investments: {
            where: { status: 'ACTIVE' },
            select: {
              tokenCount: true,
              projectId: true,
              project: { select: { title: true, vaultAddress: true, chainId: true } }
            }
          }
        }
      }
    }
  });

  const walletAddress = user?.investor?.walletAddress?.trim() || null;
  const investments = user?.investor?.investments ?? [];

  const byProject = new Map<
    string,
    { title: string; vaultAddress: string | null; chainId: number | null; bookedTokens: number }
  >();
  for (const investment of investments) {
    const current = byProject.get(investment.projectId) ?? {
      title: investment.project.title,
      vaultAddress: investment.project.vaultAddress,
      chainId: investment.project.chainId,
      bookedTokens: 0
    };
    current.bookedTokens += investment.tokenCount;
    byProject.set(investment.projectId, current);
  }

  const confirmedIntents = await prisma.paymentIntent.findMany({
    where: { userId, status: 'CONFIRMED' },
    select: { projectId: true, metadata: true }
  });

  const holdings: InvestorHoldingReconciliation[] = [];
  const issues: string[] = [];
  let onChainTotal: number | null = 0;

  for (const [projectId, row] of byProject.entries()) {
    const metadataRows = confirmedIntents
      .filter((intent) => intent.projectId === projectId)
      .map((intent) => (intent.metadata as Record<string, unknown>) ?? {});
    const { hashes, pending } = collectDeliveryHashes(metadataRows);

    let onChainShares: string | null = null;
    if (row.vaultAddress && walletAddress) {
      const position = await readVaultPosition({
        walletAddress,
        vaultAddress: row.vaultAddress,
        chainId: row.chainId
      });
      onChainShares = position?.shares ?? null;
    }

    const onChainTokens = sharesToTokens(onChainShares);
    const { status, deltaTokens } = compareHolding({
      bookedTokens: row.bookedTokens,
      onChainTokens
    });

    if (onChainTokens === null) {
      onChainTotal = null;
    } else if (onChainTotal !== null) {
      onChainTotal += onChainTokens;
    }

    if (status === 'SHORT_ONCHAIN') {
      issues.push(
        `${row.title}: booked ${row.bookedTokens} token(s) but wallet holds ${onChainTokens ?? '?'} — share delivery incomplete.`
      );
    }
    if (status === 'EXTRA_ONCHAIN') {
      issues.push(
        `${row.title}: wallet holds ${onChainTokens ?? '?'} token(s) but only ${row.bookedTokens} booked — untracked transfer in.`
      );
    }
    if (pending > 0) {
      issues.push(`${row.title}: ${pending} confirmed payment(s) without a share delivery tx.`);
    }

    holdings.push({
      projectId,
      projectTitle: row.title,
      vaultAddress: row.vaultAddress,
      walletAddress,
      bookedTokens: row.bookedTokens,
      onChainShares,
      onChainTokens,
      deltaTokens,
      status,
      deliveryTxHashes: hashes,
      pendingDeliveries: pending
    });
  }

  return {
    userId,
    email: user?.email ?? null,
    walletAddress,
    holdings: holdings.sort((a, b) => b.bookedTokens - a.bookedTokens),
    totals: {
      bookedTokens: holdings.reduce((sum, row) => sum + row.bookedTokens, 0),
      onChainTokens: onChainTotal === null ? null : Number(onChainTotal.toFixed(6))
    },
    issues
  };
}

export type ProjectReconciliationReport = ProjectSupplyReconciliation & {
  projectId: string;
  projectTitle: string;
  vaultAddress: string | null;
  treasuryAddress: string | null;
  investorCount: number;
  movements?: VaultShareMovement[];
  issues: string[];
};

/** Supply reconciliation for one project: availability vs investments vs chain. */
export async function reconcileProjectSupply(input: {
  projectId: string;
  includeMovements?: boolean;
}): Promise<ProjectReconciliationReport> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true,
      title: true,
      totalTokens: true,
      availableTokens: true,
      vaultAddress: true
    }
  });
  if (!project) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  const investments = await prisma.investment.findMany({
    where: { projectId: project.id, status: 'ACTIVE' },
    select: { tokenCount: true, investorId: true }
  });
  const bookedByInvestments = investments.reduce((sum, row) => sum + row.tokenCount, 0);
  const investorCount = new Set(investments.map((row) => row.investorId)).size;

  const treasuryAddress = resolveTreasuryAddress(
    process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() || null
  );

  let totalSupplyShares: string | null = null;
  let treasuryShares: string | null = null;
  if (project.vaultAddress) {
    const supply = await readVaultSupplyAndBalance({
      vaultAddress: project.vaultAddress,
      holderAddress: treasuryAddress
    });
    totalSupplyShares = supply.totalSupplyShares;
    treasuryShares = supply.holderShares;
  }

  const math = reconcileProjectSupplyMath({
    totalTokens: project.totalTokens,
    availableTokens: project.availableTokens,
    bookedByInvestments,
    vaultTotalSupplyShares: totalSupplyShares,
    treasuryShares
  });

  const issues: string[] = [];
  if (math.supplyStatus === 'SHORT_ONCHAIN') {
    issues.push(
      `availableTokens says ${math.soldByAvailability} sold but investments book ${bookedByInvestments} — ${math.supplyDeltaTokens} token(s) reserved without a confirmed purchase.`
    );
  }
  if (math.supplyStatus === 'EXTRA_ONCHAIN') {
    issues.push(
      `investments book ${bookedByInvestments} token(s) but availableTokens only reflects ${math.soldByAvailability} — supply was not decremented.`
    );
  }
  if (math.onChainStatus === 'SHORT_ONCHAIN') {
    issues.push(
      `investors hold ${math.investorTokensOnChain} token(s) on-chain vs ${bookedByInvestments} booked — pending share deliveries.`
    );
  }
  if (math.onChainStatus === 'EXTRA_ONCHAIN') {
    issues.push(
      `investors hold ${math.investorTokensOnChain} token(s) on-chain vs ${bookedByInvestments} booked — untracked deliveries.`
    );
  }

  let movements: VaultShareMovement[] | undefined;
  if (input.includeMovements && project.vaultAddress) {
    const labels: Record<string, string> = {};
    if (treasuryAddress) labels[treasuryAddress.toLowerCase()] = 'treasury';
    movements = await readVaultShareMovements({
      vaultAddress: project.vaultAddress,
      labels
    }).catch((error) => {
      issues.push(`movement log unavailable: ${error instanceof Error ? error.message : 'RPC'}`);
      return undefined;
    });
  }

  return {
    ...math,
    projectId: project.id,
    projectTitle: project.title,
    vaultAddress: project.vaultAddress,
    treasuryAddress,
    investorCount,
    movements,
    issues
  };
}
