import { NextResponse } from 'next/server';
import { listAdvisorDownline } from '../../../../lib/advisor/downlineService';
import { requireAdvisorSession } from '../../../../lib/staff/requireStaff';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireAdvisorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (ctx.advisor.role !== 'ADVISOR_MANAGER') {
    return NextResponse.json({ error: 'Managers only' }, { status: 403 });
  }

  try {
    const advisors = await listAdvisorDownline(ctx.advisor);
    return NextResponse.json({ advisors });
  } catch (error) {
    console.error('[advisor/downline GET]', error);
    return NextResponse.json({ error: 'Failed to load downline' }, { status: 500 });
  }
}
