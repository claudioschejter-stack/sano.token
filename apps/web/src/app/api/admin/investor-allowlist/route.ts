import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { getLinkedWalletForUser } from '../../../../lib/investor/linkedWalletPolicy';
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
      remainingGaps: result.remainingGaps
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ALLOWLIST_FAILED';
    console.error('[admin/investor-allowlist]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
