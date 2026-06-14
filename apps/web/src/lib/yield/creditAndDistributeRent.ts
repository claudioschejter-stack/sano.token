import { Prisma, prisma } from '@sanova/database';
import { allocateProjectRentByPreference } from '../investor/rentPayoutService';
import {
  creditProjectOperatingRent,
  createYieldBatchFromOperatingBalance,
  getOrCreateProjectOperatingAccount,
  assertYieldBatchConversionEligible
} from './projectOperatingService';
import {
  normalizeOperatingCurrency,
  operatingAmountToUsd
} from './yieldConversionRouter';

export type CreditAndDistributeResult = {
  credited: boolean;
  creditEntryId: string;
  totalAmountUsd: number;
  sourceAmount: number;
  sourceCurrency: string;
  allocation: Awaited<ReturnType<typeof allocateProjectRentByPreference>>;
  conversionBatch?: { id: string; status: string; conversionRail: string | null };
  mode: 'DISTRIBUTED' | 'CONVERSION_QUEUED' | 'CREDIT_ONLY' | 'NO_ELIGIBLE_HOLDERS';
};

async function countUsdcPreferenceHolders(projectId: string): Promise<number> {
  const investments = await prisma.investment.findMany({
    where: {
      projectId,
      status: 'ACTIVE',
      investor: { kycStatus: 'APPROVED', rentPayoutPreference: 'USDC' }
    },
    select: { investorId: true }
  });
  return new Set(investments.map((row) => row.investorId)).size;
}

/** Credit tenant rent and distribute to token holders in one admin action. */
export async function creditAndDistributeOperatingRent(input: {
  projectId: string;
  amount: number;
  currency: string;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
  actorUserId?: string | null;
  distributeAmount?: number;
  /** When ARS and USDC holders exist, queue conversion batch instead of failing USDC leg. */
  autoConvertIfNeeded?: boolean;
}): Promise<CreditAndDistributeResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  const currency = normalizeOperatingCurrency(input.currency);
  const creditKey =
    input.idempotencyKey?.trim() ||
    `rent-credit-and-distribute:${input.projectId}:${currency}:${input.amount}:${Date.now()}`;

  const accountBefore = await getOrCreateProjectOperatingAccount(input.projectId, currency);
  const projectedDistribute = input.distributeAmount ?? accountBefore.balance.toNumber() + input.amount;
  const usdcHolders = await countUsdcPreferenceHolders(input.projectId);
  const needsConversion = currency === 'ARS' && usdcHolders > 0 && input.autoConvertIfNeeded;

  if (needsConversion) {
    await assertYieldBatchConversionEligible({
      projectId: input.projectId,
      currency,
      amount: projectedDistribute
    });
  }

  const credit = await creditProjectOperatingRent({
    projectId: input.projectId,
    amount: input.amount,
    currency,
    idempotencyKey: creditKey,
    metadata: {
      ...(input.metadata as object),
      actorUserId: input.actorUserId ?? null,
      flow: 'credit_and_distribute'
    },
    actorUserId: input.actorUserId
  });

  const account = await getOrCreateProjectOperatingAccount(input.projectId, currency);
  const available = account.balance.toNumber();
  const amountToDistribute = input.distributeAmount ?? available;

  if (amountToDistribute <= 0) {
    return {
      credited: credit.created,
      creditEntryId: credit.entry.id,
      totalAmountUsd: 0,
      sourceAmount: 0,
      sourceCurrency: currency,
      allocation: {
        projectId: input.projectId,
        status: 'NO_ELIGIBLE_INVESTORS',
        allocations: []
      },
      mode: 'CREDIT_ONLY'
    };
  }

  if (amountToDistribute > available) {
    throw new Error('INSUFFICIENT_OPERATING_BALANCE');
  }

  if (needsConversion) {
    const batch = await createYieldBatchFromOperatingBalance({
      projectId: input.projectId,
      currency,
      amount: amountToDistribute
    });

    return {
      credited: credit.created,
      creditEntryId: credit.entry.id,
      totalAmountUsd: operatingAmountToUsd(amountToDistribute, currency),
      sourceAmount: amountToDistribute,
      sourceCurrency: currency,
      allocation: {
        projectId: input.projectId,
        status: 'NO_ELIGIBLE_INVESTORS' as const,
        allocations: []
      },
      conversionBatch: {
        id: batch.id,
        status: batch.status,
        conversionRail: batch.conversionRail
      },
      mode: 'CONVERSION_QUEUED'
    };
  }

  const totalAmountUsd = operatingAmountToUsd(amountToDistribute, currency);
  const distributeKey = `${creditKey}:distribute`;

  const allocation = await allocateProjectRentByPreference({
    projectId: input.projectId,
    totalAmountUsd,
    sourceCurrency: currency,
    idempotencyPrefix: distributeKey,
    operatingSource: {
      accountId: account.id,
      totalSourceAmount: amountToDistribute,
      sourceCurrency: currency
    }
  });

  if (allocation.status === 'PARTIAL') {
    throw new Error('PARTIAL_RENT_DISTRIBUTION');
  }

  if (allocation.status === 'NO_ELIGIBLE_INVESTORS') {
    return {
      credited: credit.created,
      creditEntryId: credit.entry.id,
      totalAmountUsd,
      sourceAmount: amountToDistribute,
      sourceCurrency: currency,
      allocation,
      mode: 'NO_ELIGIBLE_HOLDERS'
    };
  }

  return {
    credited: credit.created,
    creditEntryId: credit.entry.id,
    totalAmountUsd,
    sourceAmount: amountToDistribute,
    sourceCurrency: currency,
    allocation,
    mode: 'DISTRIBUTED'
  };
}
