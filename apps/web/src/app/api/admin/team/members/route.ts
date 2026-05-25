import { NextResponse } from 'next/server';
import {
  deletePlatformTeamMembers,
  listPlatformTeamMembers,
  updatePlatformTeamMember
} from '../../../../../lib/admin/teamService';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import type { SystemRole } from '../../../../../lib/auth/roles';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const members = await listPlatformTeamMembers();
    return NextResponse.json({ members });
  } catch (error) {
    console.error('[admin/team/members GET]', error);
    return NextResponse.json({ error: 'Failed to load team members' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      email?: string;
      fullName?: string | null;
      identification?: string | null;
      phone?: string | null;
      systemRole?: string;
    };

    if (!body.userId || !body.email || !body.systemRole) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const member = await updatePlatformTeamMember({
      userId: body.userId,
      email: body.email,
      fullName: body.fullName,
      identification: body.identification,
      phone: body.phone,
      systemRole: body.systemRole as SystemRole
    });

    return NextResponse.json({ member });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      message === 'INVALID_EMAIL' || message === 'INVALID_PHONE' || message === 'INVALID_ROLE'
        ? 400
        : message === 'ADVISOR_REQUIRES_UPLINE' || message === 'USER_NOT_FOUND'
          ? 400
          : message === 'P2002'
          ? 409
          : 500;

    console.error('[admin/team/members PATCH]', message);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  const session = await requireAdminSession();
  const currentAdminUserId = session?.user?.id;

  if (!session || !currentAdminUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { userIds?: string[] };
    const result = await deletePlatformTeamMembers(body.userIds ?? [], currentAdminUserId);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      message === 'NO_USERS_SELECTED' || message === 'CANNOT_DELETE_SELF'
        ? 400
        : 500;

    console.error('[admin/team/members DELETE]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
