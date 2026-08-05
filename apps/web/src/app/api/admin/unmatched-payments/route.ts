import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { resolveUnmatchedPayment, suggestMatches } from '../../../../lib/payments/unmatchedPayments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Admin: money that arrived and could not be routed, with where it might belong.
 *
 * Query: `?status=PENDING|ASSIGNED|DISMISSED`, `?suggestions=0` to skip matching.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get('status') ?? 'PENDING').toUpperCase();
  const withSuggestions = url.searchParams.get('suggestions') !== '0';

  const payments = await prisma.unmatchedPayment.findMany({
    where: status === 'ALL' ? {} : { status: status as never },
    orderBy: { occurredAt: 'desc' },
    take: 100
  });

  const rows = [];
  for (const payment of payments) {
    rows.push({
      id: payment.id,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      externalReference: payment.externalReference,
      amount: Number(payment.amount),
      currency: payment.currency,
      amountUsd: payment.amountUsd ? Number(payment.amountUsd) : null,
      payerName: payment.payerName,
      occurredAt: payment.occurredAt,
      status: payment.status,
      resolvedKind: payment.resolvedKind,
      resolvedRef: payment.resolvedRef,
      suggestions:
        withSuggestions && payment.status === 'PENDING' ? await suggestMatches(payment.id) : []
    });
  }

  const pendingUsd = rows
    .filter((row) => row.status === 'PENDING')
    .reduce((total, row) => total + (row.amountUsd ?? 0), 0);

  return NextResponse.json({
    ok: true,
    pending: rows.filter((row) => row.status === 'PENDING').length,
    pendingUsd: Number(pendingUsd.toFixed(2)),
    payments: rows
  });
}

/**
 * Admin: send an unmatched payment into the circuit it belongs to.
 *
 * Body: `{ paymentId, kind: 'purchase' | 'rent' | 'dismissed', ref?, periodKey?, note? }`
 */
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    paymentId?: string;
    kind?: 'purchase' | 'rent' | 'dismissed';
    ref?: string;
    periodKey?: string;
    note?: string;
  };

  if (!body.paymentId?.trim() || !body.kind) {
    return NextResponse.json({ error: 'PAYMENT_ID_AND_KIND_REQUIRED' }, { status: 400 });
  }

  try {
    const result = await resolveUnmatchedPayment({
      paymentId: body.paymentId.trim(),
      kind: body.kind,
      ref: body.ref,
      periodKey: body.periodKey,
      note: body.note,
      actor: typeof session === 'object' && 'userId' in session ? String(session.userId) : null
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RESOLVE_FAILED';
    console.error('[admin/unmatched-payments]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
