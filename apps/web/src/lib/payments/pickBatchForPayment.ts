export type ReconcilableCartBatch = {
  batchId: string;
  amountUsd: number;
  intentIds: string[];
  createdAt: string;
  /** Past its TTL: `findPendingUsdcCartPurchase` skips these, reconciliation must not. */
  expired: boolean;
};

/**
 * Pick the batch a given payment settles: exact amount match first, then the
 * newest batch the payment can cover. Never credits a payment to a bigger cart.
 */
export function pickBatchForPayment(input: {
  batches: ReconcilableCartBatch[];
  paidUsdc?: number | null;
}): ReconcilableCartBatch | null {
  if (!input.batches.length) return null;

  const paid = input.paidUsdc;
  if (typeof paid === 'number' && paid > 0) {
    const covered = input.batches.filter((row) => row.amountUsd <= paid + 1e-9);
    const exact = covered.find((row) => Math.abs(row.amountUsd - paid) <= 1e-6);
    if (exact) return exact;
    return covered[0] ?? null;
  }

  return input.batches[0] ?? null;
}
