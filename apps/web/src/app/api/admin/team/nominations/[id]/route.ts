import { NextResponse } from 'next/server';
import { reviewAdvisorNomination } from '../../../../../../lib/admin/teamService';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';

type RouteContext = { params: { id: string } };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      decision?: 'APPROVED' | 'REJECTED';
      rejectionReason?: string;
    };

    if (body.decision !== 'APPROVED' && body.decision !== 'REJECTED') {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
    }

    const nomination = await reviewAdvisorNomination(
      context.params.id,
      session.user.id,
      body.decision,
      body.rejectionReason
    );

    return NextResponse.json({ nomination });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const status = code === 'NOMINATION_NOT_FOUND' ? 404 : 500;
    console.error('[admin/team/nominations PATCH]', error);
    return NextResponse.json({ error: code }, { status });
  }
}
