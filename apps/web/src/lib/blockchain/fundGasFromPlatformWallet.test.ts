import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther } from 'ethers';

const balances = new Map<string, bigint>();
const sent: Array<{ from: string; to: string; value: bigint }> = [];

const OPERATOR = '0x1111111111111111111111111111111111111111';
const SAFE_OWNER = '0x2222222222222222222222222222222222222222';
const MORPHO = '0x3333333333333333333333333333333333333333';
const TARGET = '0x4444444444444444444444444444444444444444';

function signerFor(address: string) {
  return {
    getAddress: async () => address,
    sendTransaction: async ({ to, value }: { to: string; value: bigint }) => {
      sent.push({ from: address, to, value });
      return { hash: `0xtx-${address.slice(2, 6)}` };
    }
  };
}

vi.mock('./rwaOperatorSigner', () => ({
  resolveRwaOperatorSigner: async () => signerFor(OPERATOR)
}));
vi.mock('./treasuryOwnerSigner', () => ({
  resolveTreasuryOwnerSigner: async () => signerFor(SAFE_OWNER)
}));
vi.mock('./morphoLiquiditySigner', () => ({
  resolveMorphoLiquiditySigner: async () => signerFor(MORPHO)
}));
vi.mock('./automationTx', () => ({
  waitForAutomationTx: async (tx: { hash: string }) => ({ hash: tx.hash })
}));

const { fundGasFromPlatformWallet, listGasSources } = await import('./fundGasFromPlatformWallet');

const provider = {
  getBalance: async (address: string) => balances.get(address) ?? 0n
} as never;

beforeEach(() => {
  sent.length = 0;
  balances.clear();
  balances.set(OPERATOR, parseEther('0.015'));
  balances.set(SAFE_OWNER, parseEther('0.013'));
  balances.set(MORPHO, parseEther('0.0028'));
});

describe('fundGasFromPlatformWallet', () => {
  it('sends from the wallet that can spare the most', async () => {
    const result = await fundGasFromPlatformWallet({ provider, to: TARGET, amountEth: 0.003 });
    expect(result.ok).toBe(true);
    expect(sent[0].from).toBe(OPERATOR);
    expect(sent[0].value).toBe(parseEther('0.003'));
  });

  it('honours an explicit source', async () => {
    await fundGasFromPlatformWallet({
      provider,
      to: TARGET,
      amountEth: 0.003,
      from: 'safe_owner'
    });
    expect(sent[0].from).toBe(SAFE_OWNER);
  });

  it('leaves the source enough to keep signing', async () => {
    // Morpho holds 0.0028 and the reserve is 0.002, so it cannot spare 0.003.
    const result = await fundGasFromPlatformWallet({
      provider,
      to: TARGET,
      amountEth: 0.003,
      from: 'morpho_liquidity'
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: 'NO_SOURCE_WITH_ENOUGH_ETH' });
    expect(sent).toHaveLength(0);
  });

  it('refuses an amount above the per-call cap', async () => {
    const result = await fundGasFromPlatformWallet({ provider, to: TARGET, amountEth: 0.5 });
    expect(result).toMatchObject({ code: 'AMOUNT_ABOVE_CAP' });
    expect(sent).toHaveLength(0);
  });

  it('refuses an invalid recipient', async () => {
    const result = await fundGasFromPlatformWallet({
      provider,
      to: 'no-es-una-direccion',
      amountEth: 0.003
    });
    expect(result).toMatchObject({ code: 'INVALID_RECIPIENT' });
    expect(sent).toHaveLength(0);
  });

  it('refuses a zero or negative amount', async () => {
    expect(
      await fundGasFromPlatformWallet({ provider, to: TARGET, amountEth: 0 })
    ).toMatchObject({ code: 'INVALID_AMOUNT' });
    expect(sent).toHaveLength(0);
  });

  it('reports what each wallet could spare, net of its reserve', async () => {
    const sources = await listGasSources(provider);
    expect(sources.find((row) => row.role === 'rwa_operator')?.availableEth).toBe('0.01');
    expect(sources.find((row) => row.role === 'morpho_liquidity')?.availableEth).toBe('0.0008');
  });
});
