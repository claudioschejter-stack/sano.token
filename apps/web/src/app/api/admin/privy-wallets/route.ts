import { NextRequest, NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, formatEther } from 'ethers';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { privyOperatorWalletId, resolveRwaOperatorAddressEnv } from '../../../../lib/privy/config';
import { privyApiBase, privyHeaders } from '../../../../lib/privy/privyHttp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const BASE_MAINNET_RPC = 'https://mainnet.base.org';

type PrivyWalletRow = {
  id?: string;
  address?: string;
  chain_type?: string;
  created_at?: number;
};

async function listPrivyWallets(limit: number): Promise<PrivyWalletRow[]> {
  const rows: PrivyWalletRow[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 10 && rows.length < limit; page += 1) {
    const url = new URL(`${privyApiBase()}/v1/wallets`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('chain_type', 'ethereum');
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url.toString(), {
      headers: privyHeaders(),
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`PRIVY_WALLET_LIST_FAILED:${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: PrivyWalletRow[];
      next_cursor?: string | null;
    };
    rows.push(...(payload.data ?? []));
    cursor = payload.next_cursor ?? null;
    if (!cursor) break;
  }

  return rows.slice(0, limit);
}

/**
 * Admin: the app's Privy ethereum wallets with their Base mainnet ETH balance,
 * flagged against the RWA operator env and each project's token `owner()`.
 *
 * Needed because only the token owner can call `setKyc`, and
 * `PRIVY_OPERATOR_WALLET_ID` pointed at a wallet that is neither owner nor funded.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 200);
  const withBalances = url.searchParams.get('balances') !== '0';

  try {
    const wallets = await listPrivyWallets(limit);
    const operatorAddress = resolveRwaOperatorAddressEnv()?.trim().toLowerCase() ?? null;
    const configuredWalletId = privyOperatorWalletId();

    const projects = await prisma.project.findMany({
      where: { contractAddress: { not: null }, isActive: true },
      select: { id: true, title: true, contractAddress: true }
    });

    const provider = new JsonRpcProvider(BASE_MAINNET_RPC);
    const tokenOwners: Array<{ projectId: string; title: string; token: string; owner: string | null }> = [];
    try {
      for (const project of projects) {
        if (!project.contractAddress) continue;
        let owner: string | null = null;
        try {
          const token = new Contract(
            project.contractAddress,
            ['function owner() view returns (address)'],
            provider
          );
          owner = ((await token.owner()) as string).toLowerCase();
        } catch {
          owner = null;
        }
        tokenOwners.push({
          projectId: project.id,
          title: project.title,
          token: project.contractAddress,
          owner
        });
      }

      const ownerSet = new Set(tokenOwners.map((row) => row.owner).filter(Boolean) as string[]);

      const rows = [];
      for (const wallet of wallets) {
        const address = wallet.address?.trim() ?? '';
        const key = address.toLowerCase();
        let ethBalance: string | null = null;
        if (withBalances && address) {
          try {
            ethBalance = formatEther(await provider.getBalance(address));
          } catch {
            ethBalance = null;
          }
        }
        rows.push({
          walletId: wallet.id ?? null,
          address,
          ethBalanceBaseMainnet: ethBalance,
          isConfiguredOperator: wallet.id === configuredWalletId,
          matchesOperatorEnvAddress: Boolean(operatorAddress && key === operatorAddress),
          isTokenOwner: ownerSet.has(key),
          createdAt: wallet.created_at ?? null
        });
      }

      const ownerWallet = rows.find((row) => row.isTokenOwner);

      return NextResponse.json({
        ok: true,
        configuredWalletId,
        operatorEnvAddress: operatorAddress,
        tokenOwners,
        walletCount: rows.length,
        /** Paste into PRIVY_OPERATOR_WALLET_ID when present. */
        recommendedOperatorWalletId: ownerWallet?.walletId ?? null,
        recommendation: ownerWallet
          ? `Set PRIVY_OPERATOR_WALLET_ID=${ownerWallet.walletId} (address ${ownerWallet.address}) and RWA_OPERATOR_ADDRESS=${ownerWallet.address}.`
          : 'No Privy wallet matches any token owner(). The owner key is outside Privy: transfer token ownership to one of these wallets (transferOwnership) to whitelist from the server.',
        wallets: rows
      });
    } finally {
      provider.destroy();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PRIVY_WALLETS_FAILED';
    console.error('[admin/privy-wallets]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
