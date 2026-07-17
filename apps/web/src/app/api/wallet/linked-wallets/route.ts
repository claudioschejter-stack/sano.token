import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { listLinkedCryptoWallets } from '../../../../lib/investor/linkedWalletsService';
import { listLinkedFiatIdentities } from '../../../../lib/investor/linkedFiatIdentityService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const [cryptoWallets, fiatIdentities] = await Promise.all([
    listLinkedCryptoWallets(ctx.userId),
    listLinkedFiatIdentities(ctx.userId)
  ]);

  return NextResponse.json({ ok: true, cryptoWallets, fiatIdentities });
}
