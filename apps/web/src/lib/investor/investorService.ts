import { prisma, Prisma, type KycStatus, type AccountStatus } from '@sanova/database';
import { calculatePurchaseCommissionSplit } from '../commission/commissionService';
import { isAccountOperational, canAccessMarketplaceCheckout, requiresTotpSetup } from '../onboarding/accountStatus';
import { assertInvestorAccessEnabled } from '../auth/investorAccess';
import { buildTxExplorerUrl, buildVaultExplorerUrl, readVaultPositionsForProjects } from '../portfolio/onChainVaultReader';
import { resolveMorphoDebtForUser } from '../portfolio/morphoDebtForUser';
import { getInvestorIdForPlatformUser } from './projectYieldService';
import { isCuitUniqueConflict, resolveOrphanedInvestorByCuit } from './investorCuitConflict';

const DEFAULT_MAX_LTV = 0.6;
const LIQUIDATED_CASH_STATUS = 'LIQUIDATED_CASH';
const LIQUIDATED_FIAT_STATUS = 'LIQUIDATED_FIAT';
const APPLIED_TO_MARGIN_STATUS = 'APPLIED_TO_MARGIN';

const CASH_FLOW_STATUS_CODES = {
  LIQUIDATED_CASH: 'LIQUIDATED_CASH',
  LIQUIDATED_FIAT: 'LIQUIDATED_FIAT',
  APPLIED_TO_MARGIN: 'APPLIED_TO_MARGIN'
} as const;

const CASH_FLOW_CONCEPT_CODES = {
  OPERATING_DIVIDEND_USDC: 'OPERATING_DIVIDEND_USDC',
  OPERATING_DIVIDEND_FIAT: 'OPERATING_DIVIDEND_FIAT',
  DIVIDEND_APPLIED_TO_MARGIN: 'DIVIDEND_APPLIED_TO_MARGIN'
} as const;

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
  investorAccessEnabled: boolean;
  systemRole: string;
  totpEnabled: boolean;
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
      investorId: true,
      investorAccessEnabled: true,
      systemRole: true,
      totpEnabled: true
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

  assertInvestorAccessEnabled(user);
}

export function assertInvestorCheckoutEligible(user: UserPurchaseContext) {
  if (!canAccessMarketplaceCheckout(user)) {
    if (user.kycStatus !== 'APPROVED') {
      throw new Error('KYC_NOT_APPROVED');
    }

    if (
      requiresTotpSetup(user) &&
      !user.totpEnabled
    ) {
      throw new Error('TOTP_REQUIRED');
    }

    throw new Error('ACCOUNT_NOT_OPERATIONAL');
  }

  assertInvestorAccessEnabled(user);
}

export async function ensureInvestorForUser(
  user: UserPurchaseContext,
  walletAddress: string,
  walletProvider?: string | null
): Promise<string> {
  const normalizedWallet = walletAddress.trim().toLowerCase();
  const providerData =
    walletProvider === undefined ? {} : { walletProvider: walletProvider?.trim() || null };

  if (user.investorId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: normalizedWallet, ...providerData }
    });

    await prisma.investor.update({
      where: { id: user.investorId },
      data: { walletAddress: normalizedWallet }
    });

    return user.investorId;
  }

  const fullName = user.kycFullName?.trim() || user.email.split('@')[0];
  const cuit = user.kycDocumentId?.trim() || `TMP-${user.id.slice(0, 8)}`;

  let investorId: string;
  try {
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
    investorId = investor.id;
  } catch (error) {
    if (!isCuitUniqueConflict(error)) {
      throw error;
    }
    // Same identity document already has an Investor row. Adopt it if it's an
    // orphaned record (no owning user); otherwise this is a genuine duplicate
    // identity across two accounts and callers must surface a clear message.
    investorId = await resolveOrphanedInvestorByCuit(cuit, user.id);
    await prisma.investor.update({
      where: { id: investorId },
      data: { fullName, walletAddress: normalizedWallet, kycStatus: 'APPROVED', kycVerifiedAt: new Date() }
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      investorId,
      walletAddress: normalizedWallet,
      ...providerData
    }
  });

  await prisma.portfolio.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {}
  });

  return investorId;
}

export async function getPortfolioForUser(userId: string) {
  const [user, morphoDebtUsd] = await Promise.all([
    prisma.user.findUnique({
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
            investments: {
              where: { status: 'ACTIVE' },
              orderBy: { purchasedAt: 'desc' },
              include: {
                project: {
                  select: {
                    id: true,
                    title: true,
                    tokenSymbol: true,
                    vaultAddress: true,
                    chainId: true,
                    pricePerToken: true
                  }
                }
              }
            }
          }
        }
      }
    }),
    resolveMorphoDebtForUser(userId)
  ]);

  if (!user?.investor) {
    return {
      investor: null,
      credit: null,
      activePositions: []
    };
  }

  const investor = user.investor;
  const totalCapital = investor.totalCapital.toNumber();
  const ltv = totalCapital > 0 ? (morphoDebtUsd / totalCapital) * 100 : 0;
  const onChainByProject =
    investor.walletAddress && investor.investments.length > 0
      ? await readVaultPositionsForProjects({
          walletAddress: investor.walletAddress,
          projects: investor.investments.map((investment) => ({
            projectId: investment.projectId,
            vaultAddress: investment.project.vaultAddress,
            chainId: investment.project.chainId
          }))
        })
      : new Map();

  /** Asset tokens held on-chain, priced by the project they belong to. */
  const onChainValueUsdFor = (investment: {
    projectId: string;
    project: { pricePerToken: { toNumber(): number } };
  }): number => {
    const onChain = onChainByProject.get(investment.projectId);
    if (!onChain || onChain.assetTokens <= 0) return 0;
    return onChain.assetTokens * investment.project.pricePerToken.toNumber();
  };

  /**
   * Group the purchases by asset before valuing anything.
   *
   * The chain reports one balance per wallet and project, so adding it up per
   * purchase counted the same tokens twice — and this total is what
   * `availableCreditUsd` is derived from, so the platform would have offered
   * credit against collateral that does not exist.
   */
  const investmentsByProject = new Map<string, typeof investor.investments>();
  for (const investment of investor.investments) {
    const group = investmentsByProject.get(investment.projectId);
    if (group) {
      group.push(investment);
    } else {
      investmentsByProject.set(investment.projectId, [investment]);
    }
  }

  const totalCollateralUsd = [...investmentsByProject.values()].reduce((sum, group) => {
    const onChainValue = onChainValueUsdFor(group[0]);
    if (onChainValue > 0) {
      return sum + onChainValue;
    }
    return sum + group.reduce((booked, row) => booked + row.purchasePriceUsd.toNumber(), 0);
  }, 0);

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
      marginDebt: morphoDebtUsd.toFixed(6),
      ltv: ltv.toFixed(4)
    },
    credit: {
      currency: 'USD',
      maxLtv: DEFAULT_MAX_LTV,
      totalCollateralUsd: totalCollateralUsd.toFixed(2),
      availableCreditUsd: (totalCollateralUsd * DEFAULT_MAX_LTV).toFixed(2)
    },
    // One position per asset: buying more of what you own is a bigger holding,
    // not a second one that happens to have the same name.
    activePositions: [...investmentsByProject.values()].map((group) => {
      const investment = group[0];
      const onChain = onChainByProject.get(investment.projectId);
      const tokenCount = group.reduce((sum, row) => sum + row.tokenCount, 0);
      const bookedUsd = group.reduce((sum, row) => sum + row.purchasePriceUsd.toNumber(), 0);
      const onChainValueUsd = onChainValueUsdFor(investment);
      const chainId = onChain?.chainId ?? investment.project.chainId ?? null;

      return {
        id: investment.id,
        projectId: investment.projectId,
        projectTitle: investment.project.title,
        tokenCount,
        purchasePriceUsd: bookedUsd.toFixed(2),
        purchasedAt: investment.purchasedAt.toISOString(),
        status: investment.status,
        txHash: investment.txHash,
        vaultAddress: investment.project.vaultAddress,
        chainId,
        tokenSymbol: investment.project.tokenSymbol,
        onChain: onChain
          ? {
              verified: onChain.verified,
              shares: onChain.shares,
              shareDecimals: onChain.shareDecimals,
              assetTokens: onChain.assetTokens.toFixed(6),
              assetsUsd: onChainValueUsd.toFixed(6),
              walletAddress: onChain.walletAddress,
              explorerUrl: onChain.explorerUrl,
              txExplorerUrl:
                investment.txHash && chainId ? buildTxExplorerUrl(chainId, investment.txHash) : null
            }
          : null,
        currentValueUsd: (onChainValueUsd > 0 ? onChainValueUsd : bookedUsd).toFixed(2)
      };
    })
  };
}

export async function getCashFlowForUser(platformUserId: string) {
  const investorId = await getInvestorIdForPlatformUser(platformUserId);
  if (!investorId) {
    return [];
  }

  const distributions = await prisma.dividendDistribution.findMany({
    where: {
      userId: investorId,
      status: { in: [LIQUIDATED_CASH_STATUS, LIQUIDATED_FIAT_STATUS, APPLIED_TO_MARGIN_STATUS] }
    },
    select: {
      id: true,
      assetId: true,
      amount: true,
      currency: true,
      distributedAt: true,
      status: true,
      txHash: true
    },
    orderBy: { distributedAt: 'desc' }
  });

  return distributions.map((distribution) => {
    const statusCode =
      distribution.status === APPLIED_TO_MARGIN_STATUS
        ? CASH_FLOW_STATUS_CODES.APPLIED_TO_MARGIN
        : distribution.status === LIQUIDATED_FIAT_STATUS
          ? CASH_FLOW_STATUS_CODES.LIQUIDATED_FIAT
          : CASH_FLOW_STATUS_CODES.LIQUIDATED_CASH;

    const conceptCode =
      distribution.status === APPLIED_TO_MARGIN_STATUS
        ? CASH_FLOW_CONCEPT_CODES.DIVIDEND_APPLIED_TO_MARGIN
        : distribution.status === LIQUIDATED_FIAT_STATUS
          ? CASH_FLOW_CONCEPT_CODES.OPERATING_DIVIDEND_FIAT
          : CASH_FLOW_CONCEPT_CODES.OPERATING_DIVIDEND_USDC;

    return {
      id: distribution.id,
      date: distribution.distributedAt.toISOString(),
      assetId: distribution.assetId,
      liquidatedAmountUsd: distribution.amount.toString(),
      currency: distribution.currency,
      statusCode,
      conceptCode,
      txHash: distribution.txHash
    };
  });
}

export async function getPortfolioSummaryForUser(userId: string) {
  const [user, morphoDebtUsd] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        investorId: true,
        investor: {
          select: {
            totalCapital: true
          }
        }
      }
    }),
    resolveMorphoDebtForUser(userId)
  ]);

  const distributions = user?.investorId
    ? await prisma.dividendDistribution.findMany({
        where: {
          userId: user.investorId,
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

  const capital = user?.investor?.totalCapital.toNumber() ?? 0;
  const ltv = capital > 0 ? (morphoDebtUsd / capital) * 100 : 0;

  return {
    userId: user?.investorId ?? userId,
    capital,
    marginDebt: morphoDebtUsd,
    ltv,
    availableCash
  };
}

export async function repayMarginWithAvailableCash(_userId: string) {
  throw new Error('MORPHO_REPAY_ON_CHAIN');
}
