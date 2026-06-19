import { NextResponse } from 'next/server';
import { isAddress, JsonRpcProvider } from 'ethers';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';
import { resolveMorphoLiquiditySigner } from '../../../../lib/blockchain/morphoLiquiditySigner';
import { getLendingChainConfig } from '../../../../lib/lending/baseContracts';

export const maxDuration = 60;

const DEFAULT_TOPUP_WEI = 5_000_000_000_000_000n; // 0.005 ETH

/** Cron — send Base ETH from Morpho Privy wallet to fund gas for Safe ops. */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get('to')?.trim();
  if (!to || !isAddress(to)) {
    return NextResponse.json({ error: 'Missing or invalid ?to=0x address' }, { status: 400 });
  }

  const amountParam = url.searchParams.get('amountEth')?.trim();
  const value =
    amountParam && Number(amountParam) > 0
      ? BigInt(Math.floor(Number(amountParam) * 1e18))
      : DEFAULT_TOPUP_WEI;

  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';
  const chainId = getLendingChainConfig().chainId;
  const provider = new JsonRpcProvider(rpc);

  try {
    const signer = await resolveMorphoLiquiditySigner(provider, chainId);
    if (!signer) {
      return NextResponse.json({ error: 'Morpho Privy signer not configured' }, { status: 503 });
    }

    const from = await signer.getAddress();
    const balance = await provider.getBalance(from);
    if (balance <= value) {
      return NextResponse.json(
        { error: 'INSUFFICIENT_MORPHO_ETH', from, balance: balance.toString() },
        { status: 503 }
      );
    }

    const tx = await signer.sendTransaction({ to, value });
    const receipt = await tx.wait();

    return NextResponse.json({
      ok: true,
      from,
      to,
      valueWei: value.toString(),
      txHash: receipt?.hash ?? tx.hash
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FUND_GAS_FAILED';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    provider.destroy();
  }
}

export async function POST(request: Request) {
  return GET(request);
}
