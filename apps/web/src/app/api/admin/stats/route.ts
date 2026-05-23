import { NextResponse } from 'next/server';
import { getAdminStats } from '../../../../lib/admin/getAdminStats';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const stats = await getAdminStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[admin/stats]', error);
    return NextResponse.json({ error: 'Failed to load admin stats' }, { status: 500 });
  }
}
