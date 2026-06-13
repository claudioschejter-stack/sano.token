import { NextResponse } from 'next/server';
import { getAdminAsset, updateAdminAsset, deleteAdminAsset, type UpdateAdminAssetInput } from '../../../../../lib/admin/assetsService';
import {
  finalizeErc4626AfterPersist,
  isLaunchCardPartialUpdate,
  sanitizeErc4626UpdateBody,
  validateErc4626BeforePersist
} from '../../../../../lib/admin/erc4626LaunchSave';
import {
  isErc4626OnChainReady,
  isErc4626Standard,
  needsErc4626Deploy
} from '../../../../../lib/admin/erc4626LaunchGate';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { syncProjectAssetsFromStorage } from '../../../../../lib/storage/syncLaunchStorage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;

  try {
    await syncProjectAssetsFromStorage(projectId);
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
  const session = await requireAdminSession();
  if (!session) {
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
    const existing = await getAdminAsset(projectId);
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const standard = body.tokenStandard ?? existing.tokenStandard;
    const wantsPublish = body.isActive === true;
    const wantsOnChainDeploy =
      body.deployToken === true ||
      (isErc4626Standard(standard) && wantsPublish && needsErc4626Deploy(existing));
    const partialCardUpdate = isLaunchCardPartialUpdate(body);
    const sanitized = partialCardUpdate ? body : sanitizeErc4626UpdateBody(body, existing);

    if (isErc4626Standard(standard) && wantsOnChainDeploy && !partialCardUpdate) {
      sanitized.deployToken = true;
      sanitized.isActive = false;
    }

    if (!partialCardUpdate) {
      const gateIssues = await validateErc4626BeforePersist(sanitized, existing, {
        requireOnChain: wantsOnChainDeploy || wantsPublish
      });
      if (gateIssues.length) {
        return NextResponse.json({ error: 'LAUNCH_NOT_READY', issues: gateIssues }, { status: 422 });
      }
    }

    const updated = await updateAdminAsset(projectId, sanitized);

    if (!updated) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (partialCardUpdate || (isErc4626Standard(standard) && !wantsOnChainDeploy)) {
      if (wantsPublish && isErc4626Standard(standard) && !isErc4626OnChainReady(updated)) {
        await updateAdminAsset(projectId, { isActive: false });
        return NextResponse.json(
          {
            error: 'LAUNCH_NOT_READY',
            issues: [{ code: 'CANNOT_PUBLISH_INCOMPLETE' }],
            asset: await getAdminAsset(projectId)
          },
          { status: 422 }
        );
      }

      return NextResponse.json({ asset: updated });
    }

    if (isErc4626Standard(standard)) {
      const finalized = await finalizeErc4626AfterPersist(projectId, { requestedPublish: wantsPublish });
      if (finalized.ok === false) {
        const current = await getAdminAsset(projectId);
        return NextResponse.json(
          { error: 'LAUNCH_NOT_READY', issues: finalized.issues, asset: current },
          { status: 422 }
        );
      }

      if (finalized.async) {
        return NextResponse.json(
          {
            asset: finalized.asset,
            async: true,
            jobIds: finalized.jobIds ?? [],
            message: 'Deploy ERC-4626 encolado. El estado se actualizará automáticamente.'
          },
          { status: 202 }
        );
      }

      return NextResponse.json({ asset: finalized.asset, deploy: finalized.deploy });
    }

    const shouldDeployOrRepair =
      sanitized.deployToken &&
      (!updated.contractAddress || (isErc4626Standard(updated.tokenStandard) && !updated.vaultAddress));

    if (shouldDeployOrRepair) {
      const { executeProjectTokenDeploy } = await import('../../../../../lib/blockchain/projectTokenDeploy');
      const deploy = await executeProjectTokenDeploy(projectId, { adminAuthorized: true });
      const finalAsset =
        deploy.status === 'DEPLOYED' || deploy.status === 'ALREADY_DEPLOYED' ? deploy.asset : updated;
      return NextResponse.json({ asset: finalAsset, deploy });
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

export async function DELETE(_request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;

  try {
    const result = await deleteAdminAsset(projectId);
    if (result.ok === false) {
      if (result.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Asset not found', code: result.code }, { status: 404 });
      }
      return NextResponse.json({ error: 'Cannot delete asset', code: result.code }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/assets/delete]', error);
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
  }
}
