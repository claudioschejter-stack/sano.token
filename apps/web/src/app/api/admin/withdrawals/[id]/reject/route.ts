import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { rejectPlatformWithdrawal } from '../../../../../../lib/payments/platformWithdrawalService';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RejectBody = {
  reason?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  let body: RejectBody;
  try {
    body = (await request.json()) as RejectBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.reason?.trim()) {
    return NextResponse.json({ error: 'REJECTION_REASON_REQUIRED' }, { status: 400 });
  }

  try {
    const withdrawal = await rejectPlatformWithdrawal({
      withdrawalId: id,
      adminUserId: session.user.id,
      reason: body.reason
    });
    return NextResponse.json({ withdrawal });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      message === 'WITHDRAWAL_NOT_FOUND'
        ? 404
        : message === 'WITHDRAWAL_NOT_FULFILLABLE' || message === 'REJECTION_REASON_REQUIRED'
          ? 400
          : 500;

    console.error('[admin/withdrawals/reject]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
