import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { resolveInvestorLinkedWallet } from '../../../../../lib/investor/linkedWalletPolicy';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { verifyUsdcPayment } from '../../../../../lib/payments/paymentService';

export const dynamic = 'force-dynamic';

type VerifyBody = {
  paymentIntentId?: string;
  txHash?: string;
  walletAddress?: string;
};

function isWalletConnectPayment(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.paymentOptionId === 'walletconnect_usdc';
}

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

    const intent = await prisma.paymentIntent.findUnique({
      where: { id: body.paymentIntentId },
      select: { metadata: true, userId: true }
    });

    if (!intent || intent.userId !== ctx.userId) {
      return NextResponse.json({ error: 'PAYMENT_INTENT_NOT_FOUND' }, { status: 404 });
    }

    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    let expectedPayer: string | null = null;

    if (isWalletConnectPayment(metadata)) {
      if (!body.walletAddress?.trim()) {
        return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
      }
      expectedPayer = body.walletAddress.trim().toLowerCase();
    } else {
      expectedPayer = await resolveInvestorLinkedWallet(ctx.userId, body.walletAddress);
    }

    const paymentIntent = await verifyUsdcPayment({
      paymentIntentId: body.paymentIntentId,
      txHash: body.txHash,
      expectedPayer
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
        'INVALID_WALLET',
        'ALLOWLIST_NOT_APPROVED',
        'ONCHAIN_ALLOWLIST_NOT_APPROVED',
        'WALLET_REQUIRED_FOR_TOKENIZED_PURCHASE',
        'PAYMENT_TX_REQUIRED',
        'PAYMENT_CONFIRMATION_REQUIRED'
      ].includes(message)
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[payments/usdc/verify]', error);
    return NextResponse.json({ error: 'USDC_VERIFY_FAILED' }, { status: 500 });
  }
}
