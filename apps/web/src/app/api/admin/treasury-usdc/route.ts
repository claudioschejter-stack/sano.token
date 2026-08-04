import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider } from 'ethers';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  readTreasuryUsdcBalance,
  transferTreasuryUsdc
} from '../../../../lib/blockchain/treasuryUsdcTransfer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function provider(): JsonRpcProvider {
  return new JsonRpcProvider(
    process.env.BASE_RPC_URL?.trim() ||
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
  );
}

/** Admin: how much USDC the treasury Safe holds. */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rpc = provider();
  try {
    return NextResponse.json({ ok: true, ...(await readTreasuryUsdcBalance(rpc)) });
  } finally {
    rpc.destroy();
  }
}

/**
 * Admin: send USDC out of the treasury Safe — refunds and test funding.
 *
 * Both owners of the governance Safe are server or hardware wallets, so this is
 * the only path out; there is no browser flow for it.
 *
 * Body: `{ to, amountUsdc }`
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    amountUsdc?: number;
  };

  if (!body.to?.trim()) {
    return NextResponse.json({ error: 'TO_REQUIRED' }, { status: 400 });
  }
  if (typeof body.amountUsdc !== 'number') {
    return NextResponse.json({ error: 'AMOUNT_USDC_REQUIRED' }, { status: 400 });
  }

  const rpc = provider();
  try {
    const result = await transferTreasuryUsdc({
      provider: rpc,
      to: body.to.trim(),
      amountUsdc: body.amountUsdc
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TREASURY_USDC_TRANSFER_FAILED';
    console.error('[admin/treasury-usdc]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    rpc.destroy();
  }
}
