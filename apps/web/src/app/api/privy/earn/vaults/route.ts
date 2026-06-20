import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../../lib/onboarding/requireAuthenticatedSession';
import { isPrivyEarnConfigured } from '../../../../../lib/privy/config';
import { listPrivyEarnVaultCatalog } from '../../../../../lib/privy/privyEarnVaultCatalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!isPrivyEarnConfigured()) {
    return NextResponse.json({ error: 'PRIVY_EARN_NOT_CONFIGURED', vaults: [] }, { status: 503 });
  }

  try {
    const catalog = await listPrivyEarnVaultCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PRIVY_EARN_VAULTS_FAILED';
    console.error('[privy/earn/vaults GET]', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
