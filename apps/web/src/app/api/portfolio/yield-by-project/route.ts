import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { getProjectYieldForUser } from '../../../../lib/investor/projectYieldService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const summary = await getProjectYieldForUser(ctx.userId);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error('[portfolio/yield-by-project GET]', error);
    return NextResponse.json({ error: 'Failed to load project yield' }, { status: 500 });
  }
}
