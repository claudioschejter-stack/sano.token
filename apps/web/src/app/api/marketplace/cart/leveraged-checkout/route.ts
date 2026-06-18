import { NextResponse } from 'next/server';
import { prepareBorrow } from '../../../../../lib/lending/borrowRouter';
import { resolveInvestorLinkedWallet } from '../../../../../lib/investor/linkedWalletPolicy';
import { resolvePreferredMorphoVault } from '../../../../../lib/lending/steakhouseVaults';
import { getAdminAsset } from '../../../../../lib/admin/assetsService';
import { assertInvestorCheckoutEligible, getUserPurchaseContext } from '../../../../../lib/investor/investorService';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../../lib/onboarding/requireInvestorSession';

export const dynamic = 'force-dynamic';

/**
 * Prepare chained txs: Morpho borrow USDC → treasury payment → RWA share delivery.
 * Client signs once via Privy embedded wallet when gas-sponsored.
 */
export async function POST(request: Request) {
  const ctx = await requireInvestorSession({ allowedRoles: new Set(['INVESTOR']) });

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const user = await getUserPurchaseContext(ctx.userId);
    if (!user) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }
    assertInvestorCheckoutEligible(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FORBIDDEN';
    return NextResponse.json({ error: message }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      projectId?: string;
      amountUsd?: number;
      walletAddress?: string;
      cartBatchId?: string;
    };

    if (!body.projectId?.trim() || !body.walletAddress?.trim()) {
      return NextResponse.json({ error: 'PROJECT_AND_WALLET_REQUIRED' }, { status: 400 });
    }

    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
    }

    const linkedWallet = await resolveInvestorLinkedWallet(ctx.userId, body.walletAddress.trim());
    const asset = await getAdminAsset(body.projectId.trim());

    if (!asset?.vaultAddress) {
      return NextResponse.json({ error: 'VAULT_NOT_FOUND' }, { status: 404 });
    }

    const vaultAddress = resolvePreferredMorphoVault(asset.vaultAddress) ?? asset.vaultAddress;

    const prepared = await prepareBorrow({
      amountUsd,
      walletAddress: linkedWallet,
      projectId: body.projectId.trim(),
      vaultAddress
    });

    if (!prepared) {
      return NextResponse.json({ error: 'BORROW_PREPARE_FAILED' }, { status: 404 });
    }

    return NextResponse.json({
      mode: 'leveraged_purchase',
      steps: ['morpho_borrow_usdc', 'pay_treasury', 'deliver_shares'],
      cartBatchId: body.cartBatchId ?? null,
      amountUsd,
      vaultAddress,
      prepared
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    console.error('[cart/leveraged-checkout]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
