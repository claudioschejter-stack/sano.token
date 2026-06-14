import { NextResponse } from 'next/server';
import { cancelInvestorInvite } from '../../../../../../../lib/admin/investorInviteService';
import { requireAdminSession } from '../../../../../../../lib/admin/requireAdmin';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  context: { params: Promise<{ inviteId: string }> }
) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { inviteId } = await context.params;

  try {
    await cancelInvestorInvite(inviteId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status = message === 'INVITE_NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
