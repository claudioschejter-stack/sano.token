import { describe, expect, it } from 'vitest';
import { pickBatchForPayment } from './pickBatchForPayment';

const batch = (batchId: string, amountUsd: number, createdAt: string) => ({
  batchId,
  amountUsd,
  intentIds: [`${batchId}-intent`],
  createdAt,
  expired: true
});

describe('pickBatchForPayment', () => {
  it('prefers the batch whose total matches the payment', () => {
    const picked = pickBatchForPayment({
      batches: [
        batch('cart-500', 500, '2026-08-03T23:00:00.000Z'),
        batch('cart-20', 20, '2026-08-03T22:00:00.000Z')
      ],
      paidUsdc: 20
    });

    expect(picked?.batchId).toBe('cart-20');
  });

  it('never credits a payment to a batch that costs more', () => {
    const picked = pickBatchForPayment({
      batches: [batch('cart-500', 500, '2026-08-03T23:00:00.000Z')],
      paidUsdc: 20
    });

    expect(picked).toBeNull();
  });

  it('falls back to the newest covered batch when no exact match exists', () => {
    const picked = pickBatchForPayment({
      batches: [
        batch('cart-newest', 10, '2026-08-03T23:00:00.000Z'),
        batch('cart-older', 15, '2026-08-03T21:00:00.000Z')
      ],
      paidUsdc: 20
    });

    expect(picked?.batchId).toBe('cart-newest');
  });

  it('uses the newest batch when the paid amount is unknown', () => {
    const picked = pickBatchForPayment({
      batches: [
        batch('cart-newest', 20, '2026-08-03T23:00:00.000Z'),
        batch('cart-older', 20, '2026-08-03T20:00:00.000Z')
      ],
      paidUsdc: null
    });

    expect(picked?.batchId).toBe('cart-newest');
  });

  it('returns null without batches', () => {
    expect(pickBatchForPayment({ batches: [], paidUsdc: 20 })).toBeNull();
  });
});
