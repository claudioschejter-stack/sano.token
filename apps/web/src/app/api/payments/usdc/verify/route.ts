import { NextResponse } from 'next/server';
import { resolveInvestorLinkedWallet } from '../../../../../lib/investor/linkedWalletPolicy';
import { requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { verifyUsdcPayment } from '../../../../../lib/payments/paymentService';

export const dynamic = 'force-dynamic';

type VerifyBody = {
  paymentIntentId?: string;
  txHash?: string;
  walletAddress?: string;
};

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as VerifyBody;

    if (!body.paymentIntentId || !body.txHash) {
      return NextResponse.json({ error: 'PAYMENT_INTENT_AND_TX_REQUIRED' }, { status: 400 });
    }

    const linkedWallet = await resolveInvestorLinkedWallet(ctx.userId, body.walletAddress);

    const paymentIntent = await verifyUsdcPayment({
      paymentIntentId: body.paymentIntentId,
      txHash: body.txHash,
      expectedPayer: linkedWallet
    });

    return NextResponse.json({ ok: true, paymentIntent });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (
      [
        'PAYMENT_INTENT_NOT_FOUND',
        'INVALID_PAYMENT_METHOD',
        'USDC_PAYMENT_NOT_CONFIGURED',
        'TX_NOT_CONFIRMED',
        'CHAIN_MISMATCH',
        'USDC_TRANSFER_NOT_FOUND',
        'STABLECOIN_TRANSFER_NOT_FOUND',
        'TX_CONFIRMATIONS_PENDING',
        'PAYMENT_INTENT_NOT_PAYABLE',
        'PROJECT_NOT_AVAILABLE',
        'INSUFFICIENT_SUPPLY',
        'INVESTOR_WALLET_REQUIRED',
        'WALLET_MISMATCH',
        'WALLET_REQUIRED',
        'INVALID_WALLET'
      ].includes(message)
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[payments/usdc/verify]', error);
    return NextResponse.json({ error: 'USDC_VERIFY_FAILED' }, { status: 500 });
  }
}
