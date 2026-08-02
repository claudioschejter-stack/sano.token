import { prepareUsdcTreasuryPayment } from '../web3/usdcTreasuryTransfer';
import {
  isErc4626DirectDepositBatch,
  prepareVaultDepositPayment,
  type VaultDepositLine
} from '../web3/vaultDepositPayment';
import { isPrivyAuthorizationSigningConfigured } from '../privy/privyAuthorizationSignature';
import { resolveInvestorPrivyWalletIdForUser } from '../privy/resolveInvestorPrivyWalletId';
import { privySendTransaction } from '../privy/walletRpcApi';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { readWalletUsdcBalanceDetailed } from '../portfolio/onChainUsdcReader';
import { prisma } from '@sanova/database';
import {
  createCartPurchaseCheckout,
  verifyCartUsdcPayment,
  type CartLineInput
} from './cartCheckoutService';
import { normalizeCartLineItems } from './normalizeCartLineItems';
import { isPrismaTransactionTimeoutError } from './prismaTransactionErrors';
import { findPendingUsdcCartPurchase } from './privyInboundUsdcService';

export type PaySanovaCartResult =
  | { ok: true; status: 'settled'; batchId: string; txHash: string; amountUsd: number }
  | { ok: true; status: 'waiting_funds'; address: string | null; balanceUsdc: number; amountUsd: number }
  | {
      ok: false;
      status: 'not_configured' | 'failed' | 'manual_review';
      error: string;
      balanceUsdc?: number | null;
      batchId?: string;
      amountUsd?: number;
    };

/** Normalize Privy RPC failures into stable client-facing error codes. */
export function classifyPrivySendError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('no valid authorization keys') ||
    lower.includes('user signing keys available') ||
    (lower.includes('privy_send_transaction_failed:401') && lower.includes('authorization'))
  ) {
    return 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED';
  }
  return message;
}

export type PaySanovaCartInput = {
  userId: string;
  userEmail?: string | null;
  items: CartLineInput[];
  clientBalanceUsdc?: number | null;
};

export function isPrivyServerAutoSettleConfigured(): boolean {
  return Boolean(process.env.PRIVY_APP_SECRET?.trim()) && isPrivyAuthorizationSigningConfigured();
}

function toAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function loadBatchIntents(userId: string, batchId: string) {
  const intents = await prisma.paymentIntent.findMany({
    where: {
      userId,
      status: { in: ['REQUIRES_PAYMENT', 'PENDING'] },
      metadata: { path: ['cartBatchId'], equals: batchId }
    },
    select: {
      id: true,
      amountUsd: true,
      metadata: true
    }
  });
  return intents;
}

async function sendPreparedAndVerify(input: {
  userId: string;
  batchId: string;
  amountUsd: number;
  walletId: string;
  walletAddress: string;
  chainId: number;
  transactions: Array<{ to: string; data: string; value: string }>;
}): Promise<PaySanovaCartResult> {
  let lastHash: string | null = null;
  try {
    for (const [index, tx] of input.transactions.entries()) {
      lastHash = await privySendTransaction({
        walletId: input.walletId,
        chainId: input.chainId,
        to: tx.to,
        data: tx.data,
        value: BigInt(tx.value || '0'),
        sponsor: true,
        requireAuthorizationSignature: true,
        idempotencyKey: `privy-auto-settle:${input.userId}:${input.batchId}:${index}`
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PRIVY_SEND_TRANSACTION_FAILED';
    return {
      ok: false,
      status: 'failed',
      error: classifyPrivySendError(message),
      batchId: input.batchId,
      amountUsd: input.amountUsd
    };
  }

  if (!lastHash) {
    return { ok: false, status: 'failed', error: 'PRIVY_SEND_TRANSACTION_MISSING_HASH' };
  }

  let verified = false;
  let lastVerifyError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 2500 : 3000));
    try {
      await verifyCartUsdcPayment({
        userId: input.userId,
        batchId: input.batchId,
        txHash: lastHash,
        expectedPayer: input.walletAddress
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
    batchId: input.batchId,
    txHash: lastHash,
    amountUsd: input.amountUsd
  };
}

/**
 * One-tap Sanova pay: ensure a pending USDC cart exists, then settle from the
 * linked Privy wallet (treasury transfer or ERC-4626 vault deposit).
 */
export async function paySanovaCartForUser(input: PaySanovaCartInput): Promise<PaySanovaCartResult> {
  if (!isPrivyServerAutoSettleConfigured()) {
    return {
      ok: false,
      status: 'not_configured',
      error: 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED'
    };
  }

  const items = normalizeCartLineItems(input.items);
  const address = await getLinkedWalletForUser(input.userId);
  let balanceUsdc: number | null = null;
  let balanceKnown = false;

  if (address) {
    const balanceRead = await readWalletUsdcBalanceDetailed(address, ['BASE']);
    if (balanceRead.ok) {
      balanceUsdc = balanceRead.amountUsdc;
      balanceKnown = true;
    } else if (
      typeof input.clientBalanceUsdc === 'number' &&
      Number.isFinite(input.clientBalanceUsdc) &&
      input.clientBalanceUsdc >= 0
    ) {
      balanceUsdc = input.clientBalanceUsdc;
      balanceKnown = true;
    }
  } else {
    balanceUsdc = 0;
    balanceKnown = true;
  }

  let pending = await findPendingUsdcCartPurchase(input.userId);

  if (!pending) {
    if (!items.length) {
      // Hard failure — soft `ok:true/no_pending_purchase` previously hid the bug
      // as a vague "auto pay" error in the checkout UI.
      return {
        ok: false,
        status: 'failed',
        error: 'NO_PENDING_PURCHASE',
        balanceUsdc
      };
    }

    const createCheckout = () =>
      createCartPurchaseCheckout({
        userId: input.userId,
        userEmail: input.userEmail,
        items,
        method: 'USDC_ONCHAIN',
        stablecoinNetwork: 'BASE',
        // Prefer the already-resolved linked Sanova wallet (avoid WALLET_REQUIRED).
        walletAddress: address,
        // Fast path: intents only — ERC-4626 vault deposit / treasury settle follows.
        skipGateway: true
      });

    try {
      const checkout = await createCheckout();

      if (checkout.manualReview) {
        return {
          ok: false,
          status: 'manual_review',
          error: 'CART_MANUAL_REVIEW_REQUIRED',
          balanceUsdc
        };
      }

      pending = {
        batchId: checkout.batchId,
        amountUsd: Number(checkout.totalUsd),
        intentIds: checkout.paymentIntents.map((row) => row.id)
      };
    } catch (error) {
      // One retry on DB interactive-tx timeouts (cold DB / contention).
      if (isPrismaTransactionTimeoutError(error)) {
        try {
          const checkout = await createCheckout();
          if (checkout.manualReview) {
            return {
              ok: false,
              status: 'manual_review',
              error: 'CART_MANUAL_REVIEW_REQUIRED',
              balanceUsdc
            };
          }
          pending = {
            batchId: checkout.batchId,
            amountUsd: Number(checkout.totalUsd),
            intentIds: checkout.paymentIntents.map((row) => row.id)
          };
        } catch (retryError) {
          const message = isPrismaTransactionTimeoutError(retryError)
            ? 'CART_CHECKOUT_TIMEOUT'
            : retryError instanceof Error
              ? retryError.message
              : 'CART_CHECKOUT_FAILED';
          return { ok: false, status: 'failed', error: message, balanceUsdc };
        }
      } else {
        const message = error instanceof Error ? error.message : 'CART_CHECKOUT_FAILED';
        return { ok: false, status: 'failed', error: message, balanceUsdc };
      }
    }
  }

  if (balanceKnown && balanceUsdc != null && balanceUsdc + 1e-9 < pending.amountUsd) {
    return {
      ok: true,
      status: 'waiting_funds',
      address,
      balanceUsdc,
      amountUsd: pending.amountUsd
    };
  }

  const walletRef = await resolveInvestorPrivyWalletIdForUser(input.userId);
  if (!walletRef) {
    return { ok: false, status: 'failed', error: 'PRIVY_WALLET_ID_NOT_FOUND', balanceUsdc };
  }

  const intents = await loadBatchIntents(input.userId, pending.batchId);
  if (!intents.length) {
    return { ok: false, status: 'failed', error: 'CART_BATCH_NOT_FOUND', balanceUsdc };
  }

  if (isErc4626DirectDepositBatch(intents)) {
    const deposits: VaultDepositLine[] = intents.map((row) => {
      const metadata = (row.metadata as Record<string, unknown>) ?? {};
      return {
        vaultAddress: String(metadata.vaultAddress ?? ''),
        amountUsd: toAmount(row.amountUsd)
      };
    });

    const prepared = prepareVaultDepositPayment({
      stablecoinNetwork: 'BASE',
      payerAddress: walletRef.address,
      deposits
    });

    return sendPreparedAndVerify({
      userId: input.userId,
      batchId: pending.batchId,
      amountUsd: pending.amountUsd,
      walletId: walletRef.walletId,
      walletAddress: walletRef.address,
      chainId: prepared.chainId,
      transactions: prepared.transactions
    });
  }

  const prepared = await prepareUsdcTreasuryPayment({
    amountUsd: pending.amountUsd,
    stablecoinNetwork: 'BASE',
    payerAddress: walletRef.address
  });

  return sendPreparedAndVerify({
    userId: input.userId,
    batchId: pending.batchId,
    amountUsd: pending.amountUsd,
    walletId: walletRef.walletId,
    walletAddress: walletRef.address,
    chainId: prepared.chainId,
    transactions: prepared.transactions
  });
}
