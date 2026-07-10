import { NextResponse } from 'next/server';
import { resendTeamInvite } from '../../../../../../../lib/admin/teamInviteService';
import { requireAdminSession } from '../../../../../../../lib/admin/requireAdmin';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ inviteId: string }> }
) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { inviteId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { locale?: string | null };

  try {
    const invite = await resendTeamInvite(inviteId, body.locale);
    if (!invite.emailSent) {
      return NextResponse.json(
        { invite, warning: 'INVITE_CREATED_EMAIL_NOT_SENT' },
        { status: 201 }
      );
    }
    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      message === 'INVITE_NOT_FOUND' || message === 'INVITE_EXPIRED' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
