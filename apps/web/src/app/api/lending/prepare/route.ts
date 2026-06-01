import { NextResponse } from 'next/server';
import { resolveInvestorLinkedWallet } from '../../../../lib/investor/linkedWalletPolicy';
import { prepareBorrow } from '../../../../lib/lending/borrowRouter';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';

export const dynamic = 'force-dynamic';

const WALLET_ERRORS = new Set([
  'WALLET_MISMATCH',
  'WALLET_REQUIRED',
  'INVESTOR_WALLET_REQUIRED',
  'INVALID_WALLET'
]);

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      amountUsd?: number;
      collateralEth?: number;
      walletAddress?: string;
      projectId?: string;
      vaultAddress?: string;
      preferProtocol?: string;
    };

    if (!body.walletAddress?.trim()) {
      return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
    }

    const linkedWallet = await resolveInvestorLinkedWallet(ctx.userId, body.walletAddress.trim());

    const prepared = await prepareBorrow({
      amountUsd: Number(body.amountUsd),
      collateralEth: body.collateralEth != null ? Number(body.collateralEth) : undefined,
      walletAddress: linkedWallet,
      projectId: body.projectId,
      vaultAddress: body.vaultAddress,
      preferProtocol: body.preferProtocol
    });

    if (!prepared) {
      return NextResponse.json(
        { error: 'Unable to prepare borrow transaction. Check protocol, collateral, and Morpho oracle config.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ prepared });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (WALLET_ERRORS.has(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[lending/prepare]', error);
    return NextResponse.json({ error: 'Prepare failed' }, { status: 500 });
  }
}
