import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPaySanova = vi.fn();
const mockIsConfigured = vi.fn(() => false);

vi.mock('@sanova/database', () => ({
  prisma: {
    paymentIntent: {
      findMany: vi.fn().mockResolvedValue([])
    }
  }
}));

vi.mock('./paySanovaCartService', () => ({
  isPrivyServerAutoSettleConfigured: () => mockIsConfigured(),
  paySanovaCartForUser: (...args: unknown[]) => mockPaySanova(...args)
}));

import { autoSettlePrivyCartForUser, isPrivyServerAutoSettleConfigured } from './privyAutoSettleService';

describe('privyAutoSettleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConfigured.mockReturnValue(false);
  });

  it('reports not configured via paySanova helper', () => {
    expect(isPrivyServerAutoSettleConfigured()).toBe(false);
  });

  it('delegates settle to paySanovaCartForUser and forwards cart items', async () => {
    mockPaySanova.mockResolvedValue({
      ok: true,
      status: 'waiting_funds',
      address: '0xabc',
      balanceUsdc: 5,
      amountUsd: 20
    });

    const result = await autoSettlePrivyCartForUser('user-1', {
      clientBalanceUsdc: 5,
      items: [{ projectId: 'proj-1', tokenCount: 1 }],
      userEmail: 'a@b.com'
    });
    expect(mockPaySanova).toHaveBeenCalledWith({
      userId: 'user-1',
      userEmail: 'a@b.com',
      items: [{ projectId: 'proj-1', tokenCount: 1 }],
      clientBalanceUsdc: 5
    });
    expect(result.status).toBe('waiting_funds');
  });
});
