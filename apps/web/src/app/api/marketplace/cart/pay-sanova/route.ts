import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireMarketplacePurchaseSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import type { CartLineInput } from '../../../../../lib/payments/cartCheckoutService';
import { paySanovaCartForUser } from '../../../../../lib/payments/paySanovaCartService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Body = {
  items?: CartLineInput[];
  clientBalanceUsdc?: number | null;
};

const CLIENT_ERRORS = new Set([
  'CART_EMPTY',
  'CART_MANUAL_REVIEW_REQUIRED',
  'INVESTOR_WALLET_REQUIRED',
  'WALLET_REQUIRED',
  'INSUFFICIENT_SUPPLY',
  'PROJECT_NOT_AVAILABLE',
  'INVALID_TOKEN_COUNT',
  'ACCOUNT_NOT_OPERATIONAL',
  'KYC_NOT_APPROVED',
  'ALLOWLIST_NOT_APPROVED',
  'ONCHAIN_ALLOWLIST_NOT_APPROVED',
  'WALLET_REQUIRED_FOR_TOKENIZED_PURCHASE',
  'PRIVY_WALLET_ID_NOT_FOUND',
  'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED'
]);

/**
 * One-tap crypto purchase from the Sanova (Privy) wallet:
 * create pending cart if needed → server-sign USDC payment → confirm tokens.
 */
export async function POST(request: Request) {
  const ctx = await requireMarketplacePurchaseSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const body = (await request.json()) as Body;
    const items = Array.isArray(body.items) ? body.items : [];
    const clientBalanceUsdc =
      typeof body.clientBalanceUsdc === 'number' && Number.isFinite(body.clientBalanceUsdc)
        ? body.clientBalanceUsdc
        : null;

    const result = await paySanovaCartForUser({
      userId: ctx.userId,
      userEmail: ctx.email,
      items,
      clientBalanceUsdc
    });

    if (result.ok === false) {
      const status =
        result.status === 'not_configured'
          ? 503
          : result.status === 'manual_review'
            ? 409
            : CLIENT_ERRORS.has(result.error)
              ? 400
              : 502;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PAY_SANOVA_FAILED';
    console.error('[marketplace/cart/pay-sanova]', error);
    return NextResponse.json({ ok: false, status: 'failed', error: message }, { status: 500 });
  }
}
