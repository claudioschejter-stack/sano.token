import { prisma } from '@sanova/database';
import {
  ensureDefaultCommissionPolicy,
  getActiveCommissionPolicy
} from './commissionPolicyService';
import { evaluateAdvisorCategory } from './advisorCategoryService';
import { calculateEventFee, persistFeeAccruals, type FeeCalculation } from './commissionEngine';

export type CommissionRecipient = {
  role: 'ADVISOR' | 'ADVISOR_MANAGER' | 'ADMIN' | 'PLATFORM_OPEX' | 'ADMIN_OPS' | 'PLATFORM_RESIDUAL';
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
  netAmountUsd: number;
  advisorCategory: string | null;
  recipients: CommissionRecipient[];
};

function mapFeeToSplit(fee: FeeCalculation): CommissionSplit {
  return {
    grossAmountUsd: fee.grossAmountUsd,
    totalCommissionBps: fee.feeBps,
    totalCommissionUsd: fee.feeAmountUsd,
    netAmountUsd: fee.netAmountUsd,
    advisorCategory: fee.advisorCategory,
    recipients: fee.recipients.map((row) => ({
      role:
        row.role === 'ADMIN_OPS'
          ? 'ADMIN_OPS'
          : row.role === 'PLATFORM_OPEX'
            ? 'PLATFORM_OPEX'
            : row.role === 'PLATFORM_RESIDUAL'
              ? 'PLATFORM_RESIDUAL'
              : row.role === 'ADVISOR_MANAGER'
                ? 'ADVISOR_MANAGER'
                : row.role === 'ADVISOR'
                  ? 'ADVISOR'
                  : 'ADMIN',
      advisorId: row.advisorId,
      userId: row.userId,
      email: row.email,
      bps: row.bps,
      amountUsd: row.amountUsd
    }))
  };
}

export async function calculatePurchaseCommissionSplit(input: {
  investorId: string;
  purchaseAmountUsd: number;
  investmentId?: string;
  projectId?: string;
  persist?: boolean;
  idempotencyPrefix?: string;
}): Promise<CommissionSplit | null> {
  if (input.purchaseAmountUsd <= 0) {
    return null;
  }

  const policy =
    (await getActiveCommissionPolicy()) ?? (await ensureDefaultCommissionPolicy());

  const investor = await prisma.investor.findUnique({
    where: { id: input.investorId },
    select: { incorporatedByAdvisorId: true }
  });

  if (investor?.incorporatedByAdvisorId) {
    await evaluateAdvisorCategory(investor.incorporatedByAdvisorId, policy);
  }

  const fee = await calculateEventFee({
    eventType: 'TOKEN_PURCHASE',
    grossAmountUsd: input.purchaseAmountUsd,
    investorId: input.investorId,
    policy
  });

  if (input.persist !== false && fee.feeAmountUsd > 0) {
    await persistFeeAccruals({
      policyId: policy.id,
      eventType: 'TOKEN_PURCHASE',
      grossAmountUsd: input.purchaseAmountUsd,
      fee,
      investorId: input.investorId,
      projectId: input.projectId,
      investmentId: input.investmentId,
      idempotencyPrefix: input.idempotencyPrefix ?? `purchase:${input.investmentId ?? Date.now()}`
    });
  }

  return mapFeeToSplit(fee);
}

export async function calculateRentCommissionSplit(input: {
  investorId: string;
  grossRentUsd: number;
  projectId: string;
  persist?: boolean;
  idempotencyPrefix: string;
}): Promise<CommissionSplit | null> {
  if (input.grossRentUsd <= 0) {
    return null;
  }

  const policy =
    (await getActiveCommissionPolicy()) ?? (await ensureDefaultCommissionPolicy());

  const investor = await prisma.investor.findUnique({
    where: { id: input.investorId },
    select: { incorporatedByAdvisorId: true }
  });

  if (investor?.incorporatedByAdvisorId) {
    await evaluateAdvisorCategory(investor.incorporatedByAdvisorId, policy);
  }

  const fee = await calculateEventFee({
    eventType: 'RENT_DISTRIBUTION',
    grossAmountUsd: input.grossRentUsd,
    investorId: input.investorId,
    policy
  });

  if (input.persist !== false && fee.feeAmountUsd > 0) {
    await persistFeeAccruals({
      policyId: policy.id,
      eventType: 'RENT_DISTRIBUTION',
      grossAmountUsd: input.grossRentUsd,
      fee,
      investorId: input.investorId,
      projectId: input.projectId,
      idempotencyPrefix: input.idempotencyPrefix
    });
  }

  return mapFeeToSplit(fee);
}
