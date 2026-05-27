import { NextResponse } from 'next/server';
import type { PlatformWithdrawalMethod } from '@sanova/database';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { createPlatformWithdrawal } from '../../../../lib/payments/platformWithdrawalService';

export const dynamic = 'force-dynamic';

type WithdrawBody = {
  amountUsd?: number;
  method?: PlatformWithdrawalMethod;
  destinationAddress?: string;
  stablecoinNetwork?: string;
};

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as WithdrawBody;
    const method = body.method === 'FIAT' ? 'FIAT' : 'STABLECOIN';
    const withdrawal = await createPlatformWithdrawal({
      userId: ctx.userId,
      amountUsd: Number(body.amountUsd),
      method,
      destinationAddress: body.destinationAddress,
      stablecoinNetwork: body.stablecoinNetwork
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
      message === 'INSUFFICIENT_PLATFORM_BALANCE'
        ? 400
        : 500;

    console.error('[wallet/withdraw-intents]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
