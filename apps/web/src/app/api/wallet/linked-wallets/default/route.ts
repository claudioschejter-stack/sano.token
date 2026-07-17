import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { setDefaultLinkedCryptoWallet } from '../../../../../lib/investor/linkedWalletsService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const body = (await request.json()) as { address?: string };
    if (!body.address?.trim()) {
      return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
    }

    await setDefaultLinkedCryptoWallet(ctx.userId, body.address.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status = message === 'WALLET_NOT_LINKED_TO_ACCOUNT' || message === 'INVALID_WALLET' ? 400 : 500;
    console.error('[wallet/linked-wallets/default]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
