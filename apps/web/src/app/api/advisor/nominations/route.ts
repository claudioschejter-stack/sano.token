import { NextResponse } from 'next/server';
import { suggestAdvisor } from '../../../../lib/admin/teamService';
import { requireAdvisorSession } from '../../../../lib/staff/requireStaff';

export async function POST(request: Request) {
  const ctx = await requireAdvisorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (ctx.advisor.role !== 'ADVISOR' && ctx.advisor.role !== 'ADVISOR_MANAGER') {
    return NextResponse.json({ error: 'Only advisors or managers can suggest new advisors' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { email?: string; name?: string };
    if (!body.email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const nomination = await suggestAdvisor({
      email: body.email,
      name: body.name,
      suggestedByAdvisorId: ctx.advisor.advisorId
    });

    return NextResponse.json({ nomination }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      code === 'INVALID_EMAIL' ||
      code === 'EMAIL_ALREADY_STAFF' ||
      code === 'NOMINATION_ALREADY_PENDING' ||
      code === 'INVESTOR_HAS_ACTIVE_HOLDINGS'
        ? 400
        : 500;

    console.error('[advisor/nominations POST]', error);
    return NextResponse.json({ error: code }, { status });
  }
}
