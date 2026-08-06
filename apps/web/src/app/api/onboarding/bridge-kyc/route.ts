import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import {
  ensureBridgeOnboarding,
  readBridgeOnboarding
} from '../../../../lib/payments/bridgeCustomerService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Where the investor's Bridge onboarding stands.
 *
 * Read-only and cached, so the onboarding screen can poll it without hammering
 * Bridge. `POST` forces a refresh, which is what the investor's "ya lo completé"
 * button needs.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, bridge: await readBridgeOnboarding(session.user.id) });
}

/** Create the Bridge customer if needed, or re-check after the hosted flow. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { refresh?: boolean };

  const bridge = await ensureBridgeOnboarding({
    userId: session.user.id,
    email: session.user.email,
    fullName: session.user.name?.trim() || session.user.email,
    refresh: body.refresh !== false
  });

  return NextResponse.json({ ok: true, bridge });
}
