import { NextResponse } from 'next/server';
import type { PaymentMethod } from '@sanova/database';
import { requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import {
  createPaymentIntent,
  expirePaymentIntent,
  getPaymentIntentForUser
} from '../../../../../lib/payments/paymentService';

export const dynamic = 'force-dynamic';

type CreatePaymentIntentBody = {
  tokenCount?: number;
  walletAddress?: string;
  method?: PaymentMethod;
  stablecoinNetwork?: string;
};

const METHODS = new Set<PaymentMethod>([
  'INTERNAL_BALANCE',
  'USDC_ONCHAIN',
  'STRIPE',
  'MERCADO_PAGO',
  'COINBASE',
  'CUSTODIAL_STABLECOIN'
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { projectId } = await context.params;

  try {
    const body = (await request.json()) as CreatePaymentIntentBody;
    const method = body.method && METHODS.has(body.method) ? body.method : 'USDC_ONCHAIN';

    const paymentIntent = await createPaymentIntent({
      userId: ctx.userId,
      projectId,
      tokenCount: Number(body.tokenCount),
      walletAddress: body.walletAddress,
      method,
      stablecoinNetwork: body.stablecoinNetwork
    });

    return NextResponse.json({ ok: true, paymentIntent });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (
      [
        'ACCOUNT_NOT_OPERATIONAL',
        'KYC_NOT_APPROVED',
        'INVALID_TOKEN_COUNT',
        'INSUFFICIENT_SUPPLY',
        'PROJECT_NOT_AVAILABLE',
        'WALLET_REQUIRED',
        'PAYMENT_METHOD_NOT_CONFIGURED',
        'PAYMENT_CIRCUIT_BREAKER_OPEN',
        'PAYMENT_USER_DAILY_LIMIT',
        'PAYMENT_PROJECT_DAILY_LIMIT',
        'PAYMENT_WALLET_DAILY_LIMIT',
        'INVESTOR_WALLET_REQUIRED',
        'INSUFFICIENT_PLATFORM_BALANCE',
        'WALLET_MISMATCH',
        'CHAIN_MISMATCH',
        'INVALID_WALLET'
      ].includes(message)
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[payment-intents/create]', error);
    return NextResponse.json({ error: 'PAYMENT_INTENT_FAILED' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const paymentIntentId = new URL(request.url).searchParams.get('id');
  if (!paymentIntentId) {
    return NextResponse.json({ error: 'PAYMENT_INTENT_ID_REQUIRED' }, { status: 400 });
  }

  const expired = await expirePaymentIntent(paymentIntentId);
  const paymentIntent = expired ?? (await getPaymentIntentForUser(ctx.userId, paymentIntentId));

  if (!paymentIntent) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, paymentIntent });
}
