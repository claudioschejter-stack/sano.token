import { NextResponse } from 'next/server';
import type { RentPayoutPreference } from '@sanova/database';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import {
  getRentPayoutPreferenceForUser,
  updateRentPayoutPreferenceForUser
} from '../../../../lib/investor/rentPayoutService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const preference = await getRentPayoutPreferenceForUser(ctx.userId);
  if (!preference) {
    return NextResponse.json({ error: 'INVESTOR_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ preference });
}

export async function PATCH(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    preference?: RentPayoutPreference;
    walletAddress?: string;
  };
  if (body.preference !== 'FIAT' && body.preference !== 'USDC') {
    return NextResponse.json({ error: 'INVALID_PREFERENCE' }, { status: 400 });
  }

  try {
    const preference = await updateRentPayoutPreferenceForUser(ctx.userId, body.preference);
    return NextResponse.json({ preference });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UPDATE_FAILED';
    const status =
      message === 'INVESTOR_NOT_FOUND'
        ? 404
        : message === 'INVESTOR_WALLET_REQUIRED' || message === 'INVALID_PREFERENCE'
          ? 400
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
