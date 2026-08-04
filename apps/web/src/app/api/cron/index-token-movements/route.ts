import { NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';
import { indexTokenMovements } from '../../../../lib/reconciliation/indexTokenMovements';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Persist the on-chain bitácora (vault share transfers + treasury USDC) so audits
 * read from the DB instead of scanning RPC logs on demand.
 */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await indexTokenMovements();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/index-token-movements]', error);
    return NextResponse.json({ error: 'INDEX_FAILED' }, { status: 500 });
  }
}
