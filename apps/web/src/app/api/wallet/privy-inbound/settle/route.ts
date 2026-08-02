import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import { normalizeCartLineItems } from '../../../../../lib/payments/normalizeCartLineItems';
import { autoSettlePrivyCartForUser } from '../../../../../lib/payments/privyAutoSettleService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Server-side settle for crypto checkout.
 * Moves USDC Privy → treasury/vault and confirms the cart without any Privy browser login.
 * Accepts optional `items` so the pending cart can be created when missing.
 */
export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ ok: false, status: 'failed', error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    let clientBalanceUsdc: number | null = null;
    let items = normalizeCartLineItems([]);
    try {
      const body = (await request.json()) as {
        clientBalanceUsdc?: unknown;
        items?: unknown;
      };
      if (typeof body.clientBalanceUsdc === 'number' && Number.isFinite(body.clientBalanceUsdc)) {
        clientBalanceUsdc = body.clientBalanceUsdc;
      }
      items = normalizeCartLineItems(body.items);
    } catch {
      /* empty body is fine for cron/watch paths that already created a pending cart */
    }

    const result = await autoSettlePrivyCartForUser(ctx.userId, {
      clientBalanceUsdc,
      items,
      userEmail: ctx.email
    });
    if (!result.ok) {
      const status = result.status === 'not_configured' ? 503 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PRIVY_AUTO_SETTLE_FAILED';
    console.error('[wallet/privy-inbound/settle]', error);
    return NextResponse.json({ ok: false, status: 'failed', error: message }, { status: 500 });
  }
}
