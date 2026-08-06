import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { getBridgeApiKey } from '../../../../lib/payments/bridgeClient';
import { ensureBridgeOnboarding } from '../../../../lib/payments/bridgeCustomerService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Admin: where every already-verified investor stands on Bridge.
 *
 * Accounts approved before Bridge existed in the flow are the awkward case: they
 * are operational here and unknown there. Bridge does not accept our
 * verification — importing it needs Bridge's reliance model, which the developer
 * has to be approved for — so until then each of them completes Bridge's hosted
 * flow once. This says how many, and who.
 */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const approved = await prisma.user.findMany({
    where: { kycStatus: 'APPROVED' },
    select: { id: true, email: true, name: true }
  });

  const links = await prisma.bridgeCustomer.findMany({
    where: { userId: { in: approved.map((row) => row.id) } }
  });
  const byUser = new Map(links.map((row) => [row.userId, row]));

  const investors = approved.map((user) => {
    const link = byUser.get(user.id);
    return {
      userId: user.id,
      email: user.email,
      bridgeCustomerId: link?.customerId ?? null,
      bridgeKycStatus: link?.kycStatus ?? 'never_started',
      tosStatus: link?.tosStatus ?? null,
      /** Present when the investor still has something to complete. */
      kycLink: link?.kycLink ?? null
    };
  });

  return NextResponse.json({
    ok: true,
    bridgeConfigured: Boolean(getBridgeApiKey()),
    total: investors.length,
    withoutBridge: investors.filter((row) => !row.bridgeCustomerId).length,
    pending: investors.filter(
      (row) => row.bridgeCustomerId && row.bridgeKycStatus.toLowerCase() !== 'approved'
    ).length,
    investors
  });
}

/**
 * Admin: create the Bridge customer and hosted link for investors who have none.
 * Body: `{ userId? }` — omit to run for every approved investor.
 *
 * Creating the customer up front is what makes the link exist, so the investor
 * can be invited to finish rather than discovering the requirement at checkout.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!getBridgeApiKey()) {
    return NextResponse.json({ error: 'BRIDGE_NOT_CONFIGURED' }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { userId?: string; limit?: number };

  const users = await prisma.user.findMany({
    where: {
      kycStatus: 'APPROVED',
      ...(body.userId?.trim() ? { id: body.userId.trim() } : {})
    },
    select: { id: true, email: true, name: true },
    take: Math.min(body.limit ?? 100, 500)
  });

  const results = [];
  for (const user of users) {
    if (!user.email) {
      results.push({ userId: user.id, ok: false, reason: 'NO_EMAIL' });
      continue;
    }
    const state = await ensureBridgeOnboarding({
      userId: user.id,
      email: user.email,
      fullName: user.name?.trim() || user.email
    });
    results.push({
      userId: user.id,
      email: user.email,
      ok: state.status !== 'not_configured',
      status: state.status,
      kycLink: state.kycLink
    });
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    ready: results.filter((row) => row.status === 'approved').length,
    results
  });
}
