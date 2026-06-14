import { prisma, Prisma, type RentPayoutPreference } from '@sanova/database';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { getOrCreatePlatformWalletAccount } from '../payments/platformWalletService';
import { calculateRentCommissionSplit } from '../commission/commissionService';
import { debitProjectOperatingForDistribution } from '../yield/projectOperatingService';

const LIQUIDATED_CASH_STATUS = 'LIQUIDATED_CASH';
const LIQUIDATED_FIAT_STATUS = 'LIQUIDATED_FIAT';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

export type RentPayoutPreferenceValue = RentPayoutPreference;

export async function getRentPayoutPreferenceForUser(userId: string): Promise<RentPayoutPreferenceValue | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      investor: {
        select: { rentPayoutPreference: true }
      }
    }
  });

  return user?.investor?.rentPayoutPreference ?? null;
}

export async function updateRentPayoutPreferenceForUser(
  userId: string,
  preference: RentPayoutPreferenceValue
): Promise<RentPayoutPreferenceValue> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { investorId: true, walletAddress: true, investor: { select: { walletAddress: true } } }
  });

  if (!user?.investorId) {
    throw new Error('INVESTOR_NOT_FOUND');
  }

  if (preference === 'USDC') {
    const payoutWallet = user.walletAddress?.trim() || user.investor?.walletAddress?.trim();
    if (!payoutWallet) {
      throw new Error('INVESTOR_WALLET_REQUIRED');
    }
  }

  const investor = await prisma.investor.update({
    where: { id: user.investorId },
    data: { rentPayoutPreference: preference },
    select: { rentPayoutPreference: true }
  });

  return investor.rentPayoutPreference;
}

export async function creditRentToPlatformWallet(input: {
  userId: string;
  investorId: string;
  amountUsd: number | Prisma.Decimal;
  projectId: string;
  idempotencyKey: string;
  batchId?: string | null;
  sourceCurrency?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.platformWalletLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (existing) {
      return existing;
    }

    const account = await tx.platformWalletAccount.upsert({
      where: { userId_currency: { userId: input.userId, currency: 'USD' } },
      create: { userId: input.userId, investorId: input.investorId, currency: 'USD' },
      update: { investorId: input.investorId }
    });

    const amount = new Prisma.Decimal(input.amountUsd);
    const nextBalance = account.balance.plus(amount);

    await tx.platformWalletAccount.update({
      where: { id: account.id },
      data: { balance: nextBalance }
    });

    return tx.platformWalletLedgerEntry.create({
      data: {
        accountId: account.id,
        userId: input.userId,
        investorId: input.investorId,
        type: 'RENT_CREDIT',
        amount,
        currency: 'USD',
        balanceAfter: nextBalance,
        idempotencyKey: input.idempotencyKey,
        metadata: {
          projectId: input.projectId,
          batchId: input.batchId ?? null,
          sourceCurrency: input.sourceCurrency ?? 'USD',
          payoutMode: 'FIAT',
          ...(input.metadata as object)
        } as Prisma.InputJsonObject
      }
    });
  });
}

async function resolveRpcUrl(chainId: number): Promise<string> {
  if (chainId === 8453) {
    return process.env.BASE_RPC_URL?.trim() || process.env.LENDING_BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  }
  throw new Error(`UNSUPPORTED_CHAIN:${chainId}`);
}

export async function sendUsdcRentToInvestorWallet(input: {
  walletAddress: string;
  amountUsd: number;
  chainId?: number;
}): Promise<{ status: 'SUBMITTED' | 'SKIPPED'; txHash?: string; reason?: string }> {
  const chainId = input.chainId ?? 8453;
  const privateKey = process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim();
  const usdcAddress =
    process.env.BASE_USDC_TOKEN_ADDRESS?.trim() || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  if (!privateKey) {
    return { status: 'SKIPPED', reason: 'TREASURY_KEY_NOT_CONFIGURED' };
  }

  const provider = new JsonRpcProvider(await resolveRpcUrl(chainId));
  try {
    const wallet = new Wallet(privateKey, provider);
    const usdc = new Contract(usdcAddress, ERC20_ABI, wallet);
    const decimals = Number(await usdc.decimals());
    const amountBaseUnits = BigInt(Math.floor(input.amountUsd * 10 ** decimals));
    const tx = await usdc.transfer(input.walletAddress, amountBaseUnits);
    const receipt = await tx.wait();
    return { status: 'SUBMITTED', txHash: receipt?.hash ?? tx.hash };
  } finally {
    provider.destroy();
  }
}

export async function payRentShareToInvestor(input: {
  userId: string;
  investorId: string;
  walletAddress: string | null;
  preference: RentPayoutPreferenceValue;
  projectId: string;
  amountUsd: number;
  idempotencyKey: string;
  batchId?: string | null;
  chainId?: number;
  sourceCurrency?: string | null;
}) {
  if (input.amountUsd <= 0) {
    return { mode: input.preference, skipped: true as const };
  }

  const rentFee = await calculateRentCommissionSplit({
    investorId: input.investorId,
    grossRentUsd: input.amountUsd,
    projectId: input.projectId,
    idempotencyPrefix: `${input.idempotencyKey}:fee`
  });

  const netRentUsd = rentFee?.netAmountUsd ?? input.amountUsd;

  if (netRentUsd <= 0) {
    return { mode: input.preference, skipped: true as const, fee: rentFee };
  }

  if (input.preference === 'FIAT') {
    await creditRentToPlatformWallet({
      userId: input.userId,
      investorId: input.investorId,
      amountUsd: netRentUsd,
      projectId: input.projectId,
      idempotencyKey: input.idempotencyKey,
      batchId: input.batchId,
      sourceCurrency: input.sourceCurrency
    });

    await prisma.dividendDistribution.create({
      data: {
        assetId: input.projectId,
        userId: input.investorId,
        platformUserId: input.userId,
        amount: netRentUsd,
        currency: 'USD',
        status: LIQUIDATED_FIAT_STATUS,
        appliedToMargin: false
      }
    }).catch(() => undefined);

    return { mode: 'FIAT' as const, credited: true as const, fee: rentFee, netRentUsd };
  }

  if (!input.walletAddress?.trim()) {
    throw new Error('WALLET_REQUIRED_FOR_USDC_RENT');
  }

  if (input.batchId) {
    const existingUsdcPayout = await prisma.dividendDistribution.findFirst({
      where: {
        assetId: input.projectId,
        userId: input.investorId,
        status: LIQUIDATED_CASH_STATUS,
        txHash: { not: null }
      },
      orderBy: { distributedAt: 'desc' }
    });

    if (
      existingUsdcPayout &&
      Math.abs(existingUsdcPayout.amount.toNumber() - netRentUsd) < 0.000001
    ) {
      return {
        mode: 'USDC' as const,
        distributionId: existingUsdcPayout.id,
        transfer: {
          status: 'SUBMITTED' as const,
          txHash: existingUsdcPayout.txHash ?? undefined
        },
        fee: rentFee,
        netRentUsd,
        alreadyPaid: true as const
      };
    }
  }

  const transfer = await sendUsdcRentToInvestorWallet({
    walletAddress: input.walletAddress.trim(),
    amountUsd: netRentUsd,
    chainId: input.chainId
  });

  if (transfer.status === 'SKIPPED') {
    throw new Error(transfer.reason ?? 'USDC_RENT_TRANSFER_SKIPPED');
  }

  const distribution = await prisma.dividendDistribution.create({
    data: {
      assetId: input.projectId,
      userId: input.investorId,
      platformUserId: input.userId,
      amount: netRentUsd,
      currency: 'USD',
      txHash: transfer.txHash ?? undefined,
      status: LIQUIDATED_CASH_STATUS,
      appliedToMargin: false
    }
  });

  return {
    mode: 'USDC' as const,
    distributionId: distribution.id,
    transfer,
    fee: rentFee,
    netRentUsd
  };
}

type HolderRow = {
  investorId: string;
  userId: string;
  walletAddress: string | null;
  preference: RentPayoutPreferenceValue;
  tokenCount: number;
};

export async function allocateProjectRentByPreference(input: {
  projectId: string;
  totalAmountUsd: number;
  batchId?: string | null;
  chainId?: number;
  sourceCurrency?: string | null;
  idempotencyPrefix: string;
  /** When set, debits operating balance per successful payout (not upfront). */
  operatingSource?: {
    accountId: string;
    totalSourceAmount: number;
    sourceCurrency: string;
  };
}) {
  if (!Number.isFinite(input.totalAmountUsd) || input.totalAmountUsd <= 0) {
    throw new Error('INVALID_RENT_AMOUNT');
  }

  const investments = await prisma.investment.findMany({
    where: {
      projectId: input.projectId,
      status: 'ACTIVE',
      investor: { kycStatus: 'APPROVED' }
    },
    include: {
      investor: {
        select: {
          id: true,
          walletAddress: true,
          rentPayoutPreference: true,
          user: { select: { id: true } }
        }
      }
    }
  });

  const holdersByInvestor = new Map<string, HolderRow>();

  for (const investment of investments) {
    const investor = investment.investor;
    const userId = investor.user?.id;
    if (!userId) {
      continue;
    }

    const existing = holdersByInvestor.get(investor.id);
    if (existing) {
      existing.tokenCount += investment.tokenCount;
      continue;
    }

    holdersByInvestor.set(investor.id, {
      investorId: investor.id,
      userId,
      walletAddress: investor.walletAddress,
      preference: investor.rentPayoutPreference,
      tokenCount: investment.tokenCount
    });
  }

  const holders = [...holdersByInvestor.values()].filter((row) => row.tokenCount > 0);
  const totalTokens = holders.reduce((sum, row) => sum + row.tokenCount, 0);

  if (!holders.length || totalTokens <= 0) {
    return { projectId: input.projectId, status: 'NO_ELIGIBLE_INVESTORS' as const, allocations: [] };
  }

  const totalMicro = BigInt(Math.round(input.totalAmountUsd * 1_000_000));
  let distributedMicro = 0n;
  const allocations = [];
  let distributedSourceAmount = 0;
  let failures = 0;

  for (let index = 0; index < holders.length; index += 1) {
    const holder = holders[index]!;
    const isLast = index === holders.length - 1;
    const shareMicro = isLast
      ? totalMicro - distributedMicro
      : (totalMicro * BigInt(holder.tokenCount)) / BigInt(totalTokens);
    distributedMicro += shareMicro;

    const shareUsd = Number(shareMicro) / 1_000_000;
    const idempotencyKey = `${input.idempotencyPrefix}:${holder.investorId}:${input.batchId ?? 'direct'}`;
    const operatingDebitKey = `${idempotencyKey}:operating-debit`;

    if (input.operatingSource) {
      const existingDebit = await prisma.projectOperatingLedgerEntry.findUnique({
        where: { idempotencyKey: operatingDebitKey }
      });
      if (existingDebit) {
        allocations.push({
          investorId: holder.investorId,
          tokenCount: holder.tokenCount,
          amountUsd: shareUsd,
          preference: holder.preference,
          result: { mode: holder.preference, skipped: true, alreadyPaid: true }
        });
        continue;
      }
    }

    try {
      const result = await payRentShareToInvestor({
        userId: holder.userId,
        investorId: holder.investorId,
        walletAddress: holder.walletAddress,
        preference: holder.preference,
        projectId: input.projectId,
        amountUsd: shareUsd,
        idempotencyKey,
        batchId: input.batchId,
        chainId: input.chainId,
        sourceCurrency: input.sourceCurrency
      });

      if (input.operatingSource && shareUsd > 0) {
        const shareSourceAmount =
          isLast && index === holders.length - 1
            ? input.operatingSource.totalSourceAmount - distributedSourceAmount
            : (input.operatingSource.totalSourceAmount * shareUsd) / input.totalAmountUsd;

        await debitProjectOperatingForDistribution({
          accountId: input.operatingSource.accountId,
          projectId: input.projectId,
          amount: shareSourceAmount,
          currency: input.operatingSource.sourceCurrency,
          idempotencyKey: `${idempotencyKey}:operating-debit`,
          metadata: { investorId: holder.investorId, shareUsd }
        });

        distributedSourceAmount += shareSourceAmount;
      }

      allocations.push({
        investorId: holder.investorId,
        tokenCount: holder.tokenCount,
        amountUsd: shareUsd,
        preference: holder.preference,
        result
      });
    } catch (error) {
      failures += 1;
      allocations.push({
        investorId: holder.investorId,
        tokenCount: holder.tokenCount,
        amountUsd: shareUsd,
        preference: holder.preference,
        error: error instanceof Error ? error.message : 'PAYOUT_FAILED'
      });
      break;
    }
  }

  const distributedUsd = allocations
    .filter((row) => !('error' in row))
    .reduce((sum, row) => sum + row.amountUsd, 0);

  return {
    projectId: input.projectId,
    status:
      failures > 0
        ? ('PARTIAL' as const)
        : ('ALLOCATED' as const),
    totalAmountUsd: input.totalAmountUsd,
    distributedAmountUsd: distributedUsd,
    distributedSourceAmount,
    allocations
  };
}

export async function ensurePlatformWalletForUser(userId: string, investorId?: string | null) {
  return getOrCreatePlatformWalletAccount(userId, investorId);
}
