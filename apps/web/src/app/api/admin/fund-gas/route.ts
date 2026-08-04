import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider } from 'ethers';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  fundGasFromPlatformWallet,
  listGasSources,
  type GasSourceRole
} from '../../../../lib/blockchain/fundGasFromPlatformWallet';

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

/** Admin: how much ETH each platform wallet could spare for a top-up. */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rpc = provider();
  try {
    return NextResponse.json({ ok: true, sources: await listGasSources(rpc) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GAS_SOURCES_FAILED';
    console.error('[admin/fund-gas]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    rpc.destroy();
  }
}

/**
 * Admin: send Base ETH from a platform wallet to any address that needs gas.
 *
 * Body: `{ to, amountEth?, from? }` where `from` is a role
 * (`rwa_operator` | `safe_owner` | `morpho_liquidity`); omit it to use the
 * wallet that can spare the most.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    amountEth?: number;
    from?: GasSourceRole;
    force?: boolean;
  };

  if (!body.to?.trim()) {
    return NextResponse.json({ error: 'TO_REQUIRED' }, { status: 400 });
  }

  const rpc = provider();
  try {
    const result = await fundGasFromPlatformWallet({
      provider: rpc,
      to: body.to.trim(),
      amountEth: body.amountEth ?? 0.003,
      from: body.from,
      force: body.force === true
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FUND_GAS_FAILED';
    console.error('[admin/fund-gas]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    rpc.destroy();
  }
}
