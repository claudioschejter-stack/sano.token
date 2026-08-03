import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@sanova/database', () => ({
  prisma: {
    paymentIntent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args)
    }
  }
}));

import { closeStaleOpenCartBatches } from './closeStaleCartBatches';

describe('closeStaleOpenCartBatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('expires every open batch except the one being kept', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'pi-keep', metadata: { cartBatchId: 'cart-keep' } },
      { id: 'pi-old-1', metadata: { cartBatchId: 'cart-old-1' } },
      { id: 'pi-old-2', metadata: { cartBatchId: 'cart-old-2' } }
    ]);

    const result = await closeStaleOpenCartBatches({
      userId: 'user-1',
      keepBatchId: 'cart-keep'
    });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(result.closedIntentIds).toEqual(['pi-old-1', 'pi-old-2']);
    expect(result.closedBatchIds).toEqual(['cart-old-1', 'cart-old-2']);
    expect(result.keptBatchId).toBe('cart-keep');
  });

  it('closes all open batches when nothing is kept', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'pi-1', metadata: { cartBatchId: 'cart-1' } },
      { id: 'pi-2', metadata: { cartBatchId: 'cart-1' } }
    ]);

    const result = await closeStaleOpenCartBatches({ userId: 'user-1' });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(result.closedBatchIds).toEqual(['cart-1']);
  });

  it('marks expired status with an audit reason', async () => {
    mockFindMany.mockResolvedValue([{ id: 'pi-1', metadata: { cartBatchId: 'cart-1' } }]);

    await closeStaleOpenCartBatches({ userId: 'user-1', reason: 'ADMIN_CLOSE_STALE' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pi-1' },
        data: expect.objectContaining({
          status: 'EXPIRED',
          metadata: expect.objectContaining({ closedAsStaleReason: 'ADMIN_CLOSE_STALE' })
        })
      })
    );
  });
});
