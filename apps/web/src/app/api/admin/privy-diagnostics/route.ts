import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { archiveDuplicateInvestorWallets } from '../../../../lib/privy/archiveDuplicateInvestorWallets';
import { collectPrivyPayDiagnostics } from '../../../../lib/privy/privyPayDiagnostics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

/**
 * Admin: why can't the server pay from an investor's Sanova wallet?
 * `GET /api/admin/privy-diagnostics?email=…` or `?userId=…`
 */
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

  try {
    const diagnostics = await collectPrivyPayDiagnostics(userId);
    return NextResponse.json({ ok: true, diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DIAGNOSTICS_FAILED';
    console.error('[admin/privy-diagnostics]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Admin remediation: archive duplicate (empty) Privy wallets for an investor. */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    email?: string;
    action?: 'archive_duplicates';
  };

  if (body.action !== 'archive_duplicates') {
    return NextResponse.json({ error: 'UNSUPPORTED_ACTION' }, { status: 400 });
  }

  const userId = await resolveUserId({ userId: body.userId, email: body.email });
  if (!userId) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  try {
    const diagnostics = await collectPrivyPayDiagnostics(userId);
    const balanceByAddress: Record<string, number> = {};
    if (diagnostics.dbLinkedAddress && diagnostics.balances.usdcBase != null) {
      balanceByAddress[diagnostics.dbLinkedAddress] = diagnostics.balances.usdcBase;
    }

    const result = await archiveDuplicateInvestorWallets({ userId, balanceByAddress });
    return NextResponse.json({ ok: true, action: 'archive_duplicates', result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ARCHIVE_FAILED';
    console.error('[admin/privy-diagnostics] archive failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
