import { prisma } from '@sanova/database';
import type { AdvisorContext } from './advisorContext';
import { collectDownlineAdvisorIds, getScopedAdvisorIds } from './advisorContext';
import { getAdvisorCommissionSummary } from './commissionService';

export type AdvisorDashboardStats = {
  totalClients: number;
  clientsByKyc: Record<string, number>;
  incorporationsThisMonth: number;
  downlineAdvisors: number;
  accruedCommissionUsd: number;
  paidCommissionUsd: number;
};

export async function getAdvisorDashboardStats(ctx: AdvisorContext): Promise<AdvisorDashboardStats> {
  const advisorIds = await getScopedAdvisorIds(ctx);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const investors = await prisma.investor.findMany({
    where: { incorporatedByAdvisorId: { in: advisorIds } },
    select: {
      kycStatus: true,
      incorporatedAt: true,
      createdAt: true
    }
  });

  const clientsByKyc: Record<string, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0
  };

  let incorporationsThisMonth = 0;

  for (const investor of investors) {
    const kyc = investor.kycStatus;
    clientsByKyc[kyc] = (clientsByKyc[kyc] ?? 0) + 1;

    const incorporatedAt = investor.incorporatedAt ?? investor.createdAt;
    if (incorporatedAt >= monthStart) {
      incorporationsThisMonth += 1;
    }
  }

  let downlineAdvisors = 0;
  if (ctx.role === 'ADVISOR_MANAGER') {
    const scoped = await collectDownlineAdvisorIds(ctx.advisorId);
    downlineAdvisors = scoped.length - 1;
  }

  const commission = await getAdvisorCommissionSummary(ctx);

  return {
    totalClients: investors.length,
    clientsByKyc,
    incorporationsThisMonth,
    downlineAdvisors,
    accruedCommissionUsd: commission.accruedTotalUsd,
    paidCommissionUsd: commission.paidTotalUsd
  };
}
