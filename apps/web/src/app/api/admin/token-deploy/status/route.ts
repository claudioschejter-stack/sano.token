import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { getTokenDeployStatus } from '../../../../../lib/blockchain/tokenDeployConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(getTokenDeployStatus());
}
