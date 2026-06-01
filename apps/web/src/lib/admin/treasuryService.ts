import { prisma, type PayoutStatus } from '@sanova/database';

export type TreasurySummary = {
  totalCapitalUsd: number;
  totalMarginDebtUsd: number;
  totalPayoutsUsd: number;
  totalLiquidPaidUsd: number;
  totalDebtOffsetUsd: number;
  pendingPayouts: number;
  distributionCount: number;
  investorCount: number;
};

export type AdminPayoutRecord = {
  id: string;
  projectId: string;
  projectTitle: string;
  totalAmountPaid: number;
  liquidPaidUsd: number;
  debtOffsetUsd: number;
  status: PayoutStatus;
  txHash: string;
  executedAt: string;
  receiptCount: number;
};

export type AdminDistributionRecord = {
  id: string;
  assetId: string;
  investorName: string;
  investorEmail: string;
  amount: number;
  currency: string;
  status: string;
  appliedToMargin: boolean;
  distributedAt: string;
  txHash: string | null;
};

export type PayoutListFilter = 'ALL' | PayoutStatus;

export type TreasuryOverview = {
  summary: TreasurySummary;
  payouts: AdminPayoutRecord[];
  distributions: AdminDistributionRecord[];
};

export async function getTreasuryOverview(payoutFilter: PayoutListFilter = 'ALL'): Promise<TreasuryOverview> {
  const payoutWhere = payoutFilter === 'ALL' ? undefined : { status: payoutFilter };

  const [
    capitalAgg,
    payoutAgg,
    liquidAgg,
    debtOffsetAgg,
    pendingPayouts,
    distributionCount,
    investorCount,
    payouts,
    distributions
  ] = await Promise.all([
    prisma.investor.aggregate({ _sum: { totalCapital: true } }),
    prisma.payoutHistory.aggregate({ _sum: { totalAmountPaid: true } }),
    prisma.payoutHistory.aggregate({ _sum: { liquidPaidUsd: true } }),
    prisma.payoutHistory.aggregate({ _sum: { debtOffsetUsd: true } }),
    prisma.payoutHistory.count({ where: { status: 'PENDING' } }),
    prisma.dividendDistribution.count(),
    prisma.investor.count(),
    prisma.payoutHistory.findMany({
      where: payoutWhere,
      include: {
        project: { select: { title: true } },
        _count: { select: { receipts: true } }
      },
      orderBy: { executedAt: 'desc' },
      take: 50
    }),
    prisma.dividendDistribution.findMany({
      include: {
        investor: { select: { fullName: true, email: true } }
      },
      orderBy: { distributedAt: 'desc' },
      take: 50
    })
  ]);

  return {
    summary: {
      totalCapitalUsd: Number(capitalAgg._sum.totalCapital ?? 0),
      totalMarginDebtUsd: 0,
      totalPayoutsUsd: Number(payoutAgg._sum.totalAmountPaid ?? 0),
      totalLiquidPaidUsd: Number(liquidAgg._sum.liquidPaidUsd ?? 0),
      totalDebtOffsetUsd: Number(debtOffsetAgg._sum.debtOffsetUsd ?? 0),
      pendingPayouts,
      distributionCount,
      investorCount
    },
    payouts: payouts.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      projectTitle: row.project.title,
      totalAmountPaid: Number(row.totalAmountPaid),
      liquidPaidUsd: Number(row.liquidPaidUsd),
      debtOffsetUsd: Number(row.debtOffsetUsd),
      status: row.status,
      txHash: row.txHash,
      executedAt: row.executedAt.toISOString(),
      receiptCount: row._count.receipts
    })),
    distributions: distributions.map((row) => ({
      id: row.id,
      assetId: row.assetId,
      investorName: row.investor.fullName,
      investorEmail: row.investor.email,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      appliedToMargin: row.appliedToMargin,
      distributedAt: row.distributedAt.toISOString(),
      txHash: row.txHash
    }))
  };
}
