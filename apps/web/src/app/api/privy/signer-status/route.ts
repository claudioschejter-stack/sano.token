import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'ethers';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { walletHasAppSigner } from '../../../../lib/privy/appSignerGrant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Whether the app authorization key can already sign for this wallet, so the
 * browser can skip `addSigners` instead of provoking a 400 it then ignores.
 */
export async function GET(request: NextRequest) {
  const session = await requireAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const address = new URL(request.url).searchParams.get('address')?.trim();
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'INVALID_ADDRESS' }, { status: 400 });
  }

  // `null` means undetermined: the caller should attempt the grant.
  const granted = await walletHasAppSigner(address);
  return NextResponse.json({ ok: true, granted });
}
