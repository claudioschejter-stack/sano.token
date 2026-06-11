import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { getCartBatchStatus } from '../../../../../lib/payments/cartCheckoutService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const batchId = new URL(request.url).searchParams.get('batchId')?.trim();
  if (!batchId) {
    return NextResponse.json({ error: 'BATCH_ID_REQUIRED' }, { status: 400 });
  }

  const status = await getCartBatchStatus(ctx.userId, batchId);
  return NextResponse.json({ status });
}
