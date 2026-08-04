import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  reconcileInvestorHoldings,
  reconcileProjectSupply
} from '../../../../lib/reconciliation/tokenHoldingsReconciliation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Admin RWA token reconciliation.
 *
 * - `?email=` / `?userId=` → investor holdings: booked tokens vs on-chain vault shares
 * - `?projectId=` → supply: availableTokens vs investments vs on-chain shares
 * - `&movements=1` → on-chain vault share movement log (bitácora)
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email')?.trim();
  const projectId = url.searchParams.get('projectId')?.trim();
  const includeMovements = url.searchParams.get('movements') === '1';
  let userId = url.searchParams.get('userId')?.trim() ?? '';

  if (!userId && email) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true }
    });
    userId = user?.id ?? '';
  }

  if (!userId && !projectId) {
    return NextResponse.json({ error: 'USER_OR_PROJECT_REQUIRED' }, { status: 400 });
  }

  try {
    const investor = userId ? await reconcileInvestorHoldings(userId) : null;
    const projectIds = projectId
      ? [projectId]
      : [...new Set((investor?.holdings ?? []).map((row) => row.projectId))];

    const projects = [];
    for (const id of projectIds) {
      projects.push(await reconcileProjectSupply({ projectId: id, includeMovements }));
    }

    const issues = [...(investor?.issues ?? []), ...projects.flatMap((row) => row.issues)];

    return NextResponse.json({
      ok: true,
      reconciled: issues.length === 0,
      investor,
      projects,
      issues
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RECONCILIATION_FAILED';
    console.error('[admin/token-reconciliation]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
