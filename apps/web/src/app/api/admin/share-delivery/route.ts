import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { deliverVaultSharesForPaymentIntent } from '../../../../lib/blockchain/investorVaultShareDelivery';
import { auditShareDelivery } from '../../../../lib/payments/shareDeliveryAudit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

async function resolveUserId(email: string | null | undefined): Promise<string | null> {
  const value = email?.trim();
  if (!value) return null;
  const user = await prisma.user.findFirst({
    where: { email: { equals: value, mode: 'insensitive' } },
    select: { id: true }
  });
  return user?.id ?? null;
}

/**
 * Admin: which paid purchases still owe shares, and what the investor's wallet
 * actually holds on-chain.
 * `GET /api/admin/share-delivery?email=…&projectId=…`
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const userId = email ? await resolveUserId(email) : null;
  if (email && !userId) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  try {
    const audit = await auditShareDelivery({
      projectId: url.searchParams.get('projectId')?.trim() || undefined,
      userId: userId ?? undefined
    });
    return NextResponse.json({ ok: true, audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AUDIT_FAILED';
    console.error('[admin/share-delivery] GET', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Admin: deliver the shares of purchases that were paid but never handed over.
 * Body: `{ paymentIntentId? , email?, projectId? }`
 *
 * Delivery is idempotent — it claims the intent before transferring and
 * verifies the recipient balance afterwards — so retrying is safe.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    paymentIntentId?: string;
    email?: string;
    projectId?: string;
  };

  try {
    const intentId = body.paymentIntentId?.trim();
    if (intentId) {
      const outcome = await deliverVaultSharesForPaymentIntent(intentId);
      return NextResponse.json({ ok: outcome.status === 'DELIVERED', results: [{ paymentIntentId: intentId, outcome }] });
    }

    const userId = body.email ? await resolveUserId(body.email) : null;
    if (body.email && !userId) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const audit = await auditShareDelivery({
      projectId: body.projectId?.trim() || undefined,
      userId: userId ?? undefined
    });

    const results = [];
    for (const row of audit.pending) {
      const outcome = await deliverVaultSharesForPaymentIntent(row.paymentIntentId).catch((error) => ({
        status: 'FAILED' as const,
        code: error instanceof Error ? error.message.slice(0, 250) : 'DELIVERY_FAILED'
      }));
      results.push({ paymentIntentId: row.paymentIntentId, email: row.email, outcome });
    }

    return NextResponse.json({
      ok: results.every((row) => row.outcome.status === 'DELIVERED' || row.outcome.status === 'ALREADY_DELIVERED'),
      attempted: results.length,
      results,
      after: await auditShareDelivery({
        projectId: body.projectId?.trim() || undefined,
        userId: userId ?? undefined
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DELIVERY_FAILED';
    console.error('[admin/share-delivery] POST', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
