import { NextResponse } from 'next/server';
import type { PlatformWithdrawalMethod } from '@sanova/database';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { createPlatformWithdrawal } from '../../../../lib/payments/platformWithdrawalService';

export const dynamic = 'force-dynamic';

type WithdrawBody = {
  amountUsd?: number;
  method?: PlatformWithdrawalMethod;
  destinationAddress?: string;
  stablecoinNetwork?: string;
  payoutDetails?: unknown;
};

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const body = (await request.json()) as WithdrawBody;
    const method = body.method === 'FIAT' ? 'FIAT' : 'STABLECOIN';
    const withdrawal = await createPlatformWithdrawal({
      userId: ctx.userId,
      amountUsd: Number(body.amountUsd),
      method,
      destinationAddress: body.destinationAddress,
      stablecoinNetwork: body.stablecoinNetwork,
      payoutDetails: body.payoutDetails
    });

    return NextResponse.json({ ok: true, withdrawal }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      message === 'USER_NOT_FOUND' ||
      message === 'ACCOUNT_NOT_OPERATIONAL' ||
      message === 'KYC_NOT_APPROVED' ||
      message === 'INVALID_WITHDRAWAL_AMOUNT' ||
      message === 'DESTINATION_ADDRESS_REQUIRED' ||
      message === 'PAYOUT_DETAILS_INCOMPLETE' ||
      message === 'WALLET_NOT_LINKED_TO_ACCOUNT' ||
      message === 'INVALID_WALLET' ||
      message === 'INSUFFICIENT_PLATFORM_BALANCE'
        ? 400
        : 500;

    console.error('[wallet/withdraw-intents]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
