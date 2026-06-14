import { NextResponse } from 'next/server';
import { listPendingTeamInvites } from '../../../../../lib/admin/teamInviteService';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const invites = await listPendingTeamInvites();
    return NextResponse.json({ invites });
  } catch (error) {
    console.error('[admin/team/invites GET]', error);
    return NextResponse.json({ error: 'Failed to load invites' }, { status: 500 });
  }
}
