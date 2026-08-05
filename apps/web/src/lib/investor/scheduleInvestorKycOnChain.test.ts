import { beforeEach, describe, expect, it, vi } from 'vitest';

const WALLET = '0x840aed84455C3a30Ef23a34a4D961BC3e1D06B41';

let projects: Array<{ id: string; contractAddress: string | null }> = [];
const scheduled: string[] = [];
let scheduleOutcome: (token: string) => unknown = () => ({ ok: true, readyAt: 1 });

vi.mock('@sanova/database', () => ({
  prisma: { project: { findMany: async () => projects } }
}));

vi.mock('./provisionInvestorProfile', () => ({
  isPendingInvestorWallet: (wallet: string) => wallet.toLowerCase().startsWith('0x00000000')
}));

vi.mock('../blockchain/scheduleTokenKyc', () => ({
  scheduleTokenKyc: async (input: { tokenAddress: string }) => {
    scheduled.push(input.tokenAddress);
    return scheduleOutcome(input.tokenAddress);
  }
}));

const { scheduleInvestorKycOnChain } = await import('./scheduleInvestorKycOnChain');

beforeEach(() => {
  scheduled.length = 0;
  scheduleOutcome = () => ({ ok: true, readyAt: 1 });
  projects = [
    { id: 'p1', contractAddress: '0x1111111111111111111111111111111111111111' },
    { id: 'p2', contractAddress: '0x2222222222222222222222222222222222222222' }
  ];
});

describe('scheduleInvestorKycOnChain', () => {
  it('starts the timelock on every tokenized project', async () => {
    const result = await scheduleInvestorKycOnChain({ userId: 'u1', walletAddress: WALLET });
    expect(result.scheduled).toBe(2);
    expect(scheduled).toHaveLength(2);
  });

  it('does nothing for a wallet that is still a placeholder', async () => {
    const result = await scheduleInvestorKycOnChain({
      userId: 'u1',
      walletAddress: '0x0000000000000000000000000000000000000001'
    });
    expect(result).toEqual({ scheduled: 0, skipped: 'WALLET_NOT_LINKED' });
    expect(scheduled).toHaveLength(0);
  });

  it('does nothing when no wallet is linked yet', async () => {
    expect(await scheduleInvestorKycOnChain({ userId: 'u1', walletAddress: null })).toEqual({
      scheduled: 0,
      skipped: 'WALLET_NOT_LINKED'
    });
  });

  it('rejects something that is not an address', async () => {
    expect(
      await scheduleInvestorKycOnChain({ userId: 'u1', walletAddress: 'claudio@example.com' })
    ).toEqual({ scheduled: 0, skipped: 'WALLET_NOT_LINKED' });
  });

  it('reports when there is nothing tokenized to schedule against', async () => {
    projects = [];
    expect(await scheduleInvestorKycOnChain({ userId: 'u1', walletAddress: WALLET })).toEqual({
      scheduled: 0,
      skipped: 'NO_TOKENIZED_PROJECTS'
    });
  });

  it('keeps going when one project fails, so one bad token costs nothing', async () => {
    scheduleOutcome = (token) =>
      token.endsWith('1111') ? { ok: false, code: 'TOKEN_READ_FAILED' } : { ok: true, readyAt: 1 };

    const result = await scheduleInvestorKycOnChain({ userId: 'u1', walletAddress: WALLET });
    expect(result.scheduled).toBe(1);
    expect(scheduled).toHaveLength(2);
  });

  it('counts an already scheduled action as not newly scheduled', async () => {
    scheduleOutcome = () => ({ ok: false, code: 'SCHEDULED_NOT_READY' });
    const result = await scheduleInvestorKycOnChain({ userId: 'u1', walletAddress: WALLET });
    expect(result.scheduled).toBe(0);
  });
});
