import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider, isAddress } from 'ethers';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { readKycTimelock, scheduleTokenKyc } from '../../../../lib/blockchain/scheduleTokenKyc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

function provider(): JsonRpcProvider {
  return new JsonRpcProvider(
    process.env.BASE_RPC_URL?.trim() ||
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
  );
}

async function resolveInvestorWallet(input: {
  email?: string;
  walletAddress?: string;
}): Promise<string | null> {
  if (input.walletAddress && isAddress(input.walletAddress)) {
    return input.walletAddress;
  }
  if (!input.email) return null;

  const user = await prisma.user.findFirst({
    where: { email: input.email.trim().toLowerCase() },
    select: { walletAddress: true }
  });
  return user?.walletAddress && isAddress(user.walletAddress) ? user.walletAddress : null;
}

async function tokenizedProjects(projectIds?: string[]) {
  return prisma.project.findMany({
    where: {
      contractAddress: { not: null },
      ...(projectIds?.length ? { id: { in: projectIds } } : {})
    },
    select: { id: true, title: true, contractAddress: true }
  });
}

/**
 * Admin: where each token's KYC timelock stands for one investor.
 *
 * `setKyc` is timelocked, so allowlisting is schedule-then-wait-then-approve.
 * Without this the only symptom was `SANOVA: KYC timelock pending`.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const wallet = await resolveInvestorWallet({
    email: url.searchParams.get('email') ?? undefined,
    walletAddress: url.searchParams.get('walletAddress') ?? undefined
  });

  if (!wallet) {
    return NextResponse.json({ error: 'INVESTOR_WALLET_NOT_FOUND' }, { status: 400 });
  }

  const rpc = provider();
  try {
    const projects = await tokenizedProjects();
    const rows = [];
    for (const project of projects) {
      const state = await readKycTimelock({
        provider: rpc,
        tokenAddress: project.contractAddress!,
        investorAddress: wallet
      });
      rows.push({
        projectId: project.id,
        title: project.title,
        token: project.contractAddress,
        ...(state ?? { readyAt: null, ready: false, alreadyApproved: false }),
        readyAtIso: state?.readyAt ? new Date(state.readyAt * 1000).toISOString() : null
      });
    }
    return NextResponse.json({ ok: true, walletAddress: wallet, projects: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'KYC_TIMELOCK_READ_FAILED';
    console.error('[admin/kyc-timelock]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    rpc.destroy();
  }
}

/**
 * Admin: start the timelock for an investor on every tokenized project.
 *
 * Body: `{ email? , walletAddress?, projectIds? }`
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    walletAddress?: string;
    projectIds?: string[];
  };

  const wallet = await resolveInvestorWallet(body);
  if (!wallet) {
    return NextResponse.json({ error: 'INVESTOR_WALLET_NOT_FOUND' }, { status: 400 });
  }

  const rpc = provider();
  try {
    const projects = await tokenizedProjects(body.projectIds);
    const results = [];
    for (const project of projects) {
      const result = await scheduleTokenKyc({
        provider: rpc,
        tokenAddress: project.contractAddress!,
        investorAddress: wallet
      }).catch((error) => ({
        ok: false as const,
        code: 'SCHEDULE_FAILED',
        detail: error instanceof Error ? error.message.slice(0, 200) : undefined
      }));

      results.push({
        projectId: project.id,
        title: project.title,
        ...result,
        readyAtIso:
          'readyAt' in result && result.readyAt
            ? new Date(result.readyAt * 1000).toISOString()
            : null
      });
    }

    return NextResponse.json({ ok: true, walletAddress: wallet, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'KYC_TIMELOCK_SCHEDULE_FAILED';
    console.error('[admin/kyc-timelock]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    rpc.destroy();
  }
}
