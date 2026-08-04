import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockReleaseSupply = vi.fn();

vi.mock('@sanova/database', () => ({
  prisma: {
    paymentIntent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args)
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn)
  }
}));

vi.mock('./paymentSupplyReservation', () => ({
  releaseSupplyForIntent: (...args: unknown[]) => mockReleaseSupply(...args)
}));

import {
  closeStaleOpenCartBatches,
  expireStaleCartReservations
} from './closeStaleCartBatches';

const tx = {
  paymentIntent: { update: (...args: unknown[]) => mockUpdate(...args) }
};

describe('closeStaleOpenCartBatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockReleaseSupply.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(tx));
  });

  it('expires every open batch except the one being kept', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'pi-keep', projectId: 'p1', tokenCount: 1, metadata: { cartBatchId: 'cart-keep' } },
      { id: 'pi-old-1', projectId: 'p1', tokenCount: 1, metadata: { cartBatchId: 'cart-old-1' } },
      { id: 'pi-old-2', projectId: 'p1', tokenCount: 2, metadata: { cartBatchId: 'cart-old-2' } }
    ]);

    const result = await closeStaleOpenCartBatches({
      userId: 'user-1',
      keepBatchId: 'cart-keep'
    });

    expect(result.closedIntentIds).toEqual(['pi-old-1', 'pi-old-2']);
    expect(result.closedBatchIds).toEqual(['cart-old-1', 'cart-old-2']);
    expect(result.keptBatchId).toBe('cart-keep');
  });

  it('returns reserved tokens to project supply', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'pi-1',
        projectId: 'p1',
        tokenCount: 3,
        metadata: { cartBatchId: 'cart-1', supplyReserved: true }
      },
      {
        id: 'pi-2',
        projectId: 'p1',
        tokenCount: 5,
        metadata: { cartBatchId: 'cart-1', supplyReserved: false }
      }
    ]);

    const result = await closeStaleOpenCartBatches({ userId: 'user-1' });

    expect(mockReleaseSupply).toHaveBeenCalledTimes(2);
    // Only the reserved line counts toward returned supply.
    expect(result.releasedTokens).toBe(3);
  });

  it('marks expired status with an audit reason', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'pi-1', projectId: 'p1', tokenCount: 1, metadata: { cartBatchId: 'cart-1' } }
    ]);

    await closeStaleOpenCartBatches({ userId: 'user-1', reason: 'ADMIN_CLOSE_STALE' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pi-1' },
        data: expect.objectContaining({
          status: 'EXPIRED',
          metadata: expect.objectContaining({
            closedAsStaleReason: 'ADMIN_CLOSE_STALE',
            supplyReserved: false
          })
        })
      })
    );
  });
});

describe('expireStaleCartReservations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockReleaseSupply.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(tx));
  });

  it('releases supply for reservations past their TTL', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'pi-1', projectId: 'p1', tokenCount: 2, metadata: { supplyReserved: true } },
      { id: 'pi-2', projectId: 'p2', tokenCount: 4, metadata: { supplyReserved: true } }
    ]);

    const result = await expireStaleCartReservations();

    expect(mockReleaseSupply).toHaveBeenCalledTimes(2);
    expect(result.expiredIntentIds).toEqual(['pi-1', 'pi-2']);
    expect(result.releasedTokens).toBe(6);
  });

  it('sweeps open intents past expiresAt, and reviews past their hold', async () => {
    mockFindMany.mockResolvedValue([]);

    await expireStaleCartReservations();

    const where = mockFindMany.mock.calls[0][0].where as {
      OR: Array<Record<string, any>>;
    };

    expect(where.OR).toEqual([
      {
        status: { in: ['REQUIRES_PAYMENT', 'PENDING'] },
        expiresAt: { lte: expect.any(Date) }
      },
      {
        status: 'MANUAL_REVIEW',
        updatedAt: { lte: expect.any(Date) }
      }
    ]);
  });
});
