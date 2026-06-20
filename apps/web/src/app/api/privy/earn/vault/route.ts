import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../../lib/onboarding/requireAuthenticatedSession';
import { getPrivyVaultDetails } from '../../../../../lib/privy/earnApi';
import { isPrivyEarnConfigured, resolvePrivyEarnVaultId } from '../../../../../lib/privy/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!isPrivyEarnConfigured()) {
    return NextResponse.json({ error: 'PRIVY_EARN_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const vaultAddress = request.nextUrl.searchParams.get('vaultAddress');
    const vaultId = resolvePrivyEarnVaultId(vaultAddress) ?? undefined;
    const vault = await getPrivyVaultDetails(vaultId);
    return NextResponse.json({ vault, vaultId: vaultId ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PRIVY_VAULT_DETAILS_FAILED';
    console.error('[privy/earn/vault GET]', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
