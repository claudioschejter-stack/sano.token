import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import {
  getUserPurchaseContext,
  purchaseProjectTokens
} from '../../../../../lib/investor/investorService';

type PurchaseBody = {
  tokenCount?: number;
  walletAddress?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const { projectId } = await context.params;

  try {
    const body = (await request.json()) as PurchaseBody;
    const tokenCount = Number(body.tokenCount);
    const walletAddress = body.walletAddress?.trim();

    if (!walletAddress) {
      return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
    }

    const user = await getUserPurchaseContext(ctx.userId);
    if (!user) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const result = await purchaseProjectTokens({
      userId: ctx.userId,
      projectId,
      tokenCount,
      walletAddress
    });

    return NextResponse.json({ ok: true, purchase: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (
      message === 'ACCOUNT_NOT_OPERATIONAL' ||
      message === 'KYC_NOT_APPROVED'
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (
      message === 'INVALID_TOKEN_COUNT' ||
      message === 'INSUFFICIENT_SUPPLY' ||
      message === 'PROJECT_NOT_AVAILABLE'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[marketplace/purchase]', error);
    return NextResponse.json({ error: 'PURCHASE_FAILED' }, { status: 500 });
  }
}
