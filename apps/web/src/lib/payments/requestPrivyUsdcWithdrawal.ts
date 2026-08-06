import { prisma, Prisma } from '@sanova/database';
import { getUserPurchaseContext } from '../investor/investorService';
import { notifyAutomationIssue } from '../admin/automationAlerts';
import { createNotification } from '../notifications/notificationService';
import { quotePrivyUsdcWithdrawal } from './withdrawPrivyUsdc';

/**
 * Queue a withdrawal of the investor's own USDC for an admin to authorise.
 *
 * The amount is quoted net of the transfer fee at request time, so the investor
 * sees what they will actually receive rather than a gross figure that shrinks
 * later. Nothing moves on-chain here and no ledger balance is debited: this USDC
 * is in the investor's wallet, not in the platform's books, and debiting the
 * ledger would take money that was never there.
 */

export type RequestWithdrawalResult =
  | {
      ok: true;
      withdrawalId: string;
      amountUsdc: string;
      gasReserveUsdc: string;
      destination: string;
      status: 'PENDING';
    }
  | { ok: false; code: string; detail?: string };

export async function requestPrivyUsdcWithdrawal(input: {
  userId: string;
  amountUsdc?: number;
  destinationAddress?: string;
}): Promise<RequestWithdrawalResult> {
  const user = await getUserPurchaseContext(input.userId);
  if (!user) {
    return { ok: false, code: 'USER_NOT_FOUND' };
  }
  if (user.kycStatus !== 'APPROVED') {
    return { ok: false, code: 'KYC_NOT_APPROVED' };
  }

  /**
   * One open request at a time. Otherwise an investor clicking twice queues two
   * authorisations for the same balance, and the second one fails after the
   * admin already approved it.
   */
  const open = await prisma.platformWithdrawal.findFirst({
    where: {
      userId: input.userId,
      method: 'SANOVA_WALLET_USDC',
      status: { in: ['PENDING', 'PROCESSING', 'MANUAL_REVIEW'] }
    },
    select: { id: true, amountUsd: true }
  });
  if (open) {
    return {
      ok: false,
      code: 'WITHDRAWAL_ALREADY_PENDING',
      detail: `Ya tenés un retiro de ${Number(open.amountUsd).toFixed(2)} USDC esperando autorización.`
    };
  }

  const quote = await quotePrivyUsdcWithdrawal(input);
  if (quote.ok === false) {
    return quote;
  }

  const created = await prisma.platformWithdrawal.create({
    data: {
      userId: input.userId,
      investorId: user.investorId,
      amountUsd: new Prisma.Decimal(quote.amountUsdc),
      method: 'SANOVA_WALLET_USDC',
      status: 'PENDING',
      stablecoinNetwork: 'BASE',
      destinationAddress: quote.destination,
      idempotencyKey: `sanova-wallet-usdc:${input.userId}:${Date.now()}`,
      metadata: {
        requestedAt: new Date().toISOString(),
        /** Kept so the authorisation can be checked against what was promised. */
        sanovaWalletAddress: quote.from,
        privyWalletId: quote.walletId,
        gasReserveUsdc: quote.gasReserveUsdc,
        heldUsdcAtRequest: quote.heldUsdc
      } as Prisma.InputJsonObject
    }
  });

  await notifyAutomationIssue({
    projectId: 'retiros',
    title: `Retiro por autorizar: ${quote.amountUsdc.toFixed(2)} USDC`,
    message: `${user.email ?? input.userId} pidió retirar ${quote.amountUsdc.toFixed(
      2
    )} USDC de su wallet Sanova hacia ${quote.destination}. Autorizalo en /dashboard/withdrawals.`,
    severity: 'warning'
  }).catch((error) => {
    // The request stands on its own; the alert is a convenience.
    console.error('[requestPrivyUsdcWithdrawal] admin alert failed', error);
  });

  await createNotification({
    userId: input.userId,
    type: 'withdrawal_requested',
    title: 'Retiro solicitado',
    body: `Pedimos autorización para enviarte ${quote.amountUsdc.toFixed(2)} USDC. Te avisamos cuando salga.`,
    link: '/dashboard/portfolio?tab=wallet'
  }).catch(() => undefined);

  return {
    ok: true,
    withdrawalId: created.id,
    amountUsdc: quote.amountUsdc.toFixed(6),
    gasReserveUsdc: quote.gasReserveUsdc.toFixed(6),
    destination: quote.destination,
    status: 'PENDING'
  };
}
