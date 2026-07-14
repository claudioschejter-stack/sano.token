import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import {
  getLoansEnabledForUser,
  updateLoansEnabledForUser
} from '../../../../lib/investor/loansPreferenceService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const loansEnabled = await getLoansEnabledForUser(ctx.userId);
  if (loansEnabled === null) {
    return NextResponse.json({ error: 'INVESTOR_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ loansEnabled });
}

export async function PATCH(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const body = (await request.json().catch(() => ({}))) as { loansEnabled?: unknown };
  if (typeof body.loansEnabled !== 'boolean') {
    return NextResponse.json({ error: 'INVALID_PREFERENCE' }, { status: 400 });
  }

  try {
    const loansEnabled = await updateLoansEnabledForUser(ctx.userId, body.loansEnabled);
    return NextResponse.json({ loansEnabled });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UPDATE_FAILED';
    const status = message === 'INVESTOR_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
