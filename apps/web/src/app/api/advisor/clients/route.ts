import { NextResponse } from 'next/server';
import { listAdvisorClients, type ClientListFilter } from '../../../../lib/advisor/clientsService';
import { requireAdvisorSession } from '../../../../lib/staff/requireStaff';

const VALID_FILTERS = new Set<ClientListFilter>(['ALL', 'PENDING', 'APPROVED', 'REJECTED']);

export async function GET(request: Request) {
  const ctx = await requireAdvisorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawFilter = (searchParams.get('status') ?? 'ALL').toUpperCase();
  const filter = VALID_FILTERS.has(rawFilter as ClientListFilter)
    ? (rawFilter as ClientListFilter)
    : 'ALL';

  try {
    const clients = await listAdvisorClients(ctx.advisor, filter);
    return NextResponse.json({ clients, filter, readOnly: true });
  } catch (error) {
    console.error('[advisor/clients GET]', error);
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 });
  }
}
