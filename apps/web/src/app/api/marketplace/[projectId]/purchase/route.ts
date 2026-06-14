import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireMarketplacePurchaseSession } from '../../../../../lib/onboarding/requireInvestorSession';
import {
  assertInvestorCheckoutEligible,
  getUserPurchaseContext,
  purchaseProjectTokens
} from '../../../../../lib/investor/investorService';
import { resolveInvestorLinkedWallet } from '../../../../../lib/investor/linkedWalletPolicy';

type PurchaseBody = {
  tokenCount?: number;
  walletAddress?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const ctx = await requireMarketplacePurchaseSession();

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

    const user = await getUserPurchaseContext(ctx.userId);
    if (!user) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    assertInvestorCheckoutEligible(user);

    const walletAddress = await resolveInvestorLinkedWallet(ctx.userId, body.walletAddress?.trim());

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
      message === 'KYC_NOT_APPROVED' ||
      message === 'INVESTOR_ACCESS_NOT_ENABLED' ||
      message === 'INVESTOR_WALLET_REQUIRED'
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
