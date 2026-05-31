import {
  prisma,
  type CommissionEventType,
  type CommissionRecipientRole
} from '@sanova/database';
import type { PolicyWithRules } from './commissionPolicyService';
import { getCategoryMultiplierBps } from './advisorCategoryService';

export type FeeRecipient = {
  role: CommissionRecipientRole;
  advisorId: string | null;
  userId: string | null;
  email: string | null;
  bps: number;
  amountUsd: number;
};

export type FeeCalculation = {
  grossAmountUsd: number;
  feeBps: number;
  feeAmountUsd: number;
  netAmountUsd: number;
  advisorCategory: string | null;
  advisorMultiplierBps: number | null;
  recipients: FeeRecipient[];
};

type AdvisorContext = {
  id: string;
  userId: string;
  email: string;
  category: string;
  upline: {
    id: string;
    userId: string;
    email: string;
    systemRole: string;
  } | null;
} | null;

async function loadAdvisorContext(investorId: string): Promise<AdvisorContext> {
  const investor = await prisma.investor.findUnique({
    where: { id: investorId },
    select: {
      incorporatedByAdvisorId: true,
      incorporatedBy: {
        select: {
          id: true,
          userId: true,
          category: true,
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

  if (!investor?.incorporatedBy) {
    return null;
  }

  const advisor = investor.incorporatedBy;
  return {
    id: advisor.id,
    userId: advisor.userId,
    email: advisor.user.email,
    category: advisor.category,
    upline: advisor.upline
      ? {
          id: advisor.upline.id,
          userId: advisor.upline.userId,
          email: advisor.upline.user.email,
          systemRole: advisor.upline.user.systemRole
        }
      : null
  };
}

function sliceAmount(total: number, bps: number): number {
  return (total * bps) / 10_000;
}

export async function calculateEventFee(input: {
  eventType: CommissionEventType;
  grossAmountUsd: number;
  investorId?: string | null;
  policy: NonNullable<PolicyWithRules>;
}): Promise<FeeCalculation> {
  const feeBps =
    input.eventType === 'TOKEN_PURCHASE' ? input.policy.purchaseFeeBps : input.policy.rentFeeBps;

  const feeAmountUsd = sliceAmount(input.grossAmountUsd, feeBps);
  const netAmountUsd = Math.max(input.grossAmountUsd - feeAmountUsd, 0);

  const recipients: FeeRecipient[] = [];

  if (feeAmountUsd <= 0) {
    return {
      grossAmountUsd: input.grossAmountUsd,
      feeBps,
      feeAmountUsd: 0,
      netAmountUsd: input.grossAmountUsd,
      advisorCategory: null,
      advisorMultiplierBps: null,
      recipients
    };
  }

  const platformOpex = sliceAmount(feeAmountUsd, input.policy.platformOpexShareBps);
  const adminOps = sliceAmount(feeAmountUsd, input.policy.adminOpsShareBps);
  const advisorPool = sliceAmount(feeAmountUsd, input.policy.advisorPoolShareBps);

  const adminUser = await prisma.user.findFirst({
    where: { systemRole: 'ADMIN' },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' }
  });

  recipients.push({
    role: 'PLATFORM_OPEX',
    advisorId: null,
    userId: adminUser?.id ?? null,
    email: adminUser?.email ?? null,
    bps: input.policy.platformOpexShareBps,
    amountUsd: platformOpex
  });

  recipients.push({
    role: 'ADMIN_OPS',
    advisorId: null,
    userId: adminUser?.id ?? null,
    email: adminUser?.email ?? null,
    bps: input.policy.adminOpsShareBps,
    amountUsd: adminOps
  });

  const advisorContext = input.investorId ? await loadAdvisorContext(input.investorId) : null;

  if (advisorContext && advisorPool > 0) {
    const multiplierBps = getCategoryMultiplierBps(
      advisorContext.category as 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM',
      input.policy.categoryRules
    );

    const baseAdvisorShare = sliceAmount(advisorPool, input.policy.advisorDirectShareBps);
    const advisorAmount = (baseAdvisorShare * multiplierBps) / 10_000;
    const managerBase = sliceAmount(advisorPool, input.policy.managerShareBps);
    const managerAmount =
      advisorContext.upline?.systemRole === 'ADVISOR_MANAGER' ? managerBase : 0;
    const platformResidual = Math.max(advisorPool - advisorAmount - managerAmount, 0);

    recipients.push({
      role: 'ADVISOR',
      advisorId: advisorContext.id,
      userId: advisorContext.userId,
      email: advisorContext.email,
      bps: Math.round((advisorAmount / feeAmountUsd) * 10_000),
      amountUsd: advisorAmount
    });

    if (managerAmount > 0 && advisorContext.upline) {
      recipients.push({
        role: 'ADVISOR_MANAGER',
        advisorId: advisorContext.upline.id,
        userId: advisorContext.upline.userId,
        email: advisorContext.upline.email,
        bps: Math.round((managerAmount / feeAmountUsd) * 10_000),
        amountUsd: managerAmount
      });
    }

    if (platformResidual > 0) {
      recipients.push({
        role: 'PLATFORM_RESIDUAL',
        advisorId: null,
        userId: adminUser?.id ?? null,
        email: adminUser?.email ?? null,
        bps: Math.round((platformResidual / feeAmountUsd) * 10_000),
        amountUsd: platformResidual
      });
    }

    return {
      grossAmountUsd: input.grossAmountUsd,
      feeBps,
      feeAmountUsd,
      netAmountUsd,
      advisorCategory: advisorContext.category,
      advisorMultiplierBps: multiplierBps,
      recipients
    };
  }

  recipients.push({
    role: 'PLATFORM_RESIDUAL',
    advisorId: null,
    userId: adminUser?.id ?? null,
    email: adminUser?.email ?? null,
    bps: input.policy.advisorPoolShareBps,
    amountUsd: advisorPool
  });

  return {
    grossAmountUsd: input.grossAmountUsd,
    feeBps,
    feeAmountUsd,
    netAmountUsd,
    advisorCategory: null,
    advisorMultiplierBps: null,
    recipients
  };
}

export async function persistFeeAccruals(input: {
  policyId: string;
  eventType: CommissionEventType;
  grossAmountUsd: number;
  fee: FeeCalculation;
  investorId?: string | null;
  advisorId?: string | null;
  projectId?: string | null;
  investmentId?: string | null;
  idempotencyPrefix: string;
}) {
  if (input.fee.feeAmountUsd <= 0 || !input.fee.recipients.length) {
    return [];
  }

  const rows = [];

  for (const [index, recipient] of input.fee.recipients.entries()) {
    if (recipient.amountUsd <= 0) {
      continue;
    }

    const idempotencyKey = `${input.idempotencyPrefix}:${recipient.role}:${index}`;

    const row = await prisma.commissionAccrual.upsert({
      where: { idempotencyKey },
      create: {
        policyId: input.policyId,
        eventType: input.eventType,
        grossAmountUsd: input.grossAmountUsd,
        feeAmountUsd: input.fee.feeAmountUsd,
        investorId: input.investorId ?? undefined,
        advisorId: recipient.advisorId ?? input.advisorId ?? undefined,
        projectId: input.projectId ?? undefined,
        investmentId: input.investmentId ?? undefined,
        recipientRole: recipient.role,
        recipientUserId: recipient.userId ?? undefined,
        amountUsd: recipient.amountUsd,
        idempotencyKey,
        metadata: {
          feeBps: input.fee.feeBps,
          advisorCategory: input.fee.advisorCategory,
          advisorMultiplierBps: input.fee.advisorMultiplierBps
        }
      },
      update: {
        amountUsd: recipient.amountUsd,
        feeAmountUsd: input.fee.feeAmountUsd
      }
    });

    rows.push(row);
  }

  return rows;
}
