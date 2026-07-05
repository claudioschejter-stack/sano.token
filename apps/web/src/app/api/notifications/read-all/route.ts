import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { markAllNotificationsRead } from '../../../../lib/notifications/notificationService';

export async function POST() {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  await markAllNotificationsRead(ctx.userId);

  return NextResponse.json({ ok: true });
}
