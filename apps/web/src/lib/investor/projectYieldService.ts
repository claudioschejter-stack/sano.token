import { prisma } from '@sanova/database';

const LIQUIDATED_CASH_STATUS = 'LIQUIDATED_CASH';
const APPLIED_TO_MARGIN_STATUS = 'APPLIED_TO_MARGIN';

export type ProjectYieldDistribution = {
  id: string;
  date: string;
  amountUsd: string;
  source: 'DIVIDEND' | 'PAYOUT';
  txHash: string | null;
  concept: string;
};

export type ProjectYieldRow = {
  projectId: string;
  projectTitle: string;
  tokenSymbol: string | null;
  targetYieldPercent: number;
  investedUsd: number;
  tokenCount: number;
  totalReceivedUsd: number;
  dividendCount: number;
  realizedYieldPercent: number | null;
  lastDistributionAt: string | null;
  recentDistributions: ProjectYieldDistribution[];
};

export type ProjectYieldSummary = {
  projects: ProjectYieldRow[];
  totals: {
    investedUsd: number;
    totalReceivedUsd: number;
    weightedTargetYieldPercent: number | null;
    portfolioRealizedYieldPercent: number | null;
  };
};

async function resolveInvestorId(platformUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: platformUserId },
    select: { investorId: true }
  });
  return user?.investorId ?? null;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function resolveProjectIdForAsset(
  assetId: string,
  projects: Array<{ id: string; title: string; tokenSymbol: string | null }>
): string | null {
  const normalizedAsset = normalizeKey(assetId);

  const exactId = projects.find((project) => project.id === assetId);
  if (exactId) {
    return exactId.id;
  }

  const byTitle = projects.find((project) => normalizeKey(project.title) === normalizedAsset);
  if (byTitle) {
    return byTitle.id;
  }

  const bySymbol = projects.find(
    (project) => project.tokenSymbol && normalizeKey(project.tokenSymbol) === normalizedAsset
  );
  if (bySymbol) {
    return bySymbol.id;
  }

  const byPartialTitle = projects.find((project) => {
    const title = normalizeKey(project.title);
    return title.includes(normalizedAsset) || normalizedAsset.includes(title);
  });
  if (byPartialTitle) {
    return byPartialTitle.id;
  }

  return null;
}

export async function getProjectYieldForUser(platformUserId: string): Promise<ProjectYieldSummary> {
  const investorId = await resolveInvestorId(platformUserId);
  if (!investorId) {
    return {
      projects: [],
      totals: {
        investedUsd: 0,
        totalReceivedUsd: 0,
        weightedTargetYieldPercent: null,
        portfolioRealizedYieldPercent: null
      }
    };
  }

  const investments = await prisma.investment.findMany({
    where: { investorId, status: 'ACTIVE' },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          tokenSymbol: true,
          targetYield: true
        }
      }
    },
    orderBy: { purchasedAt: 'desc' }
  });

  const projectMeta = investments.map((investment) => ({
    id: investment.project.id,
    title: investment.project.title,
    tokenSymbol: investment.project.tokenSymbol,
    targetYield: investment.project.targetYield.toNumber(),
    investedUsd: investment.purchasePriceUsd.toNumber(),
    tokenCount: investment.tokenCount
  }));

  const byProject = new Map<
    string,
    {
      projectId: string;
      projectTitle: string;
      tokenSymbol: string | null;
      targetYieldPercent: number;
      investedUsd: number;
      tokenCount: number;
      totalReceivedUsd: number;
      dividendCount: number;
      lastDistributionAt: Date | null;
      recentDistributions: ProjectYieldDistribution[];
    }
  >();

  for (const project of projectMeta) {
    byProject.set(project.id, {
      projectId: project.id,
      projectTitle: project.title,
      tokenSymbol: project.tokenSymbol,
      targetYieldPercent: project.targetYield,
      investedUsd: project.investedUsd,
      tokenCount: project.tokenCount,
      totalReceivedUsd: 0,
      dividendCount: 0,
      lastDistributionAt: null,
      recentDistributions: []
    });
  }

  const [dividends, payoutReceipts] = await Promise.all([
    prisma.dividendDistribution.findMany({
      where: {
        userId: investorId,
        status: { in: [LIQUIDATED_CASH_STATUS, APPLIED_TO_MARGIN_STATUS] }
      },
      select: {
        id: true,
        assetId: true,
        amount: true,
        distributedAt: true,
        txHash: true,
        status: true
      },
      orderBy: { distributedAt: 'desc' }
    }),
    prisma.payoutReceipt.findMany({
      where: { investorId },
      include: {
        payout: {
          select: {
            projectId: true,
            executedAt: true,
            txHash: true
          }
        }
      },
      orderBy: { payout: { executedAt: 'desc' } }
    })
  ]);

  const projectLookup = projectMeta.map((project) => ({
    id: project.id,
    title: project.title,
    tokenSymbol: project.tokenSymbol
  }));

  for (const distribution of dividends) {
    const amountUsd = distribution.amount.toNumber();
    const projectId =
      resolveProjectIdForAsset(distribution.assetId, projectLookup) ??
      (projectLookup.length === 1 ? projectLookup[0].id : null);

    if (!projectId || !byProject.has(projectId)) {
      continue;
    }

    const row = byProject.get(projectId)!;
    row.totalReceivedUsd += amountUsd;
    row.dividendCount += 1;
    if (!row.lastDistributionAt || distribution.distributedAt > row.lastDistributionAt) {
      row.lastDistributionAt = distribution.distributedAt;
    }
    row.recentDistributions.push({
      id: distribution.id,
      date: distribution.distributedAt.toISOString(),
      amountUsd: distribution.amount.toString(),
      source: 'DIVIDEND',
      txHash: distribution.txHash,
      concept:
        distribution.status === APPLIED_TO_MARGIN_STATUS
          ? 'Dividendo aplicado a repago de margen'
          : 'Dividendo operativo liquidado en cash'
    });
  }

  for (const receipt of payoutReceipts) {
    const projectId = receipt.payout.projectId;
    if (!byProject.has(projectId)) {
      continue;
    }

    const amountUsd = receipt.amountReceived.toNumber();
    const row = byProject.get(projectId)!;
    row.totalReceivedUsd += amountUsd;
    row.dividendCount += 1;
    const paidAt = receipt.payout.executedAt;
    if (!row.lastDistributionAt || paidAt > row.lastDistributionAt) {
      row.lastDistributionAt = paidAt;
    }
    row.recentDistributions.push({
      id: receipt.id,
      date: paidAt.toISOString(),
      amountUsd: receipt.amountReceived.toString(),
      source: 'PAYOUT',
      txHash: receipt.payout.txHash,
      concept: 'Distribución de yield del proyecto'
    });
  }

  const projects: ProjectYieldRow[] = Array.from(byProject.values()).map((row) => {
    row.recentDistributions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      tokenSymbol: row.tokenSymbol,
      targetYieldPercent: row.targetYieldPercent,
      investedUsd: row.investedUsd,
      tokenCount: row.tokenCount,
      totalReceivedUsd: row.totalReceivedUsd,
      dividendCount: row.dividendCount,
      realizedYieldPercent:
        row.investedUsd > 0 ? Number(((row.totalReceivedUsd / row.investedUsd) * 100).toFixed(2)) : null,
      lastDistributionAt: row.lastDistributionAt?.toISOString() ?? null,
      recentDistributions: row.recentDistributions.slice(0, 5)
    };
  });

  const investedUsd = projects.reduce((sum, project) => sum + project.investedUsd, 0);
  const totalReceivedUsd = projects.reduce((sum, project) => sum + project.totalReceivedUsd, 0);
  const weightedTargetYieldPercent =
    investedUsd > 0
      ? Number(
          (
            projects.reduce((sum, project) => sum + project.targetYieldPercent * project.investedUsd, 0) /
            investedUsd
          ).toFixed(2)
        )
      : null;

  return {
    projects,
    totals: {
      investedUsd,
      totalReceivedUsd,
      weightedTargetYieldPercent,
      portfolioRealizedYieldPercent:
        investedUsd > 0 ? Number(((totalReceivedUsd / investedUsd) * 100).toFixed(2)) : null
    }
  };
}

export async function getInvestorIdForPlatformUser(platformUserId: string): Promise<string | null> {
  return resolveInvestorId(platformUserId);
}
