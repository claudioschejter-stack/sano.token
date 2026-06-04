import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { buildDepositPaymentOptions } from '../../../../../lib/payments/depositPaymentOptions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const amountUsd = Number(params.get('amountUsd'));
  const country = params.get('country') ?? 'AR';

  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    options: buildDepositPaymentOptions(amountUsd, country)
  });
}
