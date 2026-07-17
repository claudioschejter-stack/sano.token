import { NextResponse } from 'next/server';
import type { PlatformWithdrawalStatus } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { listWithdrawalsForAdmin } from '../../../../lib/payments/platformWithdrawalService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') ?? 'ALL') as PlatformWithdrawalStatus | 'ALL';

  try {
    const withdrawals = await listWithdrawalsForAdmin(status);
    return NextResponse.json({ withdrawals });
  } catch (error) {
    console.error('[admin/withdrawals]', error);
    return NextResponse.json({ error: 'UNKNOWN' }, { status: 500 });
  }
}
