import { NextResponse } from 'next/server';
import {
  createAdminAsset,
  listAdminAssets,
  type AssetListFilter,
  type CreateAdminAssetInput
} from '../../../../lib/admin/assetsService';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';

const VALID_FILTERS = new Set<AssetListFilter>(['ALL', 'ACTIVE', 'INACTIVE']);

export async function GET(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawFilter = (searchParams.get('status') ?? 'ALL').toUpperCase();
  const filter = VALID_FILTERS.has(rawFilter as AssetListFilter)
    ? (rawFilter as AssetListFilter)
    : 'ALL';

  try {
    const assets = await listAdminAssets(filter);
    return NextResponse.json({ assets, filter });
  } catch (error) {
    console.error('[admin/assets]', error);
    return NextResponse.json({ error: 'Failed to load assets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CreateAdminAssetInput;
    const asset = await createAdminAsset(body);
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (
      message === 'MISSING_REQUIRED_FIELDS' ||
      message === 'INVALID_TOTAL_TOKENS' ||
      message === 'INVALID_PRICE' ||
      message === 'INVALID_YIELD'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[admin/assets POST]', error);
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
  }
}
