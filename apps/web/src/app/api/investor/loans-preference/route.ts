import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import {
  getLoansEnabledForUser,
  updateLoansEnabledForUser
} from '../../../../lib/investor/loansPreferenceService';

export const dynamic = 'force-dynamic';

/**
 * This is a settings preference toggle, not a checkout/trading action, so it
 * only requires an authenticated session — it must NOT gate on marketplace
 * checkout eligibility (KYC + linked collection wallet + 2FA), otherwise
 * accounts that haven't linked a wallet yet can never activate the switch.
 */
async function requireAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await requireAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const loansEnabled = await getLoansEnabledForUser(userId);
  if (loansEnabled === null) {
    return NextResponse.json({ error: 'INVESTOR_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ loansEnabled });
}

export async function PATCH(request: Request) {
  const userId = await requireAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { loansEnabled?: unknown };
  if (typeof body.loansEnabled !== 'boolean') {
    return NextResponse.json({ error: 'INVALID_PREFERENCE' }, { status: 400 });
  }

  try {
    const loansEnabled = await updateLoansEnabledForUser(userId, body.loansEnabled);
    return NextResponse.json({ loansEnabled });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UPDATE_FAILED';
    const status = message === 'INVESTOR_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
