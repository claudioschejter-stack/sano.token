import { prisma, type AdvisorCategory } from '@sanova/database';

export type CategoryRuleInput = {
  category: AdvisorCategory;
  sortOrder: number;
  minBookAumUsd: number;
  minActiveInvestors: number;
  minQualifyingDays: number;
  advisorMultiplierBps: number;
};

export type PolicyInput = {
  name: string;
  purchaseFeeBps: number;
  rentFeeBps: number;
  platformOpexShareBps: number;
  adminOpsShareBps: number;
  advisorPoolShareBps: number;
  advisorDirectShareBps: number;
  managerShareBps: number;
  platformResidualBps: number;
  categoryRules: CategoryRuleInput[];
};

export type PolicyWithRules = Awaited<ReturnType<typeof getActiveCommissionPolicy>>;

const DEFAULT_CATEGORY_RULES: CategoryRuleInput[] = [
  {
    category: 'BRONZE',
    sortOrder: 0,
    minBookAumUsd: 0,
    minActiveInvestors: 1,
    minQualifyingDays: 0,
    advisorMultiplierBps: 10_000
  },
  {
    category: 'SILVER',
    sortOrder: 1,
    minBookAumUsd: 50_000,
    minActiveInvestors: 3,
    minQualifyingDays: 90,
    advisorMultiplierBps: 11_000
  },
  {
    category: 'GOLD',
    sortOrder: 2,
    minBookAumUsd: 250_000,
    minActiveInvestors: 8,
    minQualifyingDays: 180,
    advisorMultiplierBps: 12_500
  },
  {
    category: 'PLATINUM',
    sortOrder: 3,
    minBookAumUsd: 1_000_000,
    minActiveInvestors: 20,
    minQualifyingDays: 365,
    advisorMultiplierBps: 15_000
  }
];

export function validatePolicyInput(input: PolicyInput): string | null {
  const poolSum =
    input.platformOpexShareBps + input.adminOpsShareBps + input.advisorPoolShareBps;
  if (poolSum !== 10_000) {
    return 'POOL_SHARES_MUST_SUM_10000';
  }

  const advisorSplitSum =
    input.advisorDirectShareBps + input.managerShareBps + input.platformResidualBps;
  if (advisorSplitSum !== 10_000) {
    return 'ADVISOR_SPLIT_MUST_SUM_10000';
  }

  if (input.purchaseFeeBps < 0 || input.purchaseFeeBps > 10_000) {
    return 'INVALID_PURCHASE_FEE_BPS';
  }

  if (input.rentFeeBps < 0 || input.rentFeeBps > 10_000) {
    return 'INVALID_RENT_FEE_BPS';
  }

  if (input.categoryRules.length !== 4) {
    return 'REQUIRE_FOUR_CATEGORY_RULES';
  }

  return null;
}

export async function getActiveCommissionPolicy() {
  return prisma.platformCommissionPolicy.findFirst({
    where: { isActive: true },
    include: {
      categoryRules: { orderBy: { sortOrder: 'asc' } }
    },
    orderBy: { effectiveFrom: 'desc' }
  });
}

export async function ensureDefaultCommissionPolicy(createdByUserId?: string) {
  const existing = await getActiveCommissionPolicy();
  if (existing) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    await tx.platformCommissionPolicy.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    const policy = await tx.platformCommissionPolicy.create({
      data: {
        name: 'Política principal',
        isActive: true,
        effectiveFrom: new Date(),
        purchaseFeeBps: 200,
        rentFeeBps: 100,
        platformOpexShareBps: 2500,
        adminOpsShareBps: 3500,
        advisorPoolShareBps: 4000,
        advisorDirectShareBps: 5000,
        managerShareBps: 3000,
        platformResidualBps: 2000,
        createdByUserId
      }
    });

    for (const rule of DEFAULT_CATEGORY_RULES) {
      await tx.advisorCategoryRule.create({
        data: {
          policyId: policy.id,
          category: rule.category,
          sortOrder: rule.sortOrder,
          minBookAumUsd: rule.minBookAumUsd,
          minActiveInvestors: rule.minActiveInvestors,
          minQualifyingDays: rule.minQualifyingDays,
          advisorMultiplierBps: rule.advisorMultiplierBps
        }
      });
    }

    return tx.platformCommissionPolicy.findUniqueOrThrow({
      where: { id: policy.id },
      include: { categoryRules: { orderBy: { sortOrder: 'asc' } } }
    });
  });
}

export async function saveCommissionPolicy(input: PolicyInput, createdByUserId?: string) {
  const validationError = validatePolicyInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const current = await getActiveCommissionPolicy();
  const nextVersion = (current?.version ?? 0) + 1;

  return prisma.$transaction(async (tx) => {
    await tx.platformCommissionPolicy.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    const policy = await tx.platformCommissionPolicy.create({
      data: {
        version: nextVersion,
        name: input.name.trim() || 'Política principal',
        isActive: true,
        effectiveFrom: new Date(),
        purchaseFeeBps: input.purchaseFeeBps,
        rentFeeBps: input.rentFeeBps,
        platformOpexShareBps: input.platformOpexShareBps,
        adminOpsShareBps: input.adminOpsShareBps,
        advisorPoolShareBps: input.advisorPoolShareBps,
        advisorDirectShareBps: input.advisorDirectShareBps,
        managerShareBps: input.managerShareBps,
        platformResidualBps: input.platformResidualBps,
        createdByUserId
      }
    });

    for (const rule of input.categoryRules) {
      await tx.advisorCategoryRule.create({
        data: {
          policyId: policy.id,
          category: rule.category,
          sortOrder: rule.sortOrder,
          minBookAumUsd: rule.minBookAumUsd,
          minActiveInvestors: rule.minActiveInvestors,
          minQualifyingDays: rule.minQualifyingDays,
          advisorMultiplierBps: rule.advisorMultiplierBps
        }
      });
    }

    return tx.platformCommissionPolicy.findUniqueOrThrow({
      where: { id: policy.id },
      include: { categoryRules: { orderBy: { sortOrder: 'asc' } } }
    });
  });
}

export function serializePolicy(policy: NonNullable<PolicyWithRules>) {
  return {
    id: policy.id,
    version: policy.version,
    name: policy.name,
    isActive: policy.isActive,
    effectiveFrom: policy.effectiveFrom.toISOString(),
    purchaseFeeBps: policy.purchaseFeeBps,
    rentFeeBps: policy.rentFeeBps,
    platformOpexShareBps: policy.platformOpexShareBps,
    adminOpsShareBps: policy.adminOpsShareBps,
    advisorPoolShareBps: policy.advisorPoolShareBps,
    advisorDirectShareBps: policy.advisorDirectShareBps,
    managerShareBps: policy.managerShareBps,
    platformResidualBps: policy.platformResidualBps,
    categoryRules: policy.categoryRules.map((rule) => ({
      id: rule.id,
      category: rule.category,
      sortOrder: rule.sortOrder,
      minBookAumUsd: rule.minBookAumUsd.toNumber(),
      minActiveInvestors: rule.minActiveInvestors,
      minQualifyingDays: rule.minQualifyingDays,
      advisorMultiplierBps: rule.advisorMultiplierBps
    }))
  };
}

export async function getSerializedActivePolicy() {
  const policy = (await getActiveCommissionPolicy()) ?? (await ensureDefaultCommissionPolicy());
  return serializePolicy(policy);
}
