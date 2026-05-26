import { NextResponse } from 'next/server';
import { listAllowlistableAssets } from '../../../../lib/admin/assetsService';
import { listAdminInvestors, type InvestorListFilter } from '../../../../lib/admin/investorsService';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';

const VALID_FILTERS = new Set<InvestorListFilter>(['ALL', 'PENDING', 'APPROVED', 'REJECTED']);

export async function GET(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawFilter = (searchParams.get('status') ?? 'ALL').toUpperCase();
  const filter = VALID_FILTERS.has(rawFilter as InvestorListFilter)
    ? (rawFilter as InvestorListFilter)
    : 'ALL';

  try {
    const [investors, allowlistAssets] = await Promise.all([
      listAdminInvestors(filter),
      listAllowlistableAssets()
    ]);
    return NextResponse.json({ investors, filter, allowlistAssets });
  } catch (error) {
    console.error('[admin/investors]', error);
    return NextResponse.json({ error: 'Failed to load investors' }, { status: 500 });
  }
}
