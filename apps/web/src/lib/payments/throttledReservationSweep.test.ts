import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExpire = vi.fn();

vi.mock('./closeStaleCartBatches', () => ({
  expireStaleCartReservations: (...args: unknown[]) => mockExpire(...args)
}));

import {
  resetReservationSweepThrottle,
  runThrottledReservationSweep
} from './throttledReservationSweep';

describe('runThrottledReservationSweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetReservationSweepThrottle();
    mockExpire.mockResolvedValue({ expiredIntentIds: [], releasedTokens: 0 });
  });

  it('sweeps on the first call', async () => {
    runThrottledReservationSweep(1_000_000);
    await vi.waitFor(() => expect(mockExpire).toHaveBeenCalledTimes(1));
  });

  it('skips repeat calls inside the throttle window', async () => {
    runThrottledReservationSweep(1_000_000);
    await vi.waitFor(() => expect(mockExpire).toHaveBeenCalledTimes(1));

    runThrottledReservationSweep(1_060_000);
    expect(mockExpire).toHaveBeenCalledTimes(1);
  });

  it('sweeps again once the window elapsed', async () => {
    runThrottledReservationSweep(1_000_000);
    await vi.waitFor(() => expect(mockExpire).toHaveBeenCalledTimes(1));
    // Let the in-flight guard clear before asking for another sweep.
    await new Promise((resolve) => setTimeout(resolve, 0));

    runThrottledReservationSweep(1_000_000 + 6 * 60 * 1000);
    await vi.waitFor(() => expect(mockExpire).toHaveBeenCalledTimes(2));
  });

  it('never throws when the sweep fails', async () => {
    mockExpire.mockRejectedValue(new Error('db down'));
    expect(() => runThrottledReservationSweep(2_000_000)).not.toThrow();
    await vi.waitFor(() => expect(mockExpire).toHaveBeenCalled());
  });
});
