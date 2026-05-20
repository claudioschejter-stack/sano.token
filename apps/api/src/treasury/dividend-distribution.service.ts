import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InvestmentStatus, KycStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const LIQUIDATED_CASH_STATUS = 'LIQUIDATED_CASH';
const USD_MICRO_UNITS = 1_000_000;

type InvestorDistributionInput = {
  investorId: string;
  walletAddress: string;
  tokenCount: number;
};

export type DividendDistributionResult = {
  assetId: string;
  projectId: string;
  totalCashToDistribute: string;
  totalEligibleTokens: number;
  status: 'DISTRIBUTED' | 'NO_ELIGIBLE_INVESTORS';
  distributions: Array<{
    userId: string;
    walletAddress: string;
    tokenCount: number;
    ownershipPercent: number;
    amountUsd: string;
    status: typeof LIQUIDATED_CASH_STATUS;
  }>;
};

@Injectable()
export class DividendDistributionService {
  private readonly logger = new Logger(DividendDistributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  @Cron('0 0 1 * *', {
    name: 'monthly-property-yield-distribution',
    timeZone: 'UTC'
  })
  async handleMonthlyDistributionCron() {
    const assetId = this.configService.get<string>('MONTHLY_DISTRIBUTION_ASSET_ID');
    const totalCashToDistribute = Number(this.configService.get<string>('MONTHLY_CASH_TO_DISTRIBUTE_USD'));

    if (!assetId || !Number.isFinite(totalCashToDistribute) || totalCashToDistribute <= 0) {
      this.logger.warn(
        'Monthly dividend cron skipped. Set MONTHLY_DISTRIBUTION_ASSET_ID and MONTHLY_CASH_TO_DISTRIBUTE_USD.'
      );
      return;
    }

    await this.distributePropertyYield(assetId, totalCashToDistribute);
  }

  async distributePropertyYield(
    assetId: string,
    totalCashToDistribute: number
  ): Promise<DividendDistributionResult> {
    if (!assetId.trim()) {
      throw new Error('assetId is required for dividend distribution.');
    }

    if (!Number.isFinite(totalCashToDistribute) || totalCashToDistribute <= 0) {
      throw new Error('totalCashToDistribute must be a positive finite number.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: {
          OR: [
            { id: assetId },
            { title: { contains: assetId, mode: 'insensitive' } },
            { location: { contains: assetId, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          title: true
        }
      });

      if (!project) {
        throw new Error(`No project found for assetId=${assetId}.`);
      }

      const eligibleInvestments = await tx.investment.findMany({
        where: {
          projectId: project.id,
          status: InvestmentStatus.ACTIVE,
          investor: {
            kycStatus: KycStatus.APPROVED
          }
        },
        select: {
          tokenCount: true,
          investor: {
            select: {
              id: true,
              walletAddress: true
            }
          }
        },
        orderBy: {
          purchasedAt: 'asc'
        }
      });

      const holdingsByInvestor = new Map<string, InvestorDistributionInput>();

      for (const investment of eligibleInvestments) {
        const current = holdingsByInvestor.get(investment.investor.id);

        if (current) {
          current.tokenCount += investment.tokenCount;
          continue;
        }

        holdingsByInvestor.set(investment.investor.id, {
          investorId: investment.investor.id,
          walletAddress: investment.investor.walletAddress,
          tokenCount: investment.tokenCount
        });
      }

      const holders = [...holdingsByInvestor.values()].filter((holder) => holder.tokenCount > 0);
      const totalEligibleTokens = holders.reduce((sum, holder) => sum + holder.tokenCount, 0);

      if (!holders.length || totalEligibleTokens <= 0) {
        this.logger.warn(`No KYC-approved token holders found for assetId=${assetId} project=${project.id}`);

        return {
          assetId,
          projectId: project.id,
          totalCashToDistribute: new Prisma.Decimal(totalCashToDistribute).toFixed(6),
          totalEligibleTokens: 0,
          status: 'NO_ELIGIBLE_INVESTORS' as const,
          distributions: []
        };
      }

      const totalCashMicroUnits = BigInt(Math.round(totalCashToDistribute * USD_MICRO_UNITS));
      let distributedMicroUnits = 0n;

      const distributions = holders.map((holder, index) => {
        const isLast = index === holders.length - 1;
        const amountMicroUnits = isLast
          ? totalCashMicroUnits - distributedMicroUnits
          : (totalCashMicroUnits * BigInt(holder.tokenCount)) / BigInt(totalEligibleTokens);

        distributedMicroUnits += amountMicroUnits;

        const amountUsd = new Prisma.Decimal(amountMicroUnits.toString()).div(USD_MICRO_UNITS);
        const ownershipPercent = Number(((holder.tokenCount / totalEligibleTokens) * 100).toFixed(6));

        return {
          userId: holder.investorId,
          walletAddress: holder.walletAddress,
          tokenCount: holder.tokenCount,
          ownershipPercent,
          amountUsd
        };
      });

      await tx.dividendDistribution.createMany({
        data: distributions.map((distribution) => ({
          assetId: project.id,
          userId: distribution.userId,
          amount: distribution.amountUsd,
          currency: 'USD',
          status: LIQUIDATED_CASH_STATUS,
          appliedToMargin: false
        }))
      });

      return {
        assetId,
        projectId: project.id,
        totalCashToDistribute: new Prisma.Decimal(totalCashToDistribute).toFixed(6),
        totalEligibleTokens,
        status: 'DISTRIBUTED' as const,
        distributions: distributions.map((distribution) => ({
          userId: distribution.userId,
          walletAddress: distribution.walletAddress,
          tokenCount: distribution.tokenCount,
          ownershipPercent: distribution.ownershipPercent,
          amountUsd: distribution.amountUsd.toFixed(6),
          status: LIQUIDATED_CASH_STATUS as typeof LIQUIDATED_CASH_STATUS
        }))
      };
    });

    const distributedTotal = result.distributions.reduce(
      (sum, distribution) => sum.plus(distribution.amountUsd),
      new Prisma.Decimal(0)
    );

    this.logger.log(
      `Dividend distribution completed assetId=${result.assetId} projectId=${result.projectId} status=${result.status} totalCash=${result.totalCashToDistribute} distributed=${distributedTotal.toFixed(6)} investors=${result.distributions.length} eligibleTokens=${result.totalEligibleTokens}`
    );

    for (const distribution of result.distributions) {
      this.logger.log(
        `Dividend allocation assetId=${result.assetId} userId=${distribution.userId} wallet=${distribution.walletAddress} tokens=${distribution.tokenCount} ownership=${distribution.ownershipPercent}% amountUsd=${distribution.amountUsd} status=${distribution.status}`
      );
    }

    return result;
  }
}
