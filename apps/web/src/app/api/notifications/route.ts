import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../lib/onboarding/requireAuthenticatedSession';
import { countUnreadNotifications, listNotifications } from '../../../lib/notifications/notificationService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(ctx.userId),
    countUnreadNotifications(ctx.userId)
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
