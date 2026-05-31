import { NextResponse } from 'next/server';
import { Prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../../../../lib/admin/requireAdmin';
import { creditProjectOperatingRent } from '../../../../../../../lib/yield/projectOperatingService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/** Manual tenant rent credit → ProjectOperatingBalance (not PlatformWallet). */
export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    amount?: number;
    currency?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  };

  if (!Number.isFinite(body.amount) || (body.amount ?? 0) <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
  }

  const idempotencyKey =
    body.idempotencyKey?.trim() ||
    `rent-credit:${projectId}:${body.currency ?? 'USD'}:${body.amount}:${Date.now()}`;

  try {
    const result = await creditProjectOperatingRent({
      projectId,
      amount: body.amount!,
      currency: body.currency ?? 'USD',
      idempotencyKey,
      metadata: body.metadata as Prisma.InputJsonValue | undefined
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      entry: {
        id: result.entry.id,
        amount: result.entry.amount.toString(),
        currency: result.entry.currency,
        balanceAfter: result.entry.balanceAfter.toString(),
        createdAt: result.entry.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('[admin/operating/credit]', error);
    const message = error instanceof Error ? error.message : 'Credit failed';
    const status = message === 'PROJECT_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
