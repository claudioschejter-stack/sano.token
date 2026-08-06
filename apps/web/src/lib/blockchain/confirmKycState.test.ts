import { describe, expect, it, vi } from 'vitest';

vi.mock('./rpcRetry', () => ({
  readWithRetry: async (fn: () => Promise<unknown>) => {
    try {
      return await fn();
    } catch {
      return null;
    }
  }
}));

const { confirmKycState } = await import('./confirmKycState');

function token(values: Array<boolean | Error>) {
  let call = 0;
  return {
    kycApproved: async () => {
      const value = values[Math.min(call, values.length - 1)];
      call += 1;
      if (value instanceof Error) throw value;
      return value;
    }
  } as never;
}

const WALLET = '0x840aed84455C3a30Ef23a34a4D961BC3e1D06B41';

describe('confirmKycState', () => {
  it('accepts a state that already matches', async () => {
    expect(
      await confirmKycState({ token: token([true]), walletAddress: WALLET, approved: true })
    ).toBe(true);
  });

  it('waits out a node that has not seen the block yet', async () => {
    // This is what reported a successful approval as a failure.
    expect(
      await confirmKycState({
        token: token([false, false, true]),
        walletAddress: WALLET,
        approved: true,
        delayMs: 1
      })
    ).toBe(true);
  });

  it('survives a read that throws before the state settles', async () => {
    expect(
      await confirmKycState({
        token: token([new Error('missing revert data'), true]),
        walletAddress: WALLET,
        approved: true,
        delayMs: 1
      })
    ).toBe(true);
  });

  it('still fails when the state never changes, which is a real problem', async () => {
    expect(
      await confirmKycState({
        token: token([false]),
        walletAddress: WALLET,
        approved: true,
        attempts: 2,
        delayMs: 1
      })
    ).toBe(false);
  });

  it('confirms a revocation the same way', async () => {
    expect(
      await confirmKycState({
        token: token([true, false]),
        walletAddress: WALLET,
        approved: false,
        delayMs: 1
      })
    ).toBe(true);
  });
});
