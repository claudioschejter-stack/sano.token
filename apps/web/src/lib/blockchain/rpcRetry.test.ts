import { describe, expect, it, vi } from 'vitest';
import { isTransientRpcError, readWithRetry } from './rpcRetry';

describe('isTransientRpcError', () => {
  it('recognises the throttled shape ethers reports as a revert', () => {
    expect(isTransientRpcError(new Error('missing revert data'))).toBe(true);
    expect(isTransientRpcError({ shortMessage: 'could not coalesce error' })).toBe(true);
    expect(isTransientRpcError(new Error('429 Too Many Requests'))).toBe(true);
  });

  it('leaves a genuine contract error alone', () => {
    expect(isTransientRpcError(new Error('execution reverted: NotOperator'))).toBe(false);
    expect(isTransientRpcError(new Error('insufficient funds for transfer'))).toBe(false);
  });
});

describe('readWithRetry', () => {
  it('returns the value on the first success', async () => {
    const read = vi.fn(async () => 'ok');
    expect(await readWithRetry(read)).toBe('ok');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('retries a throttled read and returns the eventual value', async () => {
    let calls = 0;
    const read = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error('missing revert data');
      return 'ok';
    });
    expect(await readWithRetry(read, { baseDelayMs: 1 })).toBe('ok');
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last attempt instead of hanging', async () => {
    const read = vi.fn(async () => {
      throw new Error('missing revert data');
    });
    expect(await readWithRetry(read, { attempts: 2, baseDelayMs: 1 })).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('does not retry a real contract revert', async () => {
    const read = vi.fn(async () => {
      throw new Error('execution reverted: NotOperator');
    });
    expect(await readWithRetry(read, { baseDelayMs: 1 })).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
