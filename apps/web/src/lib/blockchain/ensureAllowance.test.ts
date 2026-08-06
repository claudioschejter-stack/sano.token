import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaxUint256 } from 'ethers';

const TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const OWNER = '0xa27450116E04eb845d741767d9e798Ccf828fDC1';
const SPENDER = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';

let currentAllowance: bigint | 'falla' = 0n;
const approvals: bigint[] = [];

vi.mock('./automationTx', () => ({
  waitForAutomationTx: async () => ({ hash: '0xrecibo' })
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  class FakeContract {
    async allowance() {
      if (currentAllowance === 'falla') throw new Error('RPC 429');
      return currentAllowance;
    }
    async approve(_spender: string, amount: bigint) {
      approvals.push(amount);
      return { hash: '0xenviado' };
    }
  }
  return { ...actual, Contract: FakeContract };
});

const { ensureAllowance } = await import('./ensureAllowance');
const signer = {} as never;

beforeEach(() => {
  currentAllowance = 0n;
  approvals.length = 0;
});

/**
 * An `approve` that grants what was already granted is a whole transaction that
 * changes nothing. On a daily cron that is a daily cost, and the infinite-grant
 * pattern makes it easy to miss because the call reads as one-time setup.
 */
describe('ensureAllowance', () => {
  it('does not approve when the allowance already covers the amount', async () => {
    currentAllowance = MaxUint256;

    const result = await ensureAllowance({ token: TOKEN, owner: OWNER, spender: SPENDER, signer });

    expect(result.approved).toBe(false);
    expect(result.txHash).toBeNull();
    expect(approvals).toHaveLength(0);
  });

  it('approves when there is no allowance yet', async () => {
    const result = await ensureAllowance({ token: TOKEN, owner: OWNER, spender: SPENDER, signer });

    expect(result.approved).toBe(true);
    expect(approvals).toEqual([MaxUint256]);
  });

  it('approves when the existing allowance falls short of what is needed', async () => {
    currentAllowance = 100n;

    const result = await ensureAllowance({
      token: TOKEN,
      owner: OWNER,
      spender: SPENDER,
      amount: 500n,
      signer
    });

    expect(result.approved).toBe(true);
    expect(approvals).toEqual([500n]);
  });

  it('leaves a sufficient smaller allowance alone', async () => {
    currentAllowance = 500n;

    const result = await ensureAllowance({
      token: TOKEN,
      owner: OWNER,
      spender: SPENDER,
      amount: 500n,
      signer
    });

    expect(result.approved).toBe(false);
    expect(approvals).toHaveLength(0);
  });

  /** An unreadable allowance is not a licence to skip: approving is the safe side. */
  it('approves when the allowance cannot be read', async () => {
    currentAllowance = 'falla';

    const result = await ensureAllowance({ token: TOKEN, owner: OWNER, spender: SPENDER, signer });

    expect(result.approved).toBe(true);
  });
});
