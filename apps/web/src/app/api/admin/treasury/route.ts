import { NextResponse } from 'next/server';
import { getTreasuryOverview, type PayoutListFilter } from '../../../../lib/admin/treasuryService';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';

const VALID_FILTERS = new Set<PayoutListFilter>(['ALL', 'PENDING', 'SUCCESS', 'FAILED']);

export async function GET(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawFilter = (searchParams.get('status') ?? 'ALL').toUpperCase();
  const filter = VALID_FILTERS.has(rawFilter as PayoutListFilter)
    ? (rawFilter as PayoutListFilter)
    : 'ALL';

  try {
    const overview = await getTreasuryOverview(filter);
    return NextResponse.json({ ...overview, filter });
  } catch (error) {
    console.error('[admin/treasury]', error);
    return NextResponse.json({ error: 'Failed to load treasury data' }, { status: 500 });
  }
}
