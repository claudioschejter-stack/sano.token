import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../../lib/onboarding/requireAuthenticatedSession';
import { listUnifiedVaultCatalog } from '../../../../../lib/vaults/unifiedVaultCatalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const catalog = await listUnifiedVaultCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'VAULTS_FETCH_FAILED';
    console.error('[privy/earn/vaults GET]', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
