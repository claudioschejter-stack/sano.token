import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider } from 'ethers';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { reconcileMorphoMarkets } from '../../../../lib/lending/reconcileMorphoMarkets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function provider(): JsonRpcProvider {
  return new JsonRpcProvider(
    process.env.LENDING_BASE_RPC_URL?.trim() ||
      process.env.BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
  );
}

/** Admin: what the chain says about every vault's Morpho market, without writing. */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rpc = provider();
  try {
    return NextResponse.json({
      ok: true,
      ...(await reconcileMorphoMarkets({ provider: rpc, dryRun: true }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MORPHO_RECONCILE_FAILED';
    console.error('[admin/morpho-reconcile]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    rpc.destroy();
  }
}

/**
 * Admin: register the market each vault actually belongs to and refresh its
 * liquidity from that market, for every asset in one pass.
 *
 * Body: `{ projectIds?, dryRun? }`
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    projectIds?: string[];
    dryRun?: boolean;
  };

  const rpc = provider();
  try {
    const result = await reconcileMorphoMarkets({
      provider: rpc,
      projectIds: body.projectIds,
      dryRun: body.dryRun === true
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MORPHO_RECONCILE_FAILED';
    console.error('[admin/morpho-reconcile]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    rpc.destroy();
  }
}
