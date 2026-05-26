import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { verifyPlatformStablecoinDeposit } from '../../../../../lib/payments/platformWalletService';

export const dynamic = 'force-dynamic';

type VerifyBody = {
  depositId?: string;
  txHash?: string;
  walletAddress?: string;
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
    const body = (await request.json()) as VerifyBody;
    if (!body.depositId || !body.txHash) {
      return NextResponse.json({ error: 'DEPOSIT_AND_TX_REQUIRED' }, { status: 400 });
    }
    const deposit = await verifyPlatformStablecoinDeposit({
      depositId: body.depositId,
      txHash: body.txHash,
      expectedPayer: body.walletAddress
    });
    return NextResponse.json({ ok: true, deposit });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (
      [
        'DEPOSIT_NOT_FOUND',
        'INVALID_DEPOSIT_METHOD',
        'STABLECOIN_DEPOSIT_NOT_CONFIGURED',
        'TX_NOT_CONFIRMED',
        'TX_CONFIRMATIONS_PENDING',
        'STABLECOIN_TRANSFER_NOT_FOUND'
      ].includes(message)
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[wallet/deposit-intents/verify]', error);
    return NextResponse.json({ error: 'DEPOSIT_VERIFY_FAILED' }, { status: 500 });
  }
}
