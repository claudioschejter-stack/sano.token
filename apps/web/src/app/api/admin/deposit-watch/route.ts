import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  isAlchemyWebhookManaged,
  watchAddressesForDeposits
} from '../../../../lib/payments/alchemyWebhookAddresses';
import { depositWatchTargets } from '../../../../lib/payments/depositWatchTargets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/** Admin: how many investor wallets exist to be watched, and whether it is wired. */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const wallets = await depositWatchTargets();
  return NextResponse.json({
    ok: true,
    managed: isAlchemyWebhookManaged(),
    walletCount: wallets.length,
    /**
     * Alchemy does not report which addresses it already watches, so this is
     * what should be registered rather than what is. Re-registering is
     * idempotent, so running the backfill is always safe.
     */
    wallets: wallets.slice(0, 50)
  });
}

/**
 * Admin: register every existing investor wallet with the deposit webhook.
 *
 * New wallets register themselves when they are linked. This is for the ones
 * created before that existed, and for re-syncing after the webhook is
 * recreated — Alchemy loses the list with it.
 */
export async function POST(_request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isAlchemyWebhookManaged()) {
    return NextResponse.json(
      {
        error: 'ALCHEMY_WEBHOOK_NOT_MANAGED',
        detail: 'Faltan ALCHEMY_NOTIFY_AUTH_TOKEN y ALCHEMY_WEBHOOK_ID en el entorno.'
      },
      { status: 503 }
    );
  }

  const wallets = await depositWatchTargets();
  const result = await watchAddressesForDeposits(wallets);

  if (result.ok === false) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, registered: result.added });
}
