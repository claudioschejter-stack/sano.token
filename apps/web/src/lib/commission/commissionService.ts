import { prisma } from '@sanova/database';

export type CommissionRecipient = {
  role: 'ADVISOR' | 'ADVISOR_MANAGER' | 'ADMIN';
  advisorId: string | null;
  userId: string | null;
  email: string | null;
  bps: number;
  amountUsd: number;
};

export type CommissionSplit = {
  grossAmountUsd: number;
  totalCommissionBps: number;
  totalCommissionUsd: number;
  recipients: CommissionRecipient[];
};

/** Reparto: 50% asesor, 30% gerente (upline), 20% plataforma/admin. */
const ADVISOR_SHARE_BPS = 50;
const MANAGER_SHARE_BPS = 30;
const ADMIN_SHARE_BPS = 20;

export async function calculatePurchaseCommissionSplit(input: {
  investorId: string;
  purchaseAmountUsd: number;
}): Promise<CommissionSplit | null> {
  if (input.purchaseAmountUsd <= 0) {
    return null;
  }

  const investor = await prisma.investor.findUnique({
    where: { id: input.investorId },
    select: {
      incorporatedByAdvisorId: true,
      incorporatedBy: {
        select: {
          id: true,
          userId: true,
          commissionRateBps: true,
          user: { select: { email: true } },
          upline: {
            select: {
              id: true,
              userId: true,
              user: { select: { email: true, systemRole: true } }
            }
          }
        }
      }
    }
  });

  if (!investor?.incorporatedByAdvisorId || !investor.incorporatedBy) {
    return null;
  }

  const advisor = investor.incorporatedBy;
  const totalCommissionBps = advisor.commissionRateBps;
  const totalCommissionUsd = (input.purchaseAmountUsd * totalCommissionBps) / 10_000;

  const recipients: CommissionRecipient[] = [
    {
      role: 'ADVISOR',
      advisorId: advisor.id,
      userId: advisor.userId,
      email: advisor.user.email,
      bps: Math.round((totalCommissionBps * ADVISOR_SHARE_BPS) / 100),
      amountUsd: (totalCommissionUsd * ADVISOR_SHARE_BPS) / 100
    }
  ];

  const manager = advisor.upline;
  if (manager && manager.user.systemRole === 'ADVISOR_MANAGER') {
    recipients.push({
      role: 'ADVISOR_MANAGER',
      advisorId: manager.id,
      userId: manager.userId,
      email: manager.user.email,
      bps: Math.round((totalCommissionBps * MANAGER_SHARE_BPS) / 100),
      amountUsd: (totalCommissionUsd * MANAGER_SHARE_BPS) / 100
    });
  }

  const adminUser = await prisma.user.findFirst({
    where: { systemRole: 'ADMIN' },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' }
  });

  recipients.push({
    role: 'ADMIN',
    advisorId: null,
    userId: adminUser?.id ?? null,
    email: adminUser?.email ?? null,
    bps: Math.round((totalCommissionBps * ADMIN_SHARE_BPS) / 100),
    amountUsd: (totalCommissionUsd * ADMIN_SHARE_BPS) / 100
  });

  return {
    grossAmountUsd: input.purchaseAmountUsd,
    totalCommissionBps,
    totalCommissionUsd,
    recipients
  };
}
