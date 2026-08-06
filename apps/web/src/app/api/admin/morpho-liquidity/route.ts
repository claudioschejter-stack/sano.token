import { NextRequest, NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { getLendingChainConfig } from '../../../../lib/lending/baseContracts';
import { resolveMorphoLiquidityAddress } from '../../../../lib/blockchain/morphoLiquiditySigner';
import { readWithRetry } from '../../../../lib/blockchain/rpcRetry';
import { withdrawMorphoLiquidity } from '../../../../lib/lending/withdrawMorphoLiquidity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const MORPHO_ABI = [
  'function idToMarketParams(bytes32) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)',
  'function market(bytes32) view returns (uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint128 lastUpdate,uint128 fee)',
  'function position(bytes32,address) view returns (uint256 supplyShares,uint128 borrowShares,uint128 collateral)'
];

function rpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

/** Every Morpho market the platform registered, with what the chain says is in it. */
async function marketsFromProjects() {
  const projects = await prisma.project.findMany({
    where: { vaultAddress: { not: null } },
    select: { id: true, title: true, vaultAddress: true, collateralTargets: true }
  });

  const rows: Array<{
    projectId: string;
    projectTitle: string;
    vaultAddress: string | null;
    marketId: string;
  }> = [];

  for (const project of projects) {
    const targets = Array.isArray(project.collateralTargets)
      ? (project.collateralTargets as Array<Record<string, unknown>>)
      : [];
    for (const target of targets) {
      const marketId = typeof target.externalId === 'string' ? target.externalId.trim() : '';
      if (target.protocol === 'MORPHO' && /^0x[0-9a-fA-F]{64}$/.test(marketId)) {
        rows.push({
          projectId: project.id,
          projectTitle: project.title,
          vaultAddress: project.vaultAddress,
          marketId
        });
      }
    }
  }
  return rows;
}

/**
 * Admin: how much of the platform's USDC is sitting in each Morpho market, and
 * whether that market's collateral is still the project's current vault.
 * `GET /api/admin/morpho-liquidity`
 */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { morpho } = getLendingChainConfig();
  const supplier = resolveMorphoLiquidityAddress();
  const provider = new JsonRpcProvider(rpcUrl());

  try {
    const reader = new Contract(morpho, MORPHO_ABI, provider);
    const markets = [];

    for (const row of await marketsFromProjects()) {
      const params = await readWithRetry(
        () => reader.idToMarketParams(row.marketId) as Promise<unknown[]>
      );
      const state = await readWithRetry(() => reader.market(row.marketId) as Promise<bigint[]>);
      const position = supplier
        ? await readWithRetry(
            () => reader.position(row.marketId, supplier) as Promise<bigint[]>
          )
        : null;

      const collateral = params ? String(params[1]) : null;
      markets.push({
        ...row,
        collateralToken: collateral,
        oracle: params ? String(params[2]) : null,
        /**
         * A market whose collateral is not the project's current vault can never
         * be used again: nobody holds that collateral any more.
         */
        collateralMatchesVault:
          collateral && row.vaultAddress
            ? collateral.toLowerCase() === row.vaultAddress.toLowerCase()
            : null,
        suppliedUsdc: state ? formatUnits(state[0], 6) : null,
        borrowedUsdc: state ? formatUnits(state[2], 6) : null,
        ourSupplyShares: position ? position[0].toString() : null
      });
    }

    return NextResponse.json({ ok: true, supplier, markets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'READ_FAILED';
    console.error('[admin/morpho-liquidity] GET', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    provider.destroy();
  }
}

/**
 * Admin: take supplied USDC back out of a market.
 * Body: `{ marketId, amountUsdc?, receiver? }` — omit the amount to withdraw it all.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    marketId?: string;
    amountUsdc?: number;
    receiver?: string;
  };

  if (!body.marketId?.trim()) {
    return NextResponse.json({ error: 'MARKET_ID_REQUIRED' }, { status: 400 });
  }

  try {
    const result = await withdrawMorphoLiquidity({
      marketId: body.marketId.trim(),
      amountUsdc: body.amountUsdc,
      receiver: body.receiver
    });

    // Spell out the one case whose numbers look like a failure and are not.
    const note =
      result.ok && !result.confirmed
        ? `La transacción ${result.txHash} salió bien pero las lecturas no llegaron a reflejarla. Verificá el balance en un minuto; no la repitas.`
        : undefined;

    return NextResponse.json({ ok: result.ok, result, note }, { status: result.ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WITHDRAW_FAILED';
    console.error('[admin/morpho-liquidity] POST', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
