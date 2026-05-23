import { NextResponse } from 'next/server';
import { designateAdvisor, listAdvisorTeam } from '../../../../../lib/admin/teamService';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const advisors = await listAdvisorTeam();
    return NextResponse.json({ advisors });
  } catch (error) {
    console.error('[admin/team/advisors GET]', error);
    return NextResponse.json({ error: 'Failed to load advisors' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      role?: 'ADVISOR' | 'ADVISOR_MANAGER';
      uplineAdvisorId?: string | null;
      tier?: 'JUNIOR' | 'SENIOR' | 'PARTNER';
    };

    if (!body.email || !body.role) {
      return NextResponse.json({ error: 'Missing email or role' }, { status: 400 });
    }

    const advisor = await designateAdvisor({
      email: body.email,
      name: body.name,
      role: body.role,
      uplineAdvisorId: body.uplineAdvisorId,
      tier: body.tier
    });

    return NextResponse.json({ advisor }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      code === 'INVALID_EMAIL'
        ? 400
        : code === 'UPLINE_NOT_FOUND' || code === 'ADVISOR_REQUIRES_UPLINE'
          ? 400
          : code === 'MANAGER_CANNOT_HAVE_UPLINE'
            ? 400
            : 500;

    console.error('[admin/team/advisors POST]', error);
    return NextResponse.json({ error: code }, { status });
  }
}
