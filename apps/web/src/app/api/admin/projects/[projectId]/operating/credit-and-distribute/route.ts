import { NextResponse } from 'next/server';
import { Prisma } from '@sanova/database';
import { auth } from '../../../../../../../auth';
import { requireAdminSession } from '../../../../../../../lib/admin/requireAdmin';
import { creditAndDistributeOperatingRent } from '../../../../../../../lib/yield/creditAndDistributeRent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/** Credit tenant rent and distribute to token holders in one step. */
export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const session = await auth();
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    amount?: number;
    currency?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
    distributeAmount?: number;
    autoConvertIfNeeded?: boolean;
  };

  if (!Number.isFinite(body.amount) || (body.amount ?? 0) <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
  }

  try {
    const result = await creditAndDistributeOperatingRent({
      projectId,
      amount: body.amount!,
      currency: body.currency ?? 'USD',
      idempotencyKey: body.idempotencyKey,
      metadata: body.metadata as Prisma.InputJsonValue | undefined,
      actorUserId: session?.user?.id ?? null,
      distributeAmount: body.distributeAmount,
      autoConvertIfNeeded: body.autoConvertIfNeeded ?? true
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('[admin/operating/credit-and-distribute]', error);
    const message = error instanceof Error ? error.message : 'Credit and distribute failed';
    const status =
      message === 'PARTIAL_RENT_DISTRIBUTION'
        ? 409
        : message === 'PROJECT_NOT_FOUND'
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
