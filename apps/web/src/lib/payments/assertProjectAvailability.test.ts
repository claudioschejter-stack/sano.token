import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@sanova/database', () => ({
  prisma: { project: { findMany: (...args: unknown[]) => mockFindMany(...args) } }
}));

import { findAvailabilityShortfalls } from './assertProjectAvailability';

describe('findAvailabilityShortfalls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores lines whose supply is already reserved', async () => {
    const result = await findAvailabilityShortfalls([
      { projectId: 'p1', tokenCount: 5, metadata: { supplyReserved: true } }
    ]);

    expect(mockFindMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('reports a shortfall when the project ran out of tokens', async () => {
    mockFindMany.mockResolvedValue([{ id: 'p1', title: 'UV3RWA', availableTokens: 2 }]);

    const result = await findAvailabilityShortfalls([
      { projectId: 'p1', tokenCount: 3, metadata: {} }
    ]);

    expect(result).toEqual([
      { projectId: 'p1', projectTitle: 'UV3RWA', requestedTokens: 3, availableTokens: 2 }
    ]);
  });

  it('aggregates several lines of the same project', async () => {
    mockFindMany.mockResolvedValue([{ id: 'p1', title: 'UV3RWA', availableTokens: 3 }]);

    const result = await findAvailabilityShortfalls([
      { projectId: 'p1', tokenCount: 2, metadata: {} },
      { projectId: 'p1', tokenCount: 2, metadata: {} }
    ]);

    expect(result[0]?.requestedTokens).toBe(4);
  });

  it('passes when supply covers the request', async () => {
    mockFindMany.mockResolvedValue([{ id: 'p1', title: 'UV3RWA', availableTokens: 10 }]);

    const result = await findAvailabilityShortfalls([
      { projectId: 'p1', tokenCount: 4, metadata: {} }
    ]);

    expect(result).toEqual([]);
  });
});
