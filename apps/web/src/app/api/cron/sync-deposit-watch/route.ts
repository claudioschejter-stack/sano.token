import { NextResponse } from 'next/server';
import { isCronRequestAllowed } from '../../../../lib/cron/authorizeCronRequest';
import {
  isAlchemyWebhookManaged,
  watchAddressesForDeposits
} from '../../../../lib/payments/alchemyWebhookAddresses';
import { depositWatchTargets } from '../../../../lib/payments/depositWatchTargets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Keep the deposit webhook's address list current, without anyone remembering to.
 *
 * The webhook is what makes a deposit credit in seconds instead of waiting for a
 * scan. It only notifies the addresses on its list, and Alchemy does not report
 * which ones it already watches — so there is no way to check whether the list is
 * complete. Worse, recreating the webhook silently empties it, and the symptom is
 * an investor's money sitting there while the platform says nothing.
 *
 * New wallets register themselves when they are linked. This exists for the gap
 * that registration cannot cover: everything created before it, and every time
 * the webhook is replaced. Re-declaring the whole list is idempotent on Alchemy's
 * side, so running it on a schedule costs one request and removes a class of
 * silent failure.
 */
export async function GET(request: Request) {
  if (!(await isCronRequestAllowed(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAlchemyWebhookManaged()) {
    return NextResponse.json({
      ok: true,
      skipped: 'ALCHEMY_WEBHOOK_NOT_MANAGED',
      detail: 'Faltan ALCHEMY_NOTIFY_AUTH_TOKEN y ALCHEMY_WEBHOOK_ID en el entorno.'
    });
  }

  const addresses = await depositWatchTargets();
  const result = await watchAddressesForDeposits(addresses);

  if (result.ok === false) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, registered: result.added });
}
