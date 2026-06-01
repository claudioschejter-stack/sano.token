import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { linkInvestorWallet } from '../../../../lib/investor/walletService';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { walletAddress?: string };

    if (!body.walletAddress?.trim()) {
      return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
    }

    const result = await linkInvestorWallet(ctx.userId, body.walletAddress);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message === 'KYC_NOT_APPROVED' || message === 'INVESTOR_ROLE_REQUIRED' || message === 'INVALID_WALLET') {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[investor/wallet PATCH]', error);
    return NextResponse.json({ error: 'WALLET_LINK_FAILED' }, { status: 500 });
  }
}
