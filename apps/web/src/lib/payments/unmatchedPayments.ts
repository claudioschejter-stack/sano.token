import { prisma } from '@sanova/database';
import { resolveArsPerUsd } from './arsFxRate';

/**
 * Money that arrived and could not be routed.
 *
 * Webhooks answered `ignored: unmatched_reference` and moved on, so a transfer
 * whose reference was missing, mistyped or sent from outside our links left no
 * trace: nobody knew it had arrived and nobody was owed it. It is the one
 * failure mode where the platform loses money silently rather than loudly.
 */

export type RecordUnmatchedInput = {
  provider: string;
  providerPaymentId: string;
  externalReference?: string | null;
  amount: number;
  currency: string;
  payerName?: string | null;
  payerTaxId?: string | null;
  occurredAt?: Date | null;
  payload?: Record<string, unknown> | null;
};

function toUsd(amount: number, currency: string): number | null {
  const code = currency.trim().toUpperCase();
  if (code === 'USD' || code === 'USDC') return amount;
  if (code === 'ARS') {
    const rate = resolveArsPerUsd();
    return rate > 0 ? Number((amount / rate).toFixed(2)) : null;
  }
  return null;
}

/** Idempotent on `(provider, providerPaymentId)`: a repeated webhook is one row. */
export async function recordUnmatchedPayment(input: RecordUnmatchedInput) {
  const amountUsd = toUsd(input.amount, input.currency);

  return prisma.unmatchedPayment
    .upsert({
      where: {
        provider_providerPaymentId: {
          provider: input.provider,
          providerPaymentId: input.providerPaymentId
        }
      },
      create: {
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        externalReference: input.externalReference ?? null,
        amount: input.amount,
        currency: input.currency.trim().toUpperCase(),
        amountUsd,
        payerName: input.payerName ?? null,
        payerTaxId: input.payerTaxId ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        payload: (input.payload ?? {}) as never
      },
      // Never revive something an admin already resolved.
      update: { payload: (input.payload ?? {}) as never }
    })
    .catch((error) => {
      console.error('[recordUnmatchedPayment] failed', error);
      return null;
    });
}

export type MatchSuggestion = {
  kind: 'purchase' | 'rent';
  ref: string;
  label: string;
  amountUsd: number;
  /** Why this is being suggested, so the decision is reviewable. */
  reason: string;
};

/** Payments within this fraction of the order total are considered a match. */
const AMOUNT_TOLERANCE = 0.02;

/**
 * Candidate destinations for one unmatched payment.
 *
 * Suggestions are never applied on their own: the money already moved, so a
 * wrong guess credits the wrong investor, and that is harder to undo than
 * asking.
 */
export async function suggestMatches(paymentId: string): Promise<MatchSuggestion[]> {
  const payment = await prisma.unmatchedPayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== 'PENDING') {
    return [];
  }

  const amountUsd = payment.amountUsd ? Number(payment.amountUsd) : null;
  if (!amountUsd || amountUsd <= 0) {
    return [];
  }

  const tolerance = amountUsd * AMOUNT_TOLERANCE;
  const suggestions: MatchSuggestion[] = [];

  // Open orders whose total is within tolerance of what arrived.
  const openIntents = await prisma.paymentIntent.findMany({
    where: {
      status: { in: ['REQUIRES_PAYMENT', 'PENDING', 'MANUAL_REVIEW'] },
      amountUsd: { gte: amountUsd - tolerance, lte: amountUsd + tolerance }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, amountUsd: true, projectId: true, metadata: true, createdAt: true }
  });

  for (const intent of openIntents) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    const batchId =
      typeof metadata.cartBatchId === 'string' ? metadata.cartBatchId.trim() : intent.id;

    suggestions.push({
      kind: 'purchase',
      ref: batchId,
      label: `Compra abierta por USD ${Number(intent.amountUsd).toFixed(2)}`,
      amountUsd: Number(intent.amountUsd),
      reason: `monto coincide dentro del ${AMOUNT_TOLERANCE * 100}%`
    });
  }

  // A tenant paying rent usually names the property; fall back to any project.
  const payer = payment.payerName?.trim();
  if (payer) {
    const projects = await prisma.project.findMany({
      where: { title: { contains: payer, mode: 'insensitive' } },
      select: { id: true, title: true },
      take: 5
    });
    for (const project of projects) {
      suggestions.push({
        kind: 'rent',
        ref: project.id,
        label: `Renta de ${project.title}`,
        amountUsd,
        reason: `el pagador "${payer}" coincide con el nombre del proyecto`
      });
    }
  }

  return suggestions;
}

export type ResolveUnmatchedResult =
  | { ok: true; kind: 'purchase' | 'rent' | 'dismissed'; detail: string }
  | { ok: false; code: string; detail?: string };

/**
 * Send an unmatched payment into the circuit it belongs to.
 *
 * Rent credits the project and distributes to its holders; a purchase is
 * settled against its open batch. Dismissing records the decision instead of
 * deleting the row, because "this was not ours" is itself an answer worth
 * keeping.
 */
export async function resolveUnmatchedPayment(input: {
  paymentId: string;
  kind: 'purchase' | 'rent' | 'dismissed';
  ref?: string;
  periodKey?: string;
  actor?: string | null;
  note?: string | null;
}): Promise<ResolveUnmatchedResult> {
  const payment = await prisma.unmatchedPayment.findUnique({ where: { id: input.paymentId } });
  if (!payment) {
    return { ok: false, code: 'NOT_FOUND' };
  }
  if (payment.status !== 'PENDING') {
    return { ok: false, code: 'ALREADY_RESOLVED', detail: payment.status };
  }

  if (input.kind === 'dismissed') {
    await prisma.unmatchedPayment.update({
      where: { id: payment.id },
      data: {
        status: 'DISMISSED',
        resolvedKind: 'dismissed',
        resolvedAt: new Date(),
        resolvedBy: input.actor ?? null,
        note: input.note ?? null
      }
    });
    return { ok: true, kind: 'dismissed', detail: 'marcado como no aplicable' };
  }

  if (!input.ref?.trim()) {
    return { ok: false, code: 'REF_REQUIRED' };
  }

  if (input.kind === 'rent') {
    const { creditAndDistributeOperatingRent } = await import(
      '../yield/creditAndDistributeRent'
    );
    const periodKey = input.periodKey?.trim() || new Date().toISOString().slice(0, 7);

    await creditAndDistributeOperatingRent({
      projectId: input.ref.trim(),
      amount: Number(payment.amount),
      currency: payment.currency === 'ARS' ? 'ARS' : 'USD',
      // Keyed on the payment, so assigning twice cannot pay twice.
      idempotencyKey: `unmatched:${payment.id}`,
      autoConvertIfNeeded: true,
      metadata: {
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        periodKey,
        assignedBy: input.actor ?? null,
        flow: 'unmatched_payment_assignment'
      }
    });

    await prisma.unmatchedPayment.update({
      where: { id: payment.id },
      data: {
        status: 'ASSIGNED',
        resolvedKind: 'rent',
        resolvedRef: input.ref.trim(),
        resolvedAt: new Date(),
        resolvedBy: input.actor ?? null,
        note: input.note ?? null
      }
    });

    return { ok: true, kind: 'rent', detail: `acreditado al proyecto ${input.ref.trim()}` };
  }

  const { dispatchApprovedLocalWalletPayment } = await import('./localWalletWebhookSettlement');
  await dispatchApprovedLocalWalletPayment({
    externalReference: input.ref.trim(),
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    payload: {
      provider: payment.provider,
      assignedFromUnmatched: payment.id,
      assignedBy: input.actor ?? null
    }
  });

  await prisma.unmatchedPayment.update({
    where: { id: payment.id },
    data: {
      status: 'ASSIGNED',
      resolvedKind: 'purchase',
      resolvedRef: input.ref.trim(),
      resolvedAt: new Date(),
      resolvedBy: input.actor ?? null,
      note: input.note ?? null
    }
  });

  return { ok: true, kind: 'purchase', detail: `asignado a la compra ${input.ref.trim()}` };
}
