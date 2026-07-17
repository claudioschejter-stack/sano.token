import { prisma, Prisma, type PlatformWithdrawalMethod, type PlatformWithdrawalStatus } from '@sanova/database';
import { assertOperationalInvestor, getUserPurchaseContext } from '../investor/investorService';
import { createTransakOffRampCheckout } from './paymentOnRampAdapters';
import { getStablecoinNetwork } from './stablecoinNetworks';
import { recordAdminAuditLog } from '../admin/assetsService';
import { verifyUsdcTransferOnBase } from '../blockchain/verifyUsdcTransfer';
import { createNotification } from '../notifications/notificationService';
import { sendWithdrawalConfirmedEmail, sendWithdrawalRejectedEmail } from '../email/withdrawalEmails';

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

const FULFILLABLE_STATUSES: PlatformWithdrawalStatus[] = ['PENDING', 'PROCESSING', 'MANUAL_REVIEW'];

export async function listWithdrawalsForAdmin(status?: PlatformWithdrawalStatus | 'ALL') {
  const where = !status || status === 'ALL' ? {} : { status };
  const withdrawals = await prisma.platformWithdrawal.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 200
  });

  const userIds = Array.from(new Set(withdrawals.map((w) => w.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true }
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  return withdrawals.map((withdrawal) => ({
    ...serializeWithdrawal(withdrawal),
    investorEmail: userById.get(withdrawal.userId)?.email ?? null,
    investorName: userById.get(withdrawal.userId)?.name ?? null
  }));
}

export async function confirmPlatformWithdrawal(input: {
  withdrawalId: string;
  adminUserId: string;
  txHash: string;
}) {
  const withdrawal = await prisma.platformWithdrawal.findUnique({ where: { id: input.withdrawalId } });
  if (!withdrawal) {
    throw new Error('WITHDRAWAL_NOT_FOUND');
  }
  if (!FULFILLABLE_STATUSES.includes(withdrawal.status)) {
    throw new Error('WITHDRAWAL_NOT_FULFILLABLE');
  }

  const txHash = input.txHash.trim();
  if (!txHash) {
    throw new Error('TX_HASH_REQUIRED');
  }

  let verification: { ok: boolean; reason?: string; confirmations?: number } = { ok: false, reason: 'SKIPPED' };
  if (withdrawal.method === 'STABLECOIN' && withdrawal.destinationAddress) {
    const network = getStablecoinNetwork(withdrawal.stablecoinNetwork);
    verification = await verifyUsdcTransferOnBase({
      txHash,
      expectedTo: withdrawal.destinationAddress,
      expectedAmountUsd: Number(withdrawal.amountUsd),
      expectedFrom: network.treasuryAddress,
      stablecoinNetwork: withdrawal.stablecoinNetwork
    });
  }

  const updated = await prisma.platformWithdrawal.update({
    where: { id: withdrawal.id },
    data: {
      status: 'CONFIRMED',
      txHash,
      confirmedAt: new Date(),
      metadata: {
        ...((withdrawal.metadata as Record<string, unknown>) ?? {}),
        confirmedBy: input.adminUserId,
        onChainVerification: verification
      } as Prisma.InputJsonObject
    }
  });

  await recordAdminAuditLog({
    actorUserId: input.adminUserId,
    action: 'WITHDRAWAL_CONFIRMED',
    targetUserId: withdrawal.userId,
    metadata: { withdrawalId: withdrawal.id, txHash, verification } as Prisma.InputJsonValue
  });

  const user = await prisma.user.findUnique({ where: { id: withdrawal.userId }, select: { email: true, name: true } });
  if (user?.email) {
    await sendWithdrawalConfirmedEmail({
      to: user.email,
      name: user.name,
      amountUsd: Number(withdrawal.amountUsd),
      txHash
    });
  }
  await createNotification({
    userId: withdrawal.userId,
    type: 'withdrawal_confirmed',
    title: 'Retiro confirmado',
    body: `Tu retiro de ${Number(withdrawal.amountUsd).toFixed(2)} USDC fue enviado.`,
    link: '/dashboard/wallet'
  });

  return serializeWithdrawal(updated);
}

export async function rejectPlatformWithdrawal(input: {
  withdrawalId: string;
  adminUserId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error('REJECTION_REASON_REQUIRED');
  }

  const withdrawal = await prisma.platformWithdrawal.findUnique({ where: { id: input.withdrawalId } });
  if (!withdrawal) {
    throw new Error('WITHDRAWAL_NOT_FOUND');
  }
  if (!FULFILLABLE_STATUSES.includes(withdrawal.status)) {
    throw new Error('WITHDRAWAL_NOT_FULFILLABLE');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const account = await tx.platformWalletAccount.findUnique({
      where: { userId_currency: { userId: withdrawal.userId, currency: 'USD' } }
    });
    if (!account) {
      throw new Error('PLATFORM_ACCOUNT_NOT_FOUND');
    }

    const amount = withdrawal.amountUsd;
    const nextBalance = account.balance.plus(amount);

    await tx.platformWalletAccount.update({
      where: { id: account.id },
      data: { balance: nextBalance }
    });

    await tx.platformWalletLedgerEntry.create({
      data: {
        accountId: account.id,
        userId: withdrawal.userId,
        investorId: withdrawal.investorId,
        type: 'REFUND_CREDIT',
        amount,
        currency: 'USD',
        balanceAfter: nextBalance,
        idempotencyKey: `withdraw-reject:${withdrawal.id}`,
        metadata: { withdrawalId: withdrawal.id, reason }
      }
    });

    return tx.platformWithdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: 'FAILED',
        metadata: {
          ...((withdrawal.metadata as Record<string, unknown>) ?? {}),
          rejectedBy: input.adminUserId,
          rejectionReason: reason
        } as Prisma.InputJsonObject
      }
    });
  });

  await recordAdminAuditLog({
    actorUserId: input.adminUserId,
    action: 'WITHDRAWAL_REJECTED',
    targetUserId: withdrawal.userId,
    metadata: { withdrawalId: withdrawal.id, reason } as Prisma.InputJsonValue
  });

  const user = await prisma.user.findUnique({ where: { id: withdrawal.userId }, select: { email: true, name: true } });
  if (user?.email) {
    await sendWithdrawalRejectedEmail({
      to: user.email,
      name: user.name,
      amountUsd: Number(withdrawal.amountUsd),
      reason
    });
  }
  await createNotification({
    userId: withdrawal.userId,
    type: 'withdrawal_rejected',
    title: 'Retiro rechazado',
    body: `Tu retiro de ${Number(withdrawal.amountUsd).toFixed(2)} USDC fue rechazado y el saldo fue restituido. Motivo: ${reason}`,
    link: '/dashboard/wallet'
  });

  return serializeWithdrawal(updated);
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
