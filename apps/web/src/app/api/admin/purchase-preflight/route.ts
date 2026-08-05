import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'ethers';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { purchasePreflight } from '../../../../lib/payments/purchasePreflight';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Admin: every condition a purchase needs, before charging anybody.
 *
 * Query: `?email=` or `?walletAddress=`, optional `projectId` and `tokenCount`.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email')?.trim();
  const walletParam = url.searchParams.get('walletAddress')?.trim();
  const projectId = url.searchParams.get('projectId')?.trim();
  const tokenCount = Number(url.searchParams.get('tokenCount') ?? 1) || 1;

  let wallet = walletParam && isAddress(walletParam) ? walletParam : null;
  if (!wallet && email) {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: { walletAddress: true }
    });
    wallet = user?.walletAddress && isAddress(user.walletAddress) ? user.walletAddress : null;
  }

  if (!wallet) {
    return NextResponse.json({ error: 'INVESTOR_WALLET_NOT_FOUND' }, { status: 400 });
  }

  const projects = await prisma.project.findMany({
    where: {
      vaultAddress: { not: null },
      ...(projectId ? { id: projectId } : {})
    },
    select: { id: true }
  });

  try {
    const reports = [];
    for (const project of projects) {
      reports.push(
        await purchasePreflight({ projectId: project.id, investorWallet: wallet, tokenCount })
      );
    }

    return NextResponse.json({
      ok: true,
      investorWallet: wallet,
      ready: reports.filter((row) => 'canPurchase' in row && row.canPurchase).length,
      total: reports.length,
      projects: reports
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PREFLIGHT_FAILED';
    console.error('[admin/purchase-preflight]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
