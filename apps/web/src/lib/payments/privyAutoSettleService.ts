import { prisma } from '@sanova/database';
import { prepareUsdcTreasuryPayment } from '../web3/usdcTreasuryTransfer';
import { isPrivyAuthorizationSigningConfigured } from '../privy/privyAuthorizationSignature';
import { resolveInvestorPrivyWalletIdForUser } from '../privy/resolveInvestorPrivyWalletId';
import { privySendTransaction } from '../privy/walletRpcApi';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { readWalletUsdcBalanceDetailed } from '../portfolio/onChainUsdcReader';
import { findPendingUsdcCartPurchase } from './privyInboundUsdcService';
import { verifyCartUsdcPayment } from './cartCheckoutService';

export type PrivyAutoSettleResult =
  | { ok: true; status: 'settled'; batchId: string; txHash: string; amountUsd: number }
  | { ok: true; status: 'waiting_funds'; address: string | null; balanceUsdc: number; amountUsd: number | null }
  | { ok: true; status: 'no_pending_purchase'; address: string | null; balanceUsdc: number }
  | { ok: false; status: 'not_configured' | 'failed'; error: string };

export function isPrivyServerAutoSettleConfigured(): boolean {
  return Boolean(process.env.PRIVY_APP_SECRET?.trim()) && isPrivyAuthorizationSigningConfigured();
}

/**
 * Fully server-side settle: investor Privy USDC → treasury → confirm cart → mint shares.
 * Never touches the Privy browser SDK (no second login).
 */
export async function autoSettlePrivyCartForUser(userId: string): Promise<PrivyAutoSettleResult> {
  if (!isPrivyServerAutoSettleConfigured()) {
    return {
      ok: false,
      status: 'not_configured',
      error: 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED'
    };
  }

  const address = await getLinkedWalletForUser(userId);
  const balanceRead = address
    ? await readWalletUsdcBalanceDetailed(address, ['BASE'])
    : ({ ok: true, amountUsdc: 0, balances: [] } as const);
  if (!balanceRead.ok) {
    return { ok: false, status: 'failed', error: 'USDC_BALANCE_READ_FAILED' };
  }
  const balanceUsdc = balanceRead.amountUsdc;

  const pending = await findPendingUsdcCartPurchase(userId);
  if (!pending) {
    return { ok: true, status: 'no_pending_purchase', address, balanceUsdc };
  }

  if (balanceUsdc + 1e-9 < pending.amountUsd) {
    return {
      ok: true,
      status: 'waiting_funds',
      address,
      balanceUsdc,
      amountUsd: pending.amountUsd
    };
  }

  const walletRef = await resolveInvestorPrivyWalletIdForUser(userId);
  if (!walletRef) {
    return { ok: false, status: 'failed', error: 'PRIVY_WALLET_ID_NOT_FOUND' };
  }

  const prepared = await prepareUsdcTreasuryPayment({
    amountUsd: pending.amountUsd,
    stablecoinNetwork: 'BASE',
    payerAddress: walletRef.address
  });

  let lastHash: string | null = null;
  for (const [index, tx] of prepared.transactions.entries()) {
    lastHash = await privySendTransaction({
      walletId: walletRef.walletId,
      chainId: prepared.chainId,
      to: tx.to,
      data: tx.data,
      value: BigInt(tx.value || '0'),
      sponsor: true,
      requireAuthorizationSignature: true,
      idempotencyKey: `privy-auto-settle:${userId}:${pending.batchId}:${index}`
    });
  }

  if (!lastHash) {
    return { ok: false, status: 'failed', error: 'PRIVY_SEND_TRANSACTION_MISSING_HASH' };
  }

  // Base confirmations (default PAYMENT_MIN_CONFIRMATIONS=2) — brief wait + retry.
  let verified = false;
  let lastVerifyError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 2500 : 3000));
    try {
      await verifyCartUsdcPayment({
        userId,
        batchId: pending.batchId,
        txHash: lastHash,
        expectedPayer: walletRef.address
      });
      verified = true;
      break;
    } catch (error) {
      lastVerifyError = error;
      const message = error instanceof Error ? error.message : '';
      if (message !== 'TX_CONFIRMATIONS_PENDING' && message !== 'TX_NOT_CONFIRMED') {
        break;
      }
    }
  }

  if (!verified) {
    const message = lastVerifyError instanceof Error ? lastVerifyError.message : 'VERIFY_FAILED';
    return { ok: false, status: 'failed', error: message };
  }

  return {
    ok: true,
    status: 'settled',
    batchId: pending.batchId,
    txHash: lastHash,
    amountUsd: pending.amountUsd
  };
}

/** Cron helper: settle every user with a ready Privy inbound cart. */
export async function autoSettleAllReadyPrivyCarts() {
  if (!isPrivyServerAutoSettleConfigured()) {
    return { attempted: 0, settled: 0, failed: 0, skipped: true as const };
  }

  const openIntents = await prisma.paymentIntent.findMany({
    where: {
      status: { in: ['REQUIRES_PAYMENT', 'PENDING'] },
      method: 'USDC_ONCHAIN',
      expiresAt: { gt: new Date() }
    },
    select: { userId: true },
    distinct: ['userId'],
    take: 50
  });

  let settled = 0;
  let failed = 0;

  for (const row of openIntents) {
    try {
      const result = await autoSettlePrivyCartForUser(row.userId);
      if (result.ok && result.status === 'settled') {
        settled += 1;
      } else if (result.ok === false) {
        failed += 1;
        console.error('[autoSettleAllReadyPrivyCarts]', row.userId, result.error);
      }
    } catch (error) {
      failed += 1;
      console.error('[autoSettleAllReadyPrivyCarts]', row.userId, error);
    }
  }

  return { attempted: openIntents.length, settled, failed, skipped: false as const };
}
