import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { inviteInvestor } from '../../../../../lib/admin/investorInviteService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await auth();
  const adminUserId = session?.user?.id;
  const role = session?.user?.role;

  if (!adminUserId || role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      incorporatedByAdvisorId?: string | null;
    };

    if (!body.email?.trim()) {
      return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 });
    }

    const invite = await inviteInvestor({
      email: body.email,
      name: body.name,
      incorporatedByAdvisorId: body.incorporatedByAdvisorId,
      invitedByUserId: adminUserId
    });

    if (!invite.emailSent) {
      return NextResponse.json(
        { invite, warning: 'INVITE_CREATED_EMAIL_NOT_SENT' },
        { status: 201 }
      );
    }

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (
      message === 'INVALID_EMAIL' ||
      message === 'INVITE_ALREADY_PENDING' ||
      message === 'EMAIL_ALREADY_STAFF' ||
      message === 'ADVISOR_NOT_FOUND'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[admin/investors/invite POST]', error);
    return NextResponse.json({ error: 'INVITE_FAILED' }, { status: 500 });
  }
}
