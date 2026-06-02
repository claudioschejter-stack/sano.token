import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { parsePaymentMethod } from '../../../../../lib/payments/checkoutMethods';
import { createCartPurchaseCheckout, type CartLineInput } from '../../../../../lib/payments/cartCheckoutService';

export const dynamic = 'force-dynamic';

type CartCheckoutBody = {
  items?: CartLineInput[];
  method?: string;
  walletAddress?: string;
  stablecoinNetwork?: string;
};

const CHECKOUT_ERRORS = [
  'USER_NOT_FOUND',
  'ACCOUNT_NOT_OPERATIONAL',
  'KYC_NOT_APPROVED',
  'CART_EMPTY',
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
  'INVALID_WALLET',
  'INVESTOR_ACCESS_NOT_ENABLED',
  'ALLOWLIST_NOT_APPROVED',
  'ONCHAIN_ALLOWLIST_NOT_APPROVED',
  'WALLET_REQUIRED_FOR_TOKENIZED_PURCHASE',
  'PAYMENT_TX_REQUIRED',
  'PAYMENT_CONFIRMATION_REQUIRED',
  'CART_BATCH_NOT_FOUND'
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
    const body = (await request.json()) as CartCheckoutBody;
    const method = parsePaymentMethod(body.method) ?? 'USDC_ONCHAIN';
    const items = Array.isArray(body.items) ? body.items : [];

    const checkout = await createCartPurchaseCheckout({
      userId: ctx.userId,
      userEmail: ctx.email,
      items,
      method,
      walletAddress: body.walletAddress,
      stablecoinNetwork: body.stablecoinNetwork
    });

    return NextResponse.json({ ok: true, checkout });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (CHECKOUT_ERRORS.includes(message as (typeof CHECKOUT_ERRORS)[number])) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[marketplace/cart/checkout]', error);
    return NextResponse.json({ error: 'CART_CHECKOUT_FAILED' }, { status: 500 });
  }
}
