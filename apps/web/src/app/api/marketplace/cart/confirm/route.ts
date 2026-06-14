import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { resolveInvestorLinkedWallet } from '../../../../../lib/investor/linkedWalletPolicy';
import { investorSessionForbiddenResponse, requireMarketplacePurchaseSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { verifyCartUsdcPayment } from '../../../../../lib/payments/cartCheckoutService';

export const dynamic = 'force-dynamic';

type ConfirmBody = {
  batchId?: string;
  txHash?: string;
  walletAddress?: string;
};

function isWalletConnectCart(metadata: Record<string, unknown>): boolean {
  return metadata.paymentOptionId === 'walletconnect_usdc';
}

const CONFIRM_ERRORS = [
  'CART_BATCH_NOT_FOUND',
  'CART_MANUAL_REVIEW_REQUIRED',
  'CART_VAULT_DEPOSIT_REQUIRED',
  'CART_MIXED_PAYMENT_MODE',
  'CART_BATCH_MISMATCH',
  'INVALID_PAYMENT_METHOD',
  'USDC_PAYMENT_NOT_CONFIGURED',
  'TX_NOT_CONFIRMED',
  'CHAIN_MISMATCH',
  'TX_CONFIRMATIONS_PENDING',
  'USDC_TRANSFER_NOT_FOUND',
  'PAYMENT_TX_REQUIRED',
  'PAYMENT_CONFIRMATION_REQUIRED',
  'ALLOWLIST_NOT_APPROVED',
  'ONCHAIN_ALLOWLIST_NOT_APPROVED',
  'WALLET_REQUIRED_FOR_TOKENIZED_PURCHASE',
  'INSUFFICIENT_SUPPLY',
  'PROJECT_NOT_AVAILABLE',
  'WALLET_REQUIRED',
  'WALLET_MISMATCH',
  'INVESTOR_WALLET_REQUIRED',
  'INVALID_WALLET'
] as const;

export async function POST(request: Request) {
  const ctx = await requireMarketplacePurchaseSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const body = (await request.json()) as ConfirmBody;
    if (!body.batchId?.trim() || !body.txHash?.trim()) {
      return NextResponse.json({ error: 'BATCH_AND_TX_REQUIRED' }, { status: 400 });
    }

    const sample = await prisma.paymentIntent.findFirst({
      where: { userId: ctx.userId, metadata: { path: ['cartBatchId'], equals: body.batchId.trim() } },
      select: { metadata: true }
    });

    const sampleMetadata = (sample?.metadata as Record<string, unknown>) ?? {};
    let expectedPayer: string | null = null;

    if (isWalletConnectCart(sampleMetadata)) {
      if (!body.walletAddress?.trim()) {
        return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
      }
      expectedPayer = body.walletAddress.trim().toLowerCase();
    } else {
      expectedPayer = await resolveInvestorLinkedWallet(ctx.userId, body.walletAddress);
    }

    const paymentIntents = await verifyCartUsdcPayment({
      userId: ctx.userId,
      batchId: body.batchId.trim(),
      txHash: body.txHash.trim(),
      expectedPayer
    });

    return NextResponse.json({ ok: true, paymentIntents });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (CONFIRM_ERRORS.includes(message as (typeof CONFIRM_ERRORS)[number])) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[marketplace/cart/confirm]', error);
    return NextResponse.json({ error: 'CART_CONFIRM_FAILED' }, { status: 500 });
  }
}
