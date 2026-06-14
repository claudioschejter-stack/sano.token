import { NextResponse } from 'next/server';
import { getAdvisorDashboardStats } from '../../../../lib/advisor/dashboardService';
import { requireAdvisorSession } from '../../../../lib/staff/requireStaff';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireAdvisorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const stats = await getAdvisorDashboardStats(ctx.advisor);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('[advisor/dashboard GET]', error);
    return NextResponse.json({ error: 'Failed to load dashboard stats' }, { status: 500 });
  }
}
