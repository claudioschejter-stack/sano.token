import { describe, expect, it, vi } from 'vitest';
import { runSanovaPayFlow } from './runSanovaPayFlow';

describe('runSanovaPayFlow', () => {
  const items = [{ projectId: 'uv3', tokenCount: 1 }];

  it('rejects empty cart before calling APIs', async () => {
    const postPaySanova = vi.fn();
    const result = await runSanovaPayFlow({
      items: [],
      clientBalanceUsdc: 20,
      postPaySanova,
      postLegacySettle: vi.fn(),
      createPendingCart: vi.fn()
    });
    expect(result).toEqual({ ok: false, status: 'failed', error: 'NO_PENDING_PURCHASE' });
    expect(postPaySanova).not.toHaveBeenCalled();
  });

  it('settles on first pay-sanova success', async () => {
    const postPaySanova = vi.fn().mockResolvedValue({
      ok: true,
      status: 'settled',
      batchId: 'cart-1',
      txHash: '0xabc',
      amountUsd: 20
    });
    const createPendingCart = vi.fn();
    const result = await runSanovaPayFlow({
      items,
      clientBalanceUsdc: 20,
      postPaySanova,
      postLegacySettle: vi.fn(),
      createPendingCart
    });
    expect(result.status).toBe('settled');
    expect(postPaySanova).toHaveBeenCalledTimes(1);
    expect(postPaySanova).toHaveBeenCalledWith(items, 20);
    expect(createPendingCart).not.toHaveBeenCalled();
  });

  it('recreates cart and retries when server returns no_pending_purchase', async () => {
    const postPaySanova = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 'no_pending_purchase' })
      .mockResolvedValueOnce({
        ok: true,
        status: 'settled',
        batchId: 'cart-2',
        txHash: '0xdef',
        amountUsd: 20
      });
    const createPendingCart = vi.fn().mockResolvedValue('cart-2');

    const result = await runSanovaPayFlow({
      items,
      clientBalanceUsdc: 20,
      postPaySanova,
      postLegacySettle: vi.fn(),
      createPendingCart
    });

    expect(createPendingCart).toHaveBeenCalledWith(items);
    expect(postPaySanova).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true, status: 'settled', batchId: 'cart-2' });
  });

  it('falls back to legacy settle with items on HTML gateway errors', async () => {
    const postPaySanova = vi.fn().mockResolvedValue({
      ok: false,
      status: 'failed',
      error: 'HTTP_403_HTML_RESPONSE'
    });
    const postLegacySettle = vi.fn().mockResolvedValue({
      ok: true,
      status: 'settled',
      batchId: 'cart-3',
      txHash: '0xfall',
      amountUsd: 20
    });
    const createPendingCart = vi.fn().mockResolvedValue('cart-3');

    const result = await runSanovaPayFlow({
      items,
      clientBalanceUsdc: 20,
      postPaySanova,
      postLegacySettle,
      createPendingCart
    });

    expect(createPendingCart).toHaveBeenCalledWith(items);
    expect(postLegacySettle).toHaveBeenCalledWith(items, 20);
    expect(result.status).toBe('settled');
  });
});
