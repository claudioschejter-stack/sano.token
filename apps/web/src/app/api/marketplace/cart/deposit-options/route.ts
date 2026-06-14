import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { investorSessionForbiddenResponse, requireMarketplacePurchaseSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { buildDepositPaymentOptions } from '../../../../../lib/payments/depositPaymentOptions';
import { resolveOperationalWalletAddress } from '../../../../../lib/investor/provisionInvestorProfile';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireMarketplacePurchaseSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const amountUsd = Number(params.get('amountUsd'));
  const country = params.get('country') ?? 'AR';
  const fxRate = Number(params.get('fxRate'));

  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { walletAddress: true, investor: { select: { walletAddress: true } } }
  });
  const linkedWalletAddress = user
    ? resolveOperationalWalletAddress(user.walletAddress, user.investor?.walletAddress)
    : null;

  const quote = buildDepositPaymentOptions(
    amountUsd,
    country,
    Number.isFinite(fxRate) && fxRate > 0 ? fxRate : undefined,
    { linkedWalletAddress }
  );

  return NextResponse.json({
    ok: true,
    ...quote
  });
}
