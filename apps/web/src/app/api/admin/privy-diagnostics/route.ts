import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { collectPrivyPayDiagnostics } from '../../../../lib/privy/privyPayDiagnostics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Admin: why can't the server pay from an investor's Sanova wallet?
 * `GET /api/admin/privy-diagnostics?email=…` or `?userId=…`
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email')?.trim();
  let userId = url.searchParams.get('userId')?.trim() ?? '';

  if (!userId && email) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true }
    });
    userId = user?.id ?? '';
  }

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
