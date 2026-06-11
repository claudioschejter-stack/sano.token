import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../../lib/onboarding/requireAuthenticatedSession';
import { createWalletLinkChallenge } from '../../../../../lib/investor/walletLinkProof';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { walletAddress?: string };
    if (!body.walletAddress?.trim()) {
      return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
    }

    const challenge = createWalletLinkChallenge(ctx.userId, body.walletAddress.trim());
    return NextResponse.json(challenge);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'INVALID_WALLET') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[investor/wallet/challenge]', error);
    return NextResponse.json({ error: 'WALLET_CHALLENGE_FAILED' }, { status: 500 });
  }
}
