import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { assignInvestorToAdvisor } from '../../../../../../lib/admin/teamService';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';

type RouteContext = { params: { userId: string } };

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { advisorId?: string };
    if (!body.advisorId) {
      return NextResponse.json({ error: 'Missing advisorId' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { id: context.params.userId, systemRole: 'INVESTOR' },
      select: { investorId: true }
    });

    if (!user?.investorId) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
    }

    await assignInvestorToAdvisor(user.investorId, body.advisorId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const status = code === 'ADVISOR_NOT_FOUND' ? 404 : 500;
    console.error('[admin/investors/advisor PATCH]', error);
    return NextResponse.json({ error: code }, { status });
  }
}
