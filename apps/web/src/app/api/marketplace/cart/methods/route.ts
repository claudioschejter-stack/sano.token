import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireMarketplacePurchaseSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { listCheckoutMethods } from '../../../../../lib/payments/checkoutMethods';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireMarketplacePurchaseSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const modeParam = new URL(request.url).searchParams.get('mode');
  const mode = modeParam === 'deposit' ? 'deposit' : 'purchase';

  return NextResponse.json({
    ok: true,
    mode,
    methods: listCheckoutMethods(mode).filter((method) => method.configured && method.automatic)
  });
}
