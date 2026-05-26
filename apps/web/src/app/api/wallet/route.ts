import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../lib/onboarding/requireInvestorSession';
import { getPlatformWalletSummary } from '../../../lib/payments/platformWalletService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const wallet = await getPlatformWalletSummary(ctx.userId);
  return NextResponse.json({ ok: true, wallet });
}
