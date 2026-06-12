import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import { getCartBatchStatus } from '../../../../../lib/payments/cartCheckoutService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const batchId = new URL(request.url).searchParams.get('batchId')?.trim();
  if (!batchId) {
    return NextResponse.json({ error: 'BATCH_ID_REQUIRED' }, { status: 400 });
  }

  const status = await getCartBatchStatus(ctx.userId, batchId, {
    sync: new URL(request.url).searchParams.get('sync') === '1'
  });
  return NextResponse.json({ status });
}
