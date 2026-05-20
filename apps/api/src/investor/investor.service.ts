import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_MAX_LTV = 0.6;
const CASH_FLOW_STATUS = 'Liquidado en Efectivo';
const LIQUIDATED_CASH_STATUS = 'LIQUIDATED_CASH';
const APPLIED_TO_MARGIN_STATUS = 'APPLIED_TO_MARGIN';

@Injectable()
export class InvestorService {
  constructor(private readonly prisma: PrismaService) {}

  async repayMarginWithAvailableCash(userId: string) {
    if (!userId?.trim()) {
      throw new BadRequestException('userId is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const investor = await tx.investor.findUnique({
        where: { id: userId },
        select: {
          id: true,
          marginDebt: true,
          totalCapital: true
        }
      });

      if (!investor) {
        throw new NotFoundException(`Investor not found for userId: ${userId}`);
      }

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
        orderBy: {
          distributedAt: 'asc'
        }
      });

      const cashForRepayment = availableDistributions.reduce((sum, distribution) => {
        const remainingOnDistribution = distribution.amount.minus(distribution.appliedAmount);
        return remainingOnDistribution.gt(0) ? sum.plus(remainingOnDistribution) : sum;
      }, new Prisma.Decimal(0));

      if (cashForRepayment.lte(0)) {
        throw new BadRequestException('Investor has no accumulated cash available for repayment.');
      }

      const activeMarginDebt = investor.marginDebt;
      const repaymentAmount = Prisma.Decimal.min(cashForRepayment, activeMarginDebt);
      const remainingAmount = cashForRepayment.minus(repaymentAmount);
      const newMarginDebt = activeMarginDebt.minus(repaymentAmount);
      const newLtv = investor.totalCapital.gt(0)
        ? newMarginDebt.div(investor.totalCapital).mul(100).toDecimalPlaces(4)
        : new Prisma.Decimal(0);

      let repaymentRemaining = repaymentAmount;
      const appliedAt = new Date();
      let appliedDistributionCount = 0;

      for (const distribution of availableDistributions) {
        if (repaymentRemaining.lte(0)) {
          break;
        }

        const distributionRemaining = distribution.amount.minus(distribution.appliedAmount);
        if (distributionRemaining.lte(0)) {
          continue;
        }

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
        appliedDistributionCount += 1;
      }

      await tx.investor.update({
        where: { id: userId },
        data: {
          marginDebt: newMarginDebt,
          ltv: newLtv
        }
      });

      return {
        status: 'APPLIED_TO_MARGIN',
        userId,
        cashForRepayment: cashForRepayment.toFixed(6),
        repaymentAmount: repaymentAmount.toFixed(6),
        appliedAmount: repaymentAmount.toFixed(6),
        remainingAmount: remainingAmount.toFixed(6),
        previousMarginDebt: activeMarginDebt.toFixed(6),
        activeMarginDebt: newMarginDebt.toFixed(6),
        ltv: newLtv.toFixed(4),
        appliedDistributionCount,
        appliedAt: appliedAt.toISOString()
      };
    });
  }

  async getCashFlowHistory() {
    const distributions = await this.prisma.dividendDistribution.findMany({
      where: {
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
      orderBy: {
        distributedAt: 'desc'
      }
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

  async getPortfolioByWallet(wallet: string) {
    const investor = await this.prisma.investor.findFirst({
      where: {
        walletAddress: {
          equals: wallet,
          mode: 'insensitive'
        }
      },
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
          include: {
            project: true
          }
        }
      }
    });

    if (!investor) {
      throw new NotFoundException(`Investor not found for wallet: ${wallet}`);
    }

    const activePositions = investor.investments.map((investment) => ({
        id: investment.id,
        projectId: investment.projectId,
        projectTitle: investment.project.title,
        tokenCount: investment.tokenCount,
        purchasePriceUsd: investment.purchasePriceUsd.toString(),
        purchasedAt: investment.purchasedAt,
        status: investment.status
    }));

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
      activePositions
    };
  }

}
