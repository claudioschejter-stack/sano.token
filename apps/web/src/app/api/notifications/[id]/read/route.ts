import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../../lib/onboarding/requireAuthenticatedSession';
import { markNotificationRead } from '../../../../../lib/notifications/notificationService';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await params;
  await markNotificationRead(ctx.userId, id);

  return NextResponse.json({ ok: true });
}
