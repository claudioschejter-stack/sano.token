import { NextResponse } from 'next/server';
import { listPendingInvestorInvites } from '../../../../../lib/admin/investorInviteService';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const invites = await listPendingInvestorInvites();
    return NextResponse.json({ invites });
  } catch (error) {
    console.error('[admin/investors/invites GET]', error);
    return NextResponse.json({ error: 'Failed to load invites' }, { status: 500 });
  }
}
