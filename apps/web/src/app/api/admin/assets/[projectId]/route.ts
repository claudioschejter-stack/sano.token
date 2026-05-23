import { NextResponse } from 'next/server';
import { getAdminAsset, updateAdminAsset, type UpdateAdminAssetInput } from '../../../../../lib/admin/assetsService';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;

  try {
    const asset = await getAdminAsset(projectId);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('[admin/assets/get]', error);
    return NextResponse.json({ error: 'Failed to load asset' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;

  let body: UpdateAdminAssetInput;
  try {
    body = (await request.json()) as UpdateAdminAssetInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const updated = await updateAdminAsset(projectId, body);

    if (!updated) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ asset: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (
      message === 'INVALID_AVAILABLE_TOKENS' ||
      message === 'AVAILABLE_EXCEEDS_TOTAL' ||
      message === 'INVALID_TOTAL_TOKENS'
    ) {
      return NextResponse.json({ error: 'Invalid token count' }, { status: 400 });
    }

    if (message === 'INVALID_PRICE') {
      return NextResponse.json({ error: 'Invalid price per token' }, { status: 400 });
    }

    console.error('[admin/assets/patch]', error);
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
  }
}
