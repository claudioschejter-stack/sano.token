import { NextResponse } from 'next/server';
import {
  buildCommissionDistributionCsv,
  getAdvisorCommissionSummary,
  listAdvisorCommissions
} from '../../../../lib/advisor/commissionService';
import { requireAdvisorSession } from '../../../../lib/staff/requireStaff';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireAdvisorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [summary, rows] = await Promise.all([
      getAdvisorCommissionSummary(ctx.advisor),
      listAdvisorCommissions(ctx.advisor)
    ]);

    return NextResponse.json({ summary, rows });
  } catch (error) {
    console.error('[advisor/commissions GET]', error);
    return NextResponse.json({ error: 'Failed to load commissions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await requireAdvisorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== 'export') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const rows = await listAdvisorCommissions(ctx.advisor, 5000);
    const csv = buildCommissionDistributionCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="commission-distribution.csv"'
      }
    });
  } catch (error) {
    console.error('[advisor/commissions export]', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
