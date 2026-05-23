import { NextResponse } from 'next/server';
import { listPlatformTeamMembers } from '../../../../../lib/admin/teamService';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const members = await listPlatformTeamMembers();
    return NextResponse.json({ members });
  } catch (error) {
    console.error('[admin/team/members GET]', error);
    return NextResponse.json({ error: 'Failed to load team members' }, { status: 500 });
  }
}
