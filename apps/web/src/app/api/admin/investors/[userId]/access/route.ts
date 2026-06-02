import { NextResponse } from 'next/server';
import { updateInvestorAccessEnabled } from '../../../../../../lib/admin/investorsService';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await context.params;

  let body: { enabled?: boolean };
  try {
    body = (await request.json()) as { enabled?: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }

  try {
    const updated = await updateInvestorAccessEnabled(userId, body.enabled);

    if (!updated) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
    }

    return NextResponse.json({ investor: updated });
  } catch (error) {
    console.error('[admin/investors/access]', error);
    return NextResponse.json({ error: 'Failed to update investor access' }, { status: 500 });
  }
}
