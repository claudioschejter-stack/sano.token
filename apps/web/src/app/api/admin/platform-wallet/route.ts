import { NextResponse } from 'next/server';
import { getPlatformWalletConfig } from '../../../../lib/admin/platformWalletConfig';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  return NextResponse.json({ config: getPlatformWalletConfig() });
}
