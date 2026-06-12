import { NextResponse } from 'next/server';
import { resolveInvestorLinkedWallet } from '../../../../lib/investor/linkedWalletPolicy';
import { previewMorphoBorrowForProject } from '../../../../lib/lending/borrowRouter';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';

export const dynamic = 'force-dynamic';

const WALLET_ERRORS = new Set([
  'WALLET_MISMATCH',
  'WALLET_REQUIRED',
  'INVESTOR_WALLET_REQUIRED',
  'INVALID_WALLET'
]);

export async function POST(request: Request) {
  const ctx = await requireInvestorSession({ operational: true });

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const body = (await request.json()) as {
      projectId?: string;
      walletAddress?: string;
      amountUsd?: number;
    };

    if (!body.projectId?.trim() || !body.walletAddress?.trim()) {
      return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
    }

    const linkedWallet = await resolveInvestorLinkedWallet(ctx.userId, body.walletAddress.trim());

    const preview = await previewMorphoBorrowForProject({
      projectId: body.projectId.trim(),
      walletAddress: linkedWallet,
      amountUsd: body.amountUsd != null ? Number(body.amountUsd) : undefined
    });

    if (!preview) {
      return NextResponse.json({ error: 'Morpho borrow preview unavailable' }, { status: 404 });
    }

    return NextResponse.json({ preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (WALLET_ERRORS.has(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[lending/borrow-preview]', error);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
