import { NextResponse } from 'next/server';
import { getAdminAsset } from '../../../../lib/admin/assetsService';
import { resolveInvestorLinkedWallet } from '../../../../lib/investor/linkedWalletPolicy';
import { computeMorphoHealthFactor } from '../../../../lib/lending/morphoHealthFactor';
import { resolvePreferredMorphoVault, isSteakhouseVault } from '../../../../lib/lending/steakhouseVaults';
import {
  investorSessionForbiddenResponse,
  requireMorphoBorrowSession
} from '../../../../lib/onboarding/requireInvestorSession';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireMorphoBorrowSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId')?.trim();
  const walletParam = searchParams.get('walletAddress')?.trim();

  if (!projectId) {
    return NextResponse.json({ error: 'PROJECT_ID_REQUIRED' }, { status: 400 });
  }

  try {
    const asset = await getAdminAsset(projectId);
    if (!asset?.vaultAddress) {
      return NextResponse.json({ error: 'VAULT_NOT_FOUND' }, { status: 404 });
    }

    const linkedWallet = walletParam
      ? await resolveInvestorLinkedWallet(ctx.userId, walletParam)
      : null;

    if (!linkedWallet) {
      return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
    }

    const preferredVault = resolvePreferredMorphoVault(asset.vaultAddress);
    const morphoTarget = asset.collateralTargets.find((t) => t.protocol === 'MORPHO');

    const health = await computeMorphoHealthFactor({
      walletAddress: linkedWallet,
      vaultAddress: preferredVault ?? asset.vaultAddress,
      oracleAddress: morphoTarget?.oracleAddress
    });

    return NextResponse.json({
      health,
      vaultAddress: preferredVault ?? asset.vaultAddress,
      steakhouse: isSteakhouseVault(preferredVault),
      projectId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    console.error('[lending/health-factor]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
