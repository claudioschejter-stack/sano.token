import { NextResponse } from 'next/server';
import type { KycStatus } from '@sanova/database';
import { updateInvestorKycStatus } from '../../../../../../lib/admin/investorsService';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';

type RouteContext = {
  params: Promise<{ userId: string }>;
};

type KycBody = {
  status?: KycStatus;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await context.params;

  let body: KycBody;
  try {
    body = (await request.json()) as KycBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.status !== 'APPROVED' && body.status !== 'REJECTED') {
    return NextResponse.json({ error: 'status must be APPROVED or REJECTED' }, { status: 400 });
  }

  try {
    const updated = await updateInvestorKycStatus(userId, body.status);

    if (!updated) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
    }

    return NextResponse.json({ investor: updated });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      code === 'CONTACT_NOT_VERIFIED'
        ? 400
        : 500;

    console.error('[admin/investors/kyc]', error);
    return NextResponse.json({ error: code }, { status });
  }
}
