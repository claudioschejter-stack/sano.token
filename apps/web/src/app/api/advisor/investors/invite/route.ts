import { NextResponse } from 'next/server';
import { getScopedAdvisorIds } from '../../../../../lib/advisor/advisorContext';
import { inviteInvestor } from '../../../../../lib/admin/investorInviteService';
import { requireAdvisorSession } from '../../../../../lib/staff/requireStaff';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireAdvisorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      phone?: string;
      incorporatedByAdvisorId?: string | null;
    };

    if (!body.email?.trim()) {
      return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 });
    }

    let incorporatedByAdvisorId = ctx.advisor.advisorId;

    if (body.incorporatedByAdvisorId && ctx.advisor.role === 'ADVISOR_MANAGER') {
      const scoped = await getScopedAdvisorIds(ctx.advisor);
      if (!scoped.includes(body.incorporatedByAdvisorId)) {
        return NextResponse.json({ error: 'ADVISOR_OUT_OF_SCOPE' }, { status: 400 });
      }
      incorporatedByAdvisorId = body.incorporatedByAdvisorId;
    }

    const invite = await inviteInvestor({
      email: body.email,
      name: body.name,
      phone: body.phone,
      incorporatedByAdvisorId,
      invitedByUserId: ctx.session.user.id
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
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (
      message === 'INVALID_EMAIL' ||
      message === 'INVITE_ALREADY_PENDING' ||
      message === 'EMAIL_ALREADY_STAFF' ||
      message === 'ADVISOR_NOT_FOUND'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[advisor/investors/invite POST]', error);
    return NextResponse.json({ error: 'INVITE_FAILED' }, { status: 500 });
  }
}
