import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../lib/onboarding/requireInvestorSession';
import { requestPrivyUsdcWithdrawal } from '../../../../lib/payments/requestPrivyUsdcWithdrawal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Quotes the fee against the network before answering. */
export const maxDuration = 60;

/** Codes the investor can act on, as opposed to something being broken. */
const CLIENT_ERRORS = new Set([
  'USER_NOT_FOUND',
  'KYC_NOT_APPROVED',
  'SANOVA_WALLET_NOT_FOUND',
  'WALLET_NOT_LINKED_TO_ACCOUNT',
  'DESTINATION_ADDRESS_REQUIRED',
  'DESTINATION_IS_SANOVA_WALLET',
  'INVALID_WITHDRAWAL_AMOUNT',
  'AMOUNT_ABOVE_WITHDRAWABLE',
  'INSUFFICIENT_USDC_FOR_GAS',
  'WITHDRAWAL_ALREADY_PENDING'
]);

/**
 * Investor: request a withdrawal of your own USDC.
 * Body: `{ amountUsdc?, destinationAddress? }` — omit the amount to request it all.
 *
 * Queues it for an admin to authorise. Nothing moves on-chain here.
 */
export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const body = (await request.json().catch(() => ({}))) as {
    amountUsdc?: number;
    destinationAddress?: string;
  };

  try {
    const result = await requestPrivyUsdcWithdrawal({
      userId: ctx.userId,
      amountUsdc: typeof body.amountUsdc === 'number' ? body.amountUsdc : undefined,
      destinationAddress: body.destinationAddress
    });

    if (result.ok === false) {
      return NextResponse.json(
        { ok: false, error: result.code, detail: result.detail },
        { status: CLIENT_ERRORS.has(result.code) ? 400 : 502 }
      );
    }

    return NextResponse.json({ ok: true, withdrawal: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WITHDRAWAL_FAILED';
    console.error('[wallet/privy-usdc-withdrawals]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
