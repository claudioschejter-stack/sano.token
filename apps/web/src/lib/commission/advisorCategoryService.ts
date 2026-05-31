import { prisma, type AdvisorCategory } from '@sanova/database';
import type { PolicyWithRules } from './commissionPolicyService';

export type AdvisorBookMetrics = {
  bookAumUsd: number;
  activeInvestorCount: number;
  qualifyingDays: number;
};

const CATEGORY_RANK: Record<AdvisorCategory, number> = {
  BRONZE: 0,
  SILVER: 1,
  GOLD: 2,
  PLATINUM: 3
};

export async function getAdvisorBookMetrics(advisorId: string): Promise<AdvisorBookMetrics> {
  const investors = await prisma.investor.findMany({
    where: {
      incorporatedByAdvisorId: advisorId,
      kycStatus: 'APPROVED',
      investments: { some: { status: 'ACTIVE' } }
    },
    select: {
      totalCapital: true,
      incorporatedAt: true,
      createdAt: true
    }
  });

  const bookAumUsd = investors.reduce((sum, row) => sum + row.totalCapital.toNumber(), 0);
  const activeInvestorCount = investors.length;

  if (!investors.length) {
    return { bookAumUsd: 0, activeInvestorCount: 0, qualifyingDays: 0 };
  }

  const earliestIncorporation = investors.reduce((earliest, row) => {
    const date = row.incorporatedAt ?? row.createdAt;
    return date < earliest ? date : earliest;
  }, investors[0]!.incorporatedAt ?? investors[0]!.createdAt);

  const qualifyingDays = Math.floor(
    (Date.now() - earliestIncorporation.getTime()) / (24 * 60 * 60 * 1000)
  );

  return { bookAumUsd, activeInvestorCount, qualifyingDays };
}

export function resolveCategoryFromMetrics(
  metrics: AdvisorBookMetrics,
  rules: NonNullable<PolicyWithRules>['categoryRules']
): AdvisorCategory {
  const ordered = [...rules].sort(
    (a, b) => CATEGORY_RANK[b.category] - CATEGORY_RANK[a.category]
  );

  for (const rule of ordered) {
    if (
      metrics.bookAumUsd >= rule.minBookAumUsd.toNumber() &&
      metrics.activeInvestorCount >= rule.minActiveInvestors &&
      metrics.qualifyingDays >= rule.minQualifyingDays
    ) {
      return rule.category;
    }
  }

  return 'BRONZE';
}

export function getCategoryMultiplierBps(
  category: AdvisorCategory,
  rules: NonNullable<PolicyWithRules>['categoryRules']
): number {
  const rule = rules.find((row) => row.category === category);
  return rule?.advisorMultiplierBps ?? 10_000;
}

export async function evaluateAdvisorCategory(advisorId: string, policy?: PolicyWithRules | null) {
  const activePolicy =
    policy ??
    (await prisma.platformCommissionPolicy.findFirst({
      where: { isActive: true },
      include: { categoryRules: { orderBy: { sortOrder: 'asc' } } }
    }));

  if (!activePolicy) {
    return null;
  }

  const metrics = await getAdvisorBookMetrics(advisorId);
  const nextCategory = resolveCategoryFromMetrics(metrics, activePolicy.categoryRules);
  const now = new Date();

  const updated = await prisma.advisor.update({
    where: { id: advisorId },
    data: {
      category: nextCategory,
      categoryEvaluatedAt: now,
      categoryQualifiedAt:
        nextCategory === 'BRONZE' && metrics.activeInvestorCount === 0 ? null : now
    },
    select: {
      id: true,
      category: true,
      categoryQualifiedAt: true,
      categoryEvaluatedAt: true,
      user: { select: { email: true, name: true } }
    }
  });

  return {
    advisor: updated,
    metrics,
    multiplierBps: getCategoryMultiplierBps(nextCategory, activePolicy.categoryRules)
  };
}

export async function evaluateAllAdvisorCategories() {
  const advisors = await prisma.advisor.findMany({ select: { id: true } });
  const results = [];

  for (const advisor of advisors) {
    results.push(await evaluateAdvisorCategory(advisor.id));
  }

  return results.filter(Boolean);
}
