import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { chooseCheapestPaymentRoute, quoteCheapestPaymentRoutes, type PaymentRouteDirection } from '../../../../lib/payments/cheapestPaymentRouter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = (await request.json()) as {
    amountUsd?: number;
    country?: string;
    currency?: string;
    direction?: PaymentRouteDirection;
    userHasStablecoin?: boolean;
    preferredNetwork?: string;
  };

  const input = {
    amountUsd: Number(body.amountUsd),
    country: body.country,
    currency: body.currency,
    direction: body.direction,
    userHasStablecoin: body.userHasStablecoin,
    preferredNetwork: body.preferredNetwork
  };

  return NextResponse.json({
    ok: true,
    selectedRoute: chooseCheapestPaymentRoute(input),
    quotes: quoteCheapestPaymentRoutes(input).slice(0, 8)
  });
}
