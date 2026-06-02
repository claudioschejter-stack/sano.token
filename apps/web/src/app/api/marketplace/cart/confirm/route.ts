import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { verifyCartUsdcPayment } from '../../../../../lib/payments/cartCheckoutService';

export const dynamic = 'force-dynamic';

type ConfirmBody = {
  batchId?: string;
  txHash?: string;
  walletAddress?: string;
};

const CONFIRM_ERRORS = [
  'CART_BATCH_NOT_FOUND',
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
  'PROJECT_NOT_AVAILABLE'
] as const;

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as ConfirmBody;
    if (!body.batchId?.trim() || !body.txHash?.trim()) {
      return NextResponse.json({ error: 'BATCH_AND_TX_REQUIRED' }, { status: 400 });
    }

    const paymentIntents = await verifyCartUsdcPayment({
      userId: ctx.userId,
      batchId: body.batchId.trim(),
      txHash: body.txHash.trim(),
      expectedPayer: body.walletAddress
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
