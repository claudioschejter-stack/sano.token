import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { previewMorphoRepayForUser } from '../../../../lib/lending/repayRouter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const preview = await previewMorphoRepayForUser(ctx.userId);
    return NextResponse.json({ preview });
  } catch (error) {
    console.error('[lending/repay-preview GET]', error);
    return NextResponse.json({ error: 'Failed to load Morpho repay preview' }, { status: 500 });
  }
}
