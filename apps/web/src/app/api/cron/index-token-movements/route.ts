import { NextResponse } from 'next/server';
import { isCronRequestAllowed } from '../../../../lib/cron/authorizeCronRequest';
import { indexTokenMovements } from '../../../../lib/reconciliation/indexTokenMovements';
import { indexMorphoMovements } from '../../../../lib/reconciliation/indexMorphoMovements';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Persist the on-chain bitácora so audits read from the DB instead of scanning
 * RPC logs on demand: token transfers plus Morpho's own lending events, which no
 * token contract can show.
 *
 * Each indexer runs isolated — one failing must not cost the other its pass,
 * because a missed pass used to leave a permanent hole in the ledger.
 */
export async function GET(request: Request) {
  if (!(await isCronRequestAllowed(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const transfers = await indexTokenMovements().catch((error) => {
    console.error('[cron/index-token-movements] transfers', error);
    return { error: error instanceof Error ? error.message.slice(0, 200) : 'TRANSFERS_FAILED' };
  });

  const morpho = await indexMorphoMovements().catch((error) => {
    console.error('[cron/index-token-movements] morpho', error);
    return { error: error instanceof Error ? error.message.slice(0, 200) : 'MORPHO_FAILED' };
  });

  const failed = 'error' in transfers || 'error' in morpho;
  return NextResponse.json({ ok: !failed, transfers, morpho }, { status: failed ? 207 : 200 });
}
