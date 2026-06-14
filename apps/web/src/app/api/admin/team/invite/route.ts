import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { inviteTeamMember } from '../../../../../lib/admin/teamInviteService';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const session = await auth();
  const adminUserId = session?.user?.id;
  if (!adminUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      phone?: string;
      role?: 'ADVISOR' | 'ADVISOR_MANAGER';
      uplineAdvisorId?: string | null;
    };

    if (!body.email || !body.role) {
      return NextResponse.json({ error: 'Missing email or role' }, { status: 400 });
    }

    const invite = await inviteTeamMember({
      email: body.email,
      name: body.name,
      phone: body.phone,
      role: body.role,
      uplineAdvisorId: body.uplineAdvisorId,
      invitedByUserId: adminUserId
    });

    if (!invite.emailSent && !invite.whatsappSent) {
      return NextResponse.json(
        { invite, warning: 'INVITE_CREATED_DELIVERY_NOT_SENT' },
        { status: 201 }
      );
    }

    if (!invite.emailSent) {
      return NextResponse.json(
        { invite, warning: 'INVITE_CREATED_EMAIL_NOT_SENT' },
        { status: 201 }
      );
    }

    if (body.phone?.trim() && !invite.whatsappSent) {
      return NextResponse.json(
        { invite, warning: 'INVITE_CREATED_WHATSAPP_NOT_SENT' },
        { status: 201 }
      );
    }

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      code === 'INVALID_EMAIL' ||
      code === 'ADVISOR_REQUIRES_UPLINE' ||
      code === 'UPLINE_NOT_FOUND' ||
      code === 'MANAGER_CANNOT_HAVE_UPLINE' ||
      code === 'EMAIL_ALREADY_STAFF' ||
      code === 'EMAIL_ALREADY_ADVISOR' ||
      code === 'INVITE_ALREADY_PENDING'
        ? 400
        : 500;

    console.error('[admin/team/invite POST]', error);
    return NextResponse.json({ error: code }, { status });
  }
}
