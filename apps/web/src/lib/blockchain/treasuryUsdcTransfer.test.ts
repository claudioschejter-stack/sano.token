import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'ethers';

const SAFE = '0xa993743CFB85E8d6481Ef60bb3D397F49604A592';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TARGET = '0x1234567890123456789012345678901234567890';

let treasuryBalance = parseUnits('40', 6);
const executed: Array<{ owner: string; target: string }> = [];
let hasSigner = true;

vi.mock('./treasuryOwnerSigner', () => ({
  resolveTreasuryOwnerSigner: async () =>
    hasSigner ? { getAddress: async () => '0x85CE193C49c0Cbf751F2180D2D91c084BC9E5eBA' } : null
}));
vi.mock('./explorerUrls', () => ({ resolveChainId: () => 8453 }));
vi.mock('./safeExec', () => ({
  execAsOwner: async (input: { owner: string; target: string }) => {
    executed.push({ owner: input.owner, target: input.target });
    return '0xtransfer';
  }
}));
vi.mock('../payments/paymentConfig', () => ({
  usdcDecimals: () => 6,
  usdcTokenAddress: () => USDC
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  class FakeContract {
    async balanceOf() {
      return treasuryBalance;
    }
  }
  return { ...actual, Contract: FakeContract };
});

const { transferTreasuryUsdc } = await import('./treasuryUsdcTransfer');

const provider = {} as never;

beforeEach(() => {
  executed.length = 0;
  treasuryBalance = parseUnits('40', 6);
  hasSigner = true;
  vi.stubEnv('BASE_STABLECOIN_TREASURY_ADDRESS', SAFE);
});

describe('transferTreasuryUsdc', () => {
  it('sends USDC out of the treasury Safe and reports what is left', async () => {
    const result = await transferTreasuryUsdc({ provider, to: TARGET, amountUsdc: 21 });
    expect(result).toMatchObject({ ok: true, amountUsdc: '21.0', remainingUsdc: '19.0' });
    expect(executed).toEqual([{ owner: SAFE, target: USDC }]);
  });

  it('refuses more than the treasury holds', async () => {
    const result = await transferTreasuryUsdc({ provider, to: TARGET, amountUsdc: 100 });
    expect(result).toMatchObject({ code: 'INSUFFICIENT_TREASURY_USDC' });
    expect(executed).toHaveLength(0);
  });

  it('refuses an amount above the per-call cap', async () => {
    treasuryBalance = parseUnits('10000', 6);
    const result = await transferTreasuryUsdc({ provider, to: TARGET, amountUsdc: 5000 });
    expect(result).toMatchObject({ code: 'AMOUNT_ABOVE_CAP' });
    expect(executed).toHaveLength(0);
  });

  it('refuses an invalid recipient', async () => {
    const result = await transferTreasuryUsdc({ provider, to: 'nope', amountUsdc: 1 });
    expect(result).toMatchObject({ code: 'INVALID_RECIPIENT' });
    expect(executed).toHaveLength(0);
  });

  it('refuses a zero or negative amount', async () => {
    expect(await transferTreasuryUsdc({ provider, to: TARGET, amountUsdc: 0 })).toMatchObject({
      code: 'INVALID_AMOUNT'
    });
    expect(executed).toHaveLength(0);
  });

  it('reports a missing signer instead of failing on-chain', async () => {
    hasSigner = false;
    const result = await transferTreasuryUsdc({ provider, to: TARGET, amountUsdc: 1 });
    expect(result).toMatchObject({ code: 'TREASURY_SIGNER_MISSING' });
    expect(executed).toHaveLength(0);
  });
});
