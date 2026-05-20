import { Injectable, Logger } from '@nestjs/common';
import { InvestmentStatus, KycStatus } from '@prisma/client';
import { BlockchainWriterService } from '../blockchain/blockchain-writer.service';
import { PrismaService } from '../prisma/prisma.service';

export type DividendRoutingInput = {
  borrower: string;
  yieldAmount: bigint;
  amortizedAmount: bigint;
  cashAmount: bigint;
  txHash?: string;
};

@Injectable()
export class TreasuryManagerService {
  private readonly logger = new Logger(TreasuryManagerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainWriter: BlockchainWriterService
  ) {}

  async processDividendPayout(projectId: string, totalYieldAmount: number) {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    if (!Number.isFinite(totalYieldAmount) || totalYieldAmount <= 0) {
      throw new Error('totalYieldAmount must be a positive number');
    }

    const activeInvestments = await this.prisma.investment.findMany({
      where: {
        projectId,
        status: InvestmentStatus.ACTIVE,
        investor: {
          kycStatus: KycStatus.APPROVED
        }
      },
      include: {
        investor: {
          select: {
            id: true,
            fullName: true,
            walletAddress: true,
            dividendPreference: true,
            brokerAccountRef: true,
            kycStatus: true
          }
        }
      },
      orderBy: { purchasedAt: 'asc' }
    });

    const totalTokens = activeInvestments.reduce((sum, investment) => sum + investment.tokenCount, 0);
    if (totalTokens === 0) {
      this.logger.warn(`No active approved investments found for project ${projectId}`);
      return {
        projectId,
        totalYieldAmount,
        status: 'NO_ACTIVE_INVESTORS',
        distributions: []
      };
    }

    const totalYieldRaw = BigInt(Math.round(totalYieldAmount * 1_000_000));
    let distributedRaw = 0n;

    const prioritizedInvestments = [...activeInvestments].sort((a, b) => {
      const aCash = a.investor.dividendPreference === 'CASH' ? 0 : 1;
      const bCash = b.investor.dividendPreference === 'CASH' ? 0 : 1;
      return aCash - bCash;
    });

    const distributions = [];

    for (let index = 0; index < prioritizedInvestments.length; index += 1) {
      const investment = prioritizedInvestments[index];
      const isLast = index === prioritizedInvestments.length - 1;
      const proportionalRaw = isLast
        ? totalYieldRaw - distributedRaw
        : (totalYieldRaw * BigInt(investment.tokenCount)) / BigInt(totalTokens);

      distributedRaw += proportionalRaw;

      const execution = await this.blockchainWriter.executeDistributeYieldAndAmortize(
        investment.investor.walletAddress,
        proportionalRaw
      );

      distributions.push({
        investorId: investment.investor.id,
        walletAddress: investment.investor.walletAddress,
        dividendPreference: investment.investor.dividendPreference,
        brokerAccountRef: investment.investor.brokerAccountRef,
        tokenCount: investment.tokenCount,
        yieldAmountRaw: proportionalRaw.toString(),
        yieldAmountUsdc: (Number(proportionalRaw) / 1_000_000).toFixed(6),
        execution
      });
    }

    this.logger.log(
      `Processed dividend payout project=${projectId} amount=${totalYieldAmount} distributions=${distributions.length}`
    );

    return {
      projectId,
      totalYieldAmount,
      totalYieldRaw: totalYieldRaw.toString(),
      status: 'PROCESSED',
      distributions
    };
  }

  async routeDividendsToAmortization(input: DividendRoutingInput) {
    const borrowerWallet = input.borrower.toLowerCase();

    const investor = await this.prisma.investor.findFirst({
      where: {
        walletAddress: {
          equals: borrowerWallet,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        fullName: true,
        walletAddress: true,
        brokerAccountRef: true,
        dividendPreference: true,
        kycStatus: true
      }
    });

    if (!investor) {
      this.logger.warn(`Dividend route skipped: wallet ${input.borrower} has no investor profile`);
      return {
        status: 'UNMATCHED_WALLET',
        borrower: input.borrower
      };
    }

    const route =
      investor.dividendPreference === 'AMORTIZE' || input.amortizedAmount > 0n
        ? 'AMORTIZATION_FIRST'
        : 'CASH';

    this.logger.log(
      `Dividend routed investor=${investor.id} route=${route} amortized=${input.amortizedAmount.toString()} cash=${input.cashAmount.toString()}`
    );

    return {
      status: 'ROUTED',
      route,
      investorId: investor.id,
      brokerAccountRef: investor.brokerAccountRef,
      dividendPreference: investor.dividendPreference,
      kycStatus: investor.kycStatus,
      txHash: input.txHash,
      amounts: {
        yieldAmount: input.yieldAmount.toString(),
        amortizedAmount: input.amortizedAmount.toString(),
        cashAmount: input.cashAmount.toString()
      }
    };
  }
}
