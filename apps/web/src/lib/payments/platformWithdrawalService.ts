import { prisma, Prisma, type PlatformWithdrawalMethod, type PlatformWithdrawalStatus } from '@sanova/database';
import { assertOperationalInvestor, getUserPurchaseContext } from '../investor/investorService';
import { getStablecoinNetwork } from './stablecoinNetworks';
import { recordAdminAuditLog } from '../admin/assetsService';
import { verifyUsdcTransferOnBase } from '../blockchain/verifyUsdcTransfer';
import { assertLinkedCryptoWalletOwnership } from '../investor/linkedWalletsService';
import { createNotification } from '../notifications/notificationService';
import { sendWithdrawalConfirmedEmail, sendWithdrawalRejectedEmail } from '../email/withdrawalEmails';
import { executeBridgeFiatPayout, withdrawalSupportsBridgePayout } from './bridgePayoutService';

export type FiatPayoutRail = 'BANK_OR_WALLET' | 'OTHER';

export type FiatPayoutDetails = {
  rail: FiatPayoutRail;
  accountHolderName: string;
  taxId: string;
  cbuOrCvu?: string | null;
  alias?: string | null;
  providerName?: string | null;
  notes?: string | null;
  /** Bridge.xyz external_account id for US/EU/MX bank payouts (still admin-mediated). */
  bridgeExternalAccountId?: string | null;
  bridgeCurrency?: string | null;
};

export function normalizeFiatPayoutDetails(input: unknown): FiatPayoutDetails {
  const raw = (input ?? {}) as Partial<FiatPayoutDetails>;
  const rail: FiatPayoutRail = raw.rail === 'OTHER' ? 'OTHER' : 'BANK_OR_WALLET';
  const accountHolderName = raw.accountHolderName?.trim() ?? '';
  const taxId = raw.taxId?.trim() ?? '';
  const cbuOrCvu = raw.cbuOrCvu?.trim() ?? '';
  const alias = raw.alias?.trim() ?? '';
  const notes = raw.notes?.trim() ?? '';
  const bridgeExternalAccountId = raw.bridgeExternalAccountId?.trim() ?? '';
  const bridgeCurrency = raw.bridgeCurrency?.trim().toLowerCase() ?? '';

  if (!accountHolderName) {
    throw new Error('PAYOUT_DETAILS_INCOMPLETE');
  }

  // Bridge external accounts are the destination for US/EU/MX rails; tax id optional there.
  if (!bridgeExternalAccountId && !taxId) {
    throw new Error('PAYOUT_DETAILS_INCOMPLETE');
  }

  if (rail === 'BANK_OR_WALLET' && !cbuOrCvu && !alias && !bridgeExternalAccountId) {
    throw new Error('PAYOUT_DETAILS_INCOMPLETE');
  }

  if (rail === 'OTHER' && !notes) {
    throw new Error('PAYOUT_DETAILS_INCOMPLETE');
  }

  return {
    rail,
    accountHolderName,
    taxId: taxId || (bridgeExternalAccountId ? 'BRIDGE' : ''),
    cbuOrCvu: cbuOrCvu || null,
    alias: alias || null,
    providerName: raw.providerName?.trim() || (bridgeExternalAccountId ? 'bridge' : null),
    notes: notes || null,
    bridgeExternalAccountId: bridgeExternalAccountId || null,
    bridgeCurrency: bridgeCurrency || null
  };
}

export async function createPlatformWithdrawal(input: {
  userId: string;
  amountUsd: number;
  method: PlatformWithdrawalMethod;
  destinationAddress?: string | null;
  stablecoinNetwork?: string | null;
  payoutDetails?: unknown;
}) {
  const user = await getUserPurchaseContext(input.userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  assertOperationalInvestor(user);

  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    throw new Error('INVALID_WITHDRAWAL_AMOUNT');
  }

  let verifiedDestinationAddress: string | null = null;
  let fiatPayoutDetails: FiatPayoutDetails | null = null;

  if (input.method === 'STABLECOIN') {
    if (!input.destinationAddress?.trim()) {
      throw new Error('DESTINATION_ADDRESS_REQUIRED');
    }
    // Only allow withdrawing to an address this user has cryptographically verified ownership of before.
    verifiedDestinationAddress = await assertLinkedCryptoWalletOwnership(input.userId, input.destinationAddress);
  } else {
    fiatPayoutDetails = normalizeFiatPayoutDetails(input.payoutDetails);
  }

  const network = getStablecoinNetwork(input.stablecoinNetwork);
  const idempotencyKey = `${input.userId}:withdraw:${input.method}:${input.amountUsd}:${verifiedDestinationAddress ?? 'fiat'}:${Date.now()}`;

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
        destinationAddress: verifiedDestinationAddress,
        payoutDetails: fiatPayoutDetails ? (fiatPayoutDetails as Prisma.InputJsonObject) : undefined,
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

  // FIAT withdrawals stay in MANUAL_REVIEW until an admin confirms.
  // Bridge EA destinations can be paid via POST /v0/transfers when BRIDGE_PAYOUTS_ENABLED=true
  // (see confirmPlatformWithdrawal + bridgePayoutService). AR CBU/alias stays manual.
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
  /** On-chain tx hash for STABLECOIN, or the bank/transfer reference number for FIAT. */
  reference?: string;
  /** When true, create a Bridge wallet → external_account transfer and use its id as reference. */
  useBridgePayout?: boolean;
}) {
  const withdrawal = await prisma.platformWithdrawal.findUnique({ where: { id: input.withdrawalId } });
  if (!withdrawal) {
    throw new Error('WITHDRAWAL_NOT_FOUND');
  }
  if (!FULFILLABLE_STATUSES.includes(withdrawal.status)) {
    throw new Error('WITHDRAWAL_NOT_FULFILLABLE');
  }

  const payoutDetails = (withdrawal.payoutDetails as FiatPayoutDetails | null) ?? null;
  let reference = input.reference?.trim() ?? '';
  let bridgeTransfer: Awaited<ReturnType<typeof executeBridgeFiatPayout>> | null = null;

  const wantsBridge =
    Boolean(input.useBridgePayout) ||
    (withdrawal.method === 'FIAT' && !reference && withdrawalSupportsBridgePayout(payoutDetails));

  if (wantsBridge) {
    if (!payoutDetails?.bridgeExternalAccountId) {
      throw new Error('BRIDGE_EXTERNAL_ACCOUNT_MISSING');
    }
    bridgeTransfer = await executeBridgeFiatPayout({
      userId: withdrawal.userId,
      withdrawalId: withdrawal.id,
      amountUsd: Number(withdrawal.amountUsd),
      payoutDetails
    });
    if (!bridgeTransfer.ok) {
      throw new Error(
        bridgeTransfer.reason === 'BRIDGE_PAYOUT_FAILED' && bridgeTransfer.error
          ? `BRIDGE_PAYOUT_FAILED:${bridgeTransfer.error}`
          : bridgeTransfer.reason
      );
    }
    reference = bridgeTransfer.transfer.id;
  }

  if (!reference) {
    throw new Error('REFERENCE_REQUIRED');
  }

  let verification: { ok: boolean; reason?: string; confirmations?: number } = { ok: false, reason: 'SKIPPED' };
  if (withdrawal.method === 'STABLECOIN' && withdrawal.destinationAddress) {
    const network = getStablecoinNetwork(withdrawal.stablecoinNetwork);
    verification = await verifyUsdcTransferOnBase({
      txHash: reference,
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
      txHash: reference,
      confirmedAt: new Date(),
      metadata: {
        ...((withdrawal.metadata as Record<string, unknown>) ?? {}),
        confirmedBy: input.adminUserId,
        onChainVerification: verification,
        ...(bridgeTransfer?.ok
          ? {
              bridgeTransferId: bridgeTransfer.transfer.id,
              bridgeTransferState: bridgeTransfer.transfer.state ?? null,
              bridgePayout: true
            }
          : {})
      } as Prisma.InputJsonObject
    }
  });

  await recordAdminAuditLog({
    actorUserId: input.adminUserId,
    action: 'WITHDRAWAL_CONFIRMED',
    targetUserId: withdrawal.userId,
    metadata: {
      withdrawalId: withdrawal.id,
      reference,
      verification,
      bridgeTransferId: bridgeTransfer?.ok ? bridgeTransfer.transfer.id : null
    } as Prisma.InputJsonValue
  });

  const user = await prisma.user.findUnique({ where: { id: withdrawal.userId }, select: { email: true, name: true } });
  if (user?.email) {
    await sendWithdrawalConfirmedEmail({
      to: user.email,
      name: user.name,
      amountUsd: Number(withdrawal.amountUsd),
      method: withdrawal.method,
      reference
    });
  }
  await createNotification({
    userId: withdrawal.userId,
    type: 'withdrawal_confirmed',
    title: 'Retiro confirmado',
    body:
      withdrawal.method === 'FIAT'
        ? `Tu retiro de ${Number(withdrawal.amountUsd).toFixed(2)} USD en pesos fue transferido.`
        : `Tu retiro de ${Number(withdrawal.amountUsd).toFixed(2)} USDC fue enviado.`,
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
    body: `Tu retiro de ${Number(withdrawal.amountUsd).toFixed(2)} USD fue rechazado y el saldo fue restituido. Motivo: ${reason}`,
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
  payoutDetails?: unknown;
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
    payoutDetails: (withdrawal.payoutDetails as FiatPayoutDetails | null) ?? null,
    providerCheckoutUrl: withdrawal.providerCheckoutUrl,
    txHash: withdrawal.txHash,
    createdAt: withdrawal.createdAt.toISOString(),
    confirmedAt: withdrawal.confirmedAt?.toISOString() ?? null
  };
}
