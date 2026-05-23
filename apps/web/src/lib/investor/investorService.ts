import { prisma, Prisma, type KycStatus, type AccountStatus } from '@sanova/database';
import { isAccountOperational } from '../onboarding/accountStatus';

const DEFAULT_MAX_LTV = 0.6;
const CASH_FLOW_STATUS = 'Liquidado en Efectivo';
const LIQUIDATED_CASH_STATUS = 'LIQUIDATED_CASH';
const APPLIED_TO_MARGIN_STATUS = 'APPLIED_TO_MARGIN';

type UserPurchaseContext = {
  id: string;
  email: string;
  phone: string | null;
  kycFullName: string | null;
  kycDocumentId: string | null;
  kycStatus: KycStatus;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  walletAddress: string | null;
  investorId: string | null;
};

export async function getUserPurchaseContext(userId: string): Promise<UserPurchaseContext | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      kycFullName: true,
      kycDocumentId: true,
      kycStatus: true,
      accountStatus: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      walletAddress: true,
      investorId: true
    }
  });
}

export function assertOperationalInvestor(user: UserPurchaseContext) {
  if (!isAccountOperational(user)) {
    throw new Error('ACCOUNT_NOT_OPERATIONAL');
  }

  if (user.kycStatus !== 'APPROVED') {
    throw new Error('KYC_NOT_APPROVED');
  }
}

export async function ensureInvestorForUser(
  user: UserPurchaseContext,
  walletAddress: string
): Promise<string> {
  const normalizedWallet = walletAddress.trim().toLowerCase();

  if (user.investorId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: normalizedWallet }
    });

    await prisma.investor.update({
      where: { id: user.investorId },
      data: { walletAddress: normalizedWallet }
    });

    return user.investorId;
  }

  const fullName = user.kycFullName?.trim() || user.email.split('@')[0];
  const cuit = user.kycDocumentId?.trim() || `TMP-${user.id.slice(0, 8)}`;

  const investor = await prisma.investor.create({
    data: {
      email: user.email,
      fullName,
      cuit,
      walletAddress: normalizedWallet,
      kycStatus: 'APPROVED',
      kycVerifiedAt: new Date()
    }
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      investorId: investor.id,
      walletAddress: normalizedWallet
    }
  });

  await prisma.portfolio.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {}
  });

  return investor.id;
}

export async function purchaseProjectTokens(input: {
  userId: string;
  projectId: string;
  tokenCount: number;
  walletAddress: string;
}) {
  const user = await getUserPurchaseContext(input.userId);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  assertOperationalInvestor(user);

  if (!Number.isInteger(input.tokenCount) || input.tokenCount <= 0) {
    throw new Error('INVALID_TOKEN_COUNT');
  }

  const investorId = await ensureInvestorForUser(user, input.walletAddress);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: input.projectId }
    });

    if (!project || !project.isActive) {
      throw new Error('PROJECT_NOT_AVAILABLE');
    }

    if (project.availableTokens < input.tokenCount) {
      throw new Error('INSUFFICIENT_SUPPLY');
    }

    const pricePerToken = Number(project.pricePerToken);
    const purchasePriceUsd = pricePerToken * input.tokenCount;
    const txHash = `offchain-${Date.now().toString(36)}-${input.projectId}`;

    const investment = await tx.investment.create({
      data: {
        investorId,
        projectId: project.id,
        tokenCount: input.tokenCount,
        purchasePriceUsd,
        status: 'ACTIVE',
        txHash
      }
    });

    await tx.project.update({
      where: { id: project.id },
      data: {
        availableTokens: project.availableTokens - input.tokenCount
      }
    });

    const investor = await tx.investor.findUniqueOrThrow({
      where: { id: investorId },
      select: { totalCapital: true, marginDebt: true }
    });

    const totalCapital = investor.totalCapital.toNumber() + purchasePriceUsd;
    const marginDebt = investor.marginDebt.toNumber();
    const ltv = totalCapital > 0 ? (marginDebt / totalCapital) * 100 : 0;

    await tx.investor.update({
      where: { id: investorId },
      data: {
        totalCapital,
        ltv
      }
    });

    await tx.portfolio.updateMany({
      where: { userId: input.userId },
      data: {
        totalCapital,
        activeMarginDebt: marginDebt,
        ltv
      }
    });

    return {
      investmentId: investment.id,
      projectId: project.id,
      tokenCount: input.tokenCount,
      purchasePriceUsd,
      txHash,
      availableTokens: project.availableTokens - input.tokenCount
    };
  });
}

export async function getPortfolioForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      investorId: true,
      investor: {
        select: {
          id: true,
          fullName: true,
          walletAddress: true,
          investorType: true,
          kycStatus: true,
          brokerAccountRef: true,
          dividendPreference: true,
          totalCapital: true,
          marginDebt: true,
          ltv: true,
          investments: {
            where: { status: 'ACTIVE' },
            orderBy: { purchasedAt: 'desc' },
            include: { project: true }
          }
        }
      }
    }
  });

  if (!user?.investor) {
    return {
      investor: null,
      credit: null,
      activePositions: []
    };
  }

  const investor = user.investor;
  const totalCollateralUsd = investor.investments.reduce(
    (sum, investment) => sum + investment.purchasePriceUsd.toNumber(),
    0
  );

  return {
    investor: {
      id: investor.id,
      fullName: investor.fullName,
      walletAddress: investor.walletAddress,
      investorType: investor.investorType,
      kycStatus: investor.kycStatus,
      brokerAccountRef: investor.brokerAccountRef,
      dividendPreference: investor.dividendPreference,
      totalCapital: investor.totalCapital.toString(),
      marginDebt: investor.marginDebt.toString(),
      ltv: investor.ltv.toString()
    },
    credit: {
      currency: 'USD',
      maxLtv: DEFAULT_MAX_LTV,
      totalCollateralUsd: totalCollateralUsd.toFixed(2),
      availableCreditUsd: (totalCollateralUsd * DEFAULT_MAX_LTV).toFixed(2)
    },
    activePositions: investor.investments.map((investment) => ({
      id: investment.id,
      projectId: investment.projectId,
      projectTitle: investment.project.title,
      tokenCount: investment.tokenCount,
      purchasePriceUsd: investment.purchasePriceUsd.toString(),
      purchasedAt: investment.purchasedAt.toISOString(),
      status: investment.status
    }))
  };
}

export async function getCashFlowForUser(userId: string) {
  const distributions = await prisma.dividendDistribution.findMany({
    where: {
      userId,
      status: LIQUIDATED_CASH_STATUS
    },
    select: {
      id: true,
      assetId: true,
      amount: true,
      currency: true,
      distributedAt: true,
      status: true
    },
    orderBy: { distributedAt: 'desc' }
  });

  return distributions.map((distribution) => ({
    id: distribution.id,
    date: distribution.distributedAt.toISOString(),
    assetId: distribution.assetId,
    liquidatedAmountUsd: distribution.amount.toString(),
    currency: distribution.currency,
    status: CASH_FLOW_STATUS,
    concept: 'Dividendo operativo liquidado estrictamente en cash para repago de pasivos'
  }));
}

export async function getPortfolioSummaryForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      investorId: true,
      investor: {
        select: {
          totalCapital: true,
          marginDebt: true,
          ltv: true
        }
      }
    }
  });

  const distributions = user?.investorId
    ? await prisma.dividendDistribution.findMany({
        where: {
          userId,
          status: LIQUIDATED_CASH_STATUS,
          appliedToMargin: false
        },
        select: { amount: true, appliedAmount: true }
      })
    : [];

  const availableCash = distributions.reduce((sum, row) => {
    const remaining = row.amount.minus(row.appliedAmount);
    return remaining.gt(0) ? sum + remaining.toNumber() : sum;
  }, 0);

  return {
    userId: user?.investorId ?? userId,
    capital: user?.investor?.totalCapital.toNumber() ?? 0,
    marginDebt: user?.investor?.marginDebt.toNumber() ?? 0,
    ltv: user?.investor?.ltv.toNumber() ?? 0,
    availableCash
  };
}

export async function repayMarginWithAvailableCash(userId: string) {
  const investor = await prisma.investor.findFirst({
    where: { user: { id: userId } },
    select: { id: true, marginDebt: true, totalCapital: true }
  });

  if (!investor) {
    throw new Error('INVESTOR_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    const availableDistributions = await tx.dividendDistribution.findMany({
      where: {
        userId,
        status: LIQUIDATED_CASH_STATUS,
        appliedToMargin: false
      },
      select: {
        id: true,
        amount: true,
        appliedAmount: true
      },
      orderBy: { distributedAt: 'asc' }
    });

    const cashForRepayment = availableDistributions.reduce((sum, distribution) => {
      const remainingOnDistribution = distribution.amount.minus(distribution.appliedAmount);
      return remainingOnDistribution.gt(0) ? sum.plus(remainingOnDistribution) : sum;
    }, new Prisma.Decimal(0));

    if (cashForRepayment.lte(0)) {
      throw new Error('NO_CASH_AVAILABLE');
    }

    const activeMarginDebt = investor.marginDebt;
    const repaymentAmount = Prisma.Decimal.min(cashForRepayment, activeMarginDebt);
    const newMarginDebt = activeMarginDebt.minus(repaymentAmount);
    const newLtv = investor.totalCapital.gt(0)
      ? newMarginDebt.div(investor.totalCapital).mul(100).toDecimalPlaces(4)
      : new Prisma.Decimal(0);

    let repaymentRemaining = repaymentAmount;
    const appliedAt = new Date();

    for (const distribution of availableDistributions) {
      if (repaymentRemaining.lte(0)) break;

      const distributionRemaining = distribution.amount.minus(distribution.appliedAmount);
      if (distributionRemaining.lte(0)) continue;

      const appliedOnDistribution = Prisma.Decimal.min(distributionRemaining, repaymentRemaining);
      const nextAppliedAmount = distribution.appliedAmount.plus(appliedOnDistribution);
      const fullyApplied = nextAppliedAmount.gte(distribution.amount);

      await tx.dividendDistribution.update({
        where: { id: distribution.id },
        data: {
          appliedAmount: nextAppliedAmount,
          appliedToMargin: fullyApplied,
          status: fullyApplied ? APPLIED_TO_MARGIN_STATUS : LIQUIDATED_CASH_STATUS,
          appliedAt: fullyApplied ? appliedAt : null
        }
      });

      repaymentRemaining = repaymentRemaining.minus(appliedOnDistribution);
    }

    await tx.investor.update({
      where: { id: investor.id },
      data: {
        marginDebt: newMarginDebt,
        ltv: newLtv
      }
    });

    await tx.portfolio.updateMany({
      where: { userId },
      data: {
        activeMarginDebt: newMarginDebt,
        ltv: newLtv
      }
    });

    return {
      status: 'APPLIED_TO_MARGIN',
      repaymentAmount: repaymentAmount.toNumber(),
      activeMarginDebt: newMarginDebt.toNumber(),
      ltv: newLtv.toNumber()
    };
  });
}
