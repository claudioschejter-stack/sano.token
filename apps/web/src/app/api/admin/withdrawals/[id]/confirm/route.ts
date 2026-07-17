import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { confirmPlatformWithdrawal } from '../../../../../../lib/payments/platformWithdrawalService';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ConfirmBody = {
  /** On-chain tx hash for STABLECOIN, or the bank/transfer reference for FIAT. Accepts legacy `txHash` too. */
  reference?: string;
  txHash?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const reference = body.reference ?? body.txHash;
  if (!reference?.trim()) {
    return NextResponse.json({ error: 'REFERENCE_REQUIRED' }, { status: 400 });
  }

  try {
    const withdrawal = await confirmPlatformWithdrawal({
      withdrawalId: id,
      adminUserId: session.user.id,
      reference
    });
    return NextResponse.json({ withdrawal });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      message === 'WITHDRAWAL_NOT_FOUND'
        ? 404
        : message === 'WITHDRAWAL_NOT_FULFILLABLE' || message === 'REFERENCE_REQUIRED'
          ? 400
          : 500;

    console.error('[admin/withdrawals/confirm]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
