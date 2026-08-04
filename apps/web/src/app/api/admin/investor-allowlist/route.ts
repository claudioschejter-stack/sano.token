import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { JsonRpcProvider, formatEther } from 'ethers';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { getLinkedWalletForUser } from '../../../../lib/investor/linkedWalletPolicy';
import { baseRpcUrls } from '../../../../lib/payments/stablecoinNetworks';
import {
  privyOperatorWalletId,
  privySponsorServerTransactions,
  resolveRwaOperatorAddressEnv
} from '../../../../lib/privy/config';
import { privyApiBase, privyHeaders } from '../../../../lib/privy/privyHttp';
import { resolveChainId } from '../../../../lib/blockchain/explorerUrls';
import {
  ensureInvestorAllowlistForProjects,
  findAllowlistGaps
} from '../../../../lib/payments/ensureInvestorAllowlist';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

async function resolveUserId(input: { userId?: string | null; email?: string | null }) {
  const userId = input.userId?.trim();
  if (userId) return userId;
  const email = input.email?.trim();
  if (!email) return '';
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true }
  });
  return user?.id ?? '';
}

async function readEthBalance(address: string, rpcUrl?: string): Promise<string | null> {
  const urls = rpcUrl ? [rpcUrl] : baseRpcUrls();
  for (const url of urls) {
    // No staticNetwork: a misconfigured RPC must be allowed to reveal its chain.
    const provider = new JsonRpcProvider(url);
    try {
      const balance = formatEther(await provider.getBalance(address));
      provider.destroy();
      return balance;
    } catch {
      provider.destroy();
    }
  }
  return null;
}

/** Chain the configured RPC really serves — mismatches broke signing silently. */
async function readRpcChain(rpcUrl: string): Promise<number | null> {
  const provider = new JsonRpcProvider(rpcUrl);
  try {
    const network = await provider.getNetwork();
    provider.destroy();
    return Number(network.chainId);
  } catch {
    provider.destroy();
    return null;
  }
}

function rpcHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Address Privy will actually broadcast from for `PRIVY_OPERATOR_WALLET_ID`. */
async function readPrivyWalletAddress(walletId: string): Promise<string | null> {
  if (!walletId) return null;
  try {
    const response = await fetch(`${privyApiBase()}/v1/wallets/${walletId}`, {
      headers: privyHeaders(),
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { address?: string };
    return payload.address?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * Privy wallet id that owns a given address, so ops can point
 * `PRIVY_OPERATOR_WALLET_ID` at the wallet that is actually the token owner.
 * Uses the `address` filter, then falls back to paging the app's wallets.
 */
async function findPrivyWalletIdByAddress(address: string): Promise<string | null> {
  const target = address.trim().toLowerCase();

  try {
    const direct = new URL(`${privyApiBase()}/v1/wallets`);
    direct.searchParams.set('address', address.trim());
    const response = await fetch(direct.toString(), {
      headers: privyHeaders(),
      cache: 'no-store'
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        data?: Array<{ id?: string; address?: string }>;
      };
      const match = (payload.data ?? []).find(
        (row) => row.address?.trim().toLowerCase() === target
      );
      if (match?.id) return match.id;
    }
  } catch {
    // fall through to paging
  }

  let cursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const url = new URL(`${privyApiBase()}/v1/wallets`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('chain_type', 'ethereum');
    if (cursor) url.searchParams.set('cursor', cursor);

    try {
      const response = await fetch(url.toString(), {
        headers: privyHeaders(),
        cache: 'no-store'
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        data?: Array<{ id?: string; address?: string }>;
        next_cursor?: string | null;
      };

      const match = (payload.data ?? []).find(
        (row) => row.address?.trim().toLowerCase() === target
      );
      if (match?.id) return match.id;

      cursor = payload.next_cursor ?? null;
      if (!cursor) return null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Whitelisting is signed by the RWA operator server wallet, which pays gas in
 * ETH unless app sponsorship covers it.
 *
 * Privy broadcasts from the wallet behind `PRIVY_OPERATOR_WALLET_ID`, **not**
 * from `RWA_OPERATOR_ADDRESS`. When they differ, a funded `RWA_OPERATOR_ADDRESS`
 * hides an empty broadcasting wallet — hence both balances are reported.
 */
async function operatorStatus() {
  const address = resolveRwaOperatorAddressEnv();
  const walletId = privyOperatorWalletId();
  const walletIdAddress = await readPrivyWalletAddress(walletId);

  const ethBalance = address ? await readEthBalance(address) : null;
  const walletIdEthBalance =
    walletIdAddress && walletIdAddress.toLowerCase() !== address?.toLowerCase()
      ? await readEthBalance(walletIdAddress)
      : ethBalance;

  const addressMatchesWalletId = Boolean(
    address && walletIdAddress && address.toLowerCase() === walletIdAddress.toLowerCase()
  );

  const fundTarget = walletIdAddress ?? address;

  // `setKyc` is broadcast on resolveChainId(); if the configured RPC serves a
  // different chain, balances look healthy while signing fails on an empty chain.
  const signingChainId = resolveChainId();
  const primaryRpc = baseRpcUrls()[0];
  const rpcChainId = primaryRpc ? await readRpcChain(primaryRpc) : null;
  const mainnetBalance = address
    ? await readEthBalance(address, 'https://mainnet.base.org')
    : null;

  return {
    address,
    walletIdConfigured: Boolean(walletId),
    walletIdAddress,
    addressMatchesWalletId,
    ethBalance,
    walletIdEthBalance,
    /** Balance on Base mainnet regardless of the configured RPC. */
    ethBalanceBaseMainnet: mainnetBalance,
    signingChainId,
    rpcChainId,
    rpcHost: rpcHost(primaryRpc),
    chainMismatchWarning:
      rpcChainId != null && rpcChainId !== signingChainId
        ? `Configured RPC (${rpcHost(primaryRpc)}) serves chain ${rpcChainId} but transactions are signed for chain ${signingChainId}. Fix BASE_RPC_URL / TOKEN_DEPLOY_CHAIN_ID.`
        : null,
    gasSponsorshipEnabled: privySponsorServerTransactions(),
    mismatchWarning:
      walletIdAddress && !addressMatchesWalletId
        ? `RWA_OPERATOR_ADDRESS (${address}) is not the wallet Privy broadcasts from (${walletIdAddress}). Set PRIVY_OPERATOR_WALLET_ID to the wallet that owns ${address}.`
        : null,
    /** Wallet id whose address is `RWA_OPERATOR_ADDRESS` — paste into PRIVY_OPERATOR_WALLET_ID. */
    suggestedWalletIdForAddress:
      address && !addressMatchesWalletId ? await findPrivyWalletIdByAddress(address) : null,
    fundGasHint: fundTarget
      ? `Send Base ETH to ${fundTarget} (0.005 ETH covers many setKyc calls) or GET /api/cron/fund-gas?to=${fundTarget}`
      : null
  };
}

async function tokenizedProjectIds(explicit?: string | null): Promise<string[]> {
  if (explicit?.trim()) return [explicit.trim()];
  const projects = await prisma.project.findMany({
    where: { isActive: true, OR: [{ contractAddress: { not: null } }, { vaultAddress: { not: null } }] },
    select: { id: true }
  });
  return projects.map((row) => row.id);
}

/** Admin: which tokenized projects would refuse to credit this investor. */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const userId = await resolveUserId({
    userId: url.searchParams.get('userId'),
    email: url.searchParams.get('email')
  });
  if (!userId) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  const walletAddress = await getLinkedWalletForUser(userId);
  if (!walletAddress) {
    return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
  }

  const projectIds = await tokenizedProjectIds(url.searchParams.get('projectId'));
  const gaps = await findAllowlistGaps({ walletAddress, projectIds });

  return NextResponse.json({
    ok: true,
    userId,
    walletAddress,
    projectsChecked: projectIds.length,
    allowlisted: gaps.length === 0,
    operator: await operatorStatus(),
    gaps
  });
}

/**
 * Admin: whitelist the investor wallet on-chain (KYC) and in the DB so paid
 * purchases can be credited. Idempotent.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    email?: string;
    projectId?: string;
  };

  const userId = await resolveUserId({ userId: body.userId, email: body.email });
  if (!userId) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  const walletAddress = await getLinkedWalletForUser(userId);
  if (!walletAddress) {
    return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
  }

  try {
    const projectIds = await tokenizedProjectIds(body.projectId);
    const result = await ensureInvestorAllowlistForProjects({
      userId,
      walletAddress,
      projectIds
    });

    return NextResponse.json({
      ok: result.remainingGaps.length === 0,
      userId,
      walletAddress,
      attempted: result.attempted,
      // Per-project reason: without it a silent failure looked like a no-op.
      attempts: result.attempts ?? [],
      operator: await operatorStatus(),
      remainingGaps: result.remainingGaps
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ALLOWLIST_FAILED';
    console.error('[admin/investor-allowlist]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
