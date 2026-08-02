import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireMarketplacePurchaseSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import { normalizeCartLineItems } from '../../../../../lib/payments/normalizeCartLineItems';
import { paySanovaCartForUser } from '../../../../../lib/payments/paySanovaCartService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Always JSON — never let framework HTML error pages leak to the checkout UI. */
function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, status: 'failed', error, ...extra }, { status });
}

type Body = {
  items?: unknown;
  clientBalanceUsdc?: number | null;
};

const CLIENT_ERRORS = new Set([
  'CART_EMPTY',
  'NO_PENDING_PURCHASE',
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
  try {
    const ctx = await requireMarketplacePurchaseSession();
    if (!ctx) {
      return jsonError('UNAUTHORIZED', 401);
    }
    if ('forbidden' in ctx) {
      return investorSessionForbiddenResponse(ctx);
    }

    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      return jsonError('INVALID_JSON_BODY', 400);
    }

    const items = normalizeCartLineItems(body.items);
    const clientBalanceUsdc =
      typeof body.clientBalanceUsdc === 'number' && Number.isFinite(body.clientBalanceUsdc)
        ? body.clientBalanceUsdc
        : null;

    if (!items.length) {
      console.warn('[marketplace/cart/pay-sanova] empty items', {
        userId: ctx.userId,
        rawType: Array.isArray(body.items) ? 'array' : typeof body.items,
        clientHeaderLines: request.headers.get('x-sanova-cart-lines')
      });
    }

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
    return jsonError(message, 500);
  }
}
