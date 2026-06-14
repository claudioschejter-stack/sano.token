import { NextResponse } from 'next/server';
import { listAdvisorClients } from '../../../../../lib/advisor/clientsService';
import { buildClientsCsv } from '../../../../../lib/advisor/clientsExport';
import { requireAdvisorSession } from '../../../../../lib/staff/requireStaff';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireAdvisorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const clients = await listAdvisorClients(ctx.advisor, 'ALL');
    const csv = buildClientsCsv(clients);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="advisor-clients.csv"'
      }
    });
  } catch (error) {
    console.error('[advisor/clients/export GET]', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
