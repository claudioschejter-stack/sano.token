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

async function readEthBalance(address: string): Promise<string | null> {
  for (const url of baseRpcUrls()) {
    const provider = new JsonRpcProvider(url, 8453, { staticNetwork: true });
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

  return {
    address,
    walletIdConfigured: Boolean(walletId),
    walletIdAddress,
    addressMatchesWalletId,
    ethBalance,
    walletIdEthBalance,
    gasSponsorshipEnabled: privySponsorServerTransactions(),
    mismatchWarning:
      walletIdAddress && !addressMatchesWalletId
        ? `RWA_OPERATOR_ADDRESS (${address}) is not the wallet Privy broadcasts from (${walletIdAddress}). Fund ${walletIdAddress} or point RWA_OPERATOR_ADDRESS at it.`
        : null,
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
