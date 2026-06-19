import { NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';
import { migrateTreasuryFromLegacySafe } from '../../../../lib/blockchain/migrateTreasuryFromLegacySafe';

export const maxDuration = 300;

/** Cron — fund legacy Safe owner gas (from Morpho Privy) and migrate vault shares to Privy treasury. */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await migrateTreasuryFromLegacySafe();
    const status = result.ok ? 200 : result.reason?.includes('MISSING') ? 503 : 500;
    return NextResponse.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MIGRATE_TREASURY_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
