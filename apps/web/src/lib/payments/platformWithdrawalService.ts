import { prisma, Prisma, type PlatformWithdrawalMethod } from '@sanova/database';
import { assertOperationalInvestor, getUserPurchaseContext } from '../investor/investorService';
import { createTransakOffRampCheckout } from './paymentOnRampAdapters';
import { getStablecoinNetwork } from './stablecoinNetworks';

export async function createPlatformWithdrawal(input: {
  userId: string;
  amountUsd: number;
  method: PlatformWithdrawalMethod;
  destinationAddress?: string | null;
  stablecoinNetwork?: string | null;
}) {
  const user = await getUserPurchaseContext(input.userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  assertOperationalInvestor(user);

  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    throw new Error('INVALID_WITHDRAWAL_AMOUNT');
  }

  if (input.method === 'STABLECOIN' && !input.destinationAddress?.trim()) {
    throw new Error('DESTINATION_ADDRESS_REQUIRED');
  }

  const network = getStablecoinNetwork(input.stablecoinNetwork);
  const idempotencyKey = `${input.userId}:withdraw:${input.method}:${input.amountUsd}:${input.destinationAddress ?? 'fiat'}:${Date.now()}`;

  const withdrawal = await prisma.$transaction(async (tx) => {
    const account = await tx.platformWalletAccount.findUnique({
      where: { userId_currency: { userId: input.userId, currency: 'USD' } }
    });

    if (!account) {
      throw new Error('INSUFFICIENT_PLATFORM_BALANCE');
    }

    const amount = new Prisma.Decimal(input.amountUsd);
    if (account.balance.minus(account.reserved).lessThan(amount)) {
      throw new Error('INSUFFICIENT_PLATFORM_BALANCE');
    }

    const nextBalance = account.balance.minus(amount);
    await tx.platformWalletAccount.update({
      where: { id: account.id },
      data: { balance: nextBalance }
    });

    const created = await tx.platformWithdrawal.create({
      data: {
        userId: input.userId,
        investorId: user.investorId,
        amountUsd: amount,
        method: input.method,
        status: input.method === 'FIAT' ? 'MANUAL_REVIEW' : 'PENDING',
        stablecoinNetwork: input.method === 'STABLECOIN' ? network.id : null,
        destinationAddress: input.destinationAddress?.trim() ?? null,
        idempotencyKey,
        metadata: {
          requestedAt: new Date().toISOString(),
          networkKind: network.kind
        }
      }
    });

    await tx.platformWalletLedgerEntry.create({
      data: {
        accountId: account.id,
        userId: input.userId,
        investorId: user.investorId,
        type: 'WITHDRAWAL_DEBIT',
        amount: amount.negated(),
        currency: 'USD',
        balanceAfter: nextBalance,
        idempotencyKey: `withdraw-debit:${created.id}`,
        metadata: { withdrawalId: created.id, method: input.method }
      }
    });

    return created;
  });

  if (input.method === 'FIAT' && input.destinationAddress?.trim()) {
    const checkout = createTransakOffRampCheckout({
      withdrawalId: withdrawal.id,
      amountUsd: input.amountUsd,
      walletAddress: input.destinationAddress.trim(),
      userEmail: user.email
    });

    if (checkout.providerCheckoutUrl) {
      const updated = await prisma.platformWithdrawal.update({
        where: { id: withdrawal.id },
        data: {
          provider: checkout.provider,
          providerPaymentId: checkout.providerPaymentId,
          providerCheckoutUrl: checkout.providerCheckoutUrl,
          metadata: {
            ...((withdrawal.metadata as Record<string, unknown>) ?? {}),
            provider: checkout.metadata
          } as Prisma.InputJsonObject
        }
      });
      return serializeWithdrawal(updated);
    }
  }

  return serializeWithdrawal(withdrawal);
}

export function serializeWithdrawal(withdrawal: {
  id: string;
  status: string;
  method: string;
  amountUsd: Prisma.Decimal;
  currency: string;
  stablecoinNetwork: string | null;
  destinationAddress: string | null;
  providerCheckoutUrl: string | null;
  txHash: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
}) {
  return {
    id: withdrawal.id,
    status: withdrawal.status,
    method: withdrawal.method,
    amountUsd: withdrawal.amountUsd.toString(),
    currency: withdrawal.currency,
    stablecoinNetwork: withdrawal.stablecoinNetwork,
    destinationAddress: withdrawal.destinationAddress,
    providerCheckoutUrl: withdrawal.providerCheckoutUrl,
    txHash: withdrawal.txHash,
    createdAt: withdrawal.createdAt.toISOString(),
    confirmedAt: withdrawal.confirmedAt?.toISOString() ?? null
  };
}
