import { NextResponse } from 'next/server';
import {
  createAdminAsset,
  listAdminAssets,
  type AssetListFilter,
  type CreateAdminAssetInput
} from '../../../../lib/admin/assetsService';
import { isErc4626Standard } from '../../../../lib/admin/erc4626LaunchGate';
import {
  finalizeErc4626AfterPersist,
  sanitizeErc4626CreateBody,
  validateErc4626BeforePersist
} from '../../../../lib/admin/erc4626LaunchSave';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';

const VALID_FILTERS = new Set<AssetListFilter>(['ALL', 'ACTIVE', 'INACTIVE']);

export const maxDuration = 300;

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
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const raw = (await request.json()) as CreateAdminAssetInput;
    const wantsPublish = raw.isActive === true;
    const body = sanitizeErc4626CreateBody(raw);

    const gateIssues = await validateErc4626BeforePersist(body, null);
    if (gateIssues.length) {
      return NextResponse.json({ error: 'LAUNCH_NOT_READY', issues: gateIssues }, { status: 422 });
    }

    const asset = await createAdminAsset(body);

    if (isErc4626Standard(body.tokenStandard)) {
      const finalized = await finalizeErc4626AfterPersist(asset.id, { requestedPublish: wantsPublish });
      if (finalized.ok === false) {
        return NextResponse.json(
          { error: 'LAUNCH_NOT_READY', issues: finalized.issues, asset },
          { status: 422 }
        );
      }

      let finalAsset = finalized.asset;
      if (wantsPublish) {
        const { updateAdminAsset } = await import('../../../../lib/admin/assetsService');
        const published = await updateAdminAsset(asset.id, { isActive: true });
        finalAsset = published ?? finalAsset;
      }

      return NextResponse.json({ asset: finalAsset, deploy: finalized.deploy }, { status: 201 });
    }

    if (body.deployToken !== false && !asset.contractAddress) {
      const { executeProjectTokenDeploy } = await import('../../../../lib/blockchain/projectTokenDeploy');
      const deploy = await executeProjectTokenDeploy(asset.id);
      const finalAsset =
        deploy.status === 'DEPLOYED' || deploy.status === 'ALREADY_DEPLOYED' ? deploy.asset : asset;
      return NextResponse.json({ asset: finalAsset, deploy }, { status: 201 });
    }

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
