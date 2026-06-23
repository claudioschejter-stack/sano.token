import { NextRequest, NextResponse } from 'next/server';
import { resolveCheckoutBestRoutes } from '../../../../lib/payments/checkoutBestRouteService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      amountUsd?: unknown;
      country?: unknown;
      referenceId?: unknown;
      investorName?: unknown;
    };

    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json({ error: 'amountUsd must be a positive number' }, { status: 400 });
    }

    // Prefer explicit country; fall back to Vercel geo header
    const country =
      (typeof body.country === 'string' && body.country.trim().length === 2
        ? body.country.trim().toUpperCase()
        : null) ??
      req.headers.get('x-vercel-ip-country') ??
      'US';

    const referenceId =
      typeof body.referenceId === 'string' && body.referenceId.trim()
        ? body.referenceId.trim()
        : `ref-${Date.now()}`;

    const investorName =
      typeof body.investorName === 'string' ? body.investorName.trim() : undefined;

    const routes = resolveCheckoutBestRoutes({ amountUsd, country, referenceId, investorName });

    return NextResponse.json(routes);
  } catch (err) {
    console.error('[checkout-methods] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
