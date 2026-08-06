import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'ethers';

const WALLET = '0x840aed84455C3a30Ef23a34a4D961BC3e1D06B41';
const TOKEN = '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1';
const VAULT = '0x125782B1302be9a2f58849f8A86F25F78009b367';
const TREASURY = '0xa993743CFB85E8d6481Ef60bb3D397F49604A592';

let project: Record<string, unknown> | null;
let usdcBalance = parseUnits('50', 6);
let shareBalance = 5000n * 10n ** 18n;
let timelock: Record<string, unknown> | null;
let canDeliver = true;
let operatorEth = parseUnits('0.005', 18);
/** Revert reason the simulated delivery should raise, or null when it passes. */
let deliveryRevert: string | null = null;

vi.mock('@sanova/database', () => ({
  prisma: { project: { findUnique: async () => project } }
}));
vi.mock('./paymentConfig', () => ({
  usdcDecimals: () => 6,
  usdcTokenAddress: () => '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
}));
vi.mock('../blockchain/treasuryPolicy', () => ({ resolveTreasuryAddress: () => TREASURY }));
vi.mock('../blockchain/rpcRetry', () => ({
  readWithRetry: async (fn: () => Promise<unknown>) => fn()
}));
vi.mock('../blockchain/scheduleTokenKyc', () => ({ readKycTimelock: async () => timelock }));
vi.mock('../blockchain/deliveryOperatorModule', () => ({
  deliveryOperatorModuleAddress: () => '0xF4384c85D67f54169D9BF6955ab3722e44217dD3',
  moduleCanDeliver: async () => canDeliver
}));
vi.mock('../privy/config', () => ({
  resolveRwaOperatorAddressEnv: () => '0x1AEBdA193D90bcdeC23584eB2d7043DFD515b856'
}));
vi.mock('../blockchain/investorVaultShareDelivery', () => ({
  vaultSharesForTokenCount: (count: number) => BigInt(count) * 10n ** 18n
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  class FakeContract {
    interface = { encodeFunctionData: () => '0x' };
    constructor(public address: string) {}
    async balanceOf() {
      return this.address.toLowerCase() === VAULT.toLowerCase() ? shareBalance : usdcBalance;
    }
    async decimals() {
      return 6n;
    }
  }
  class FakeProvider {
    async getBalance() {
      return operatorEth;
    }
    async call() {
      if (deliveryRevert) {
        throw new Error(`execution reverted: "${deliveryRevert}"`);
      }
      return '0x';
    }
    destroy() {}
  }
  return { ...actual, Contract: FakeContract, JsonRpcProvider: FakeProvider };
});

const { purchasePreflight } = await import('./purchasePreflight');

function checkOf(report: unknown, id: string) {
  const checks = (report as { checks: Array<{ id: string; ok: boolean; detail: string }> }).checks;
  return checks.find((row) => row.id === id);
}

beforeEach(() => {
  usdcBalance = parseUnits('50', 6);
  shareBalance = 5000n * 10n ** 18n;
  canDeliver = true;
  operatorEth = parseUnits('0.005', 18);
  deliveryRevert = null;
  timelock = { alreadyApproved: true, ready: true, readyAt: null, inSetupWindow: false };
  project = {
    id: 'p1',
    title: 'Activo',
    contractAddress: TOKEN,
    vaultAddress: VAULT,
    availableTokens: 100,
    pricePerToken: 10,
    isActive: true
  };
});

describe('purchasePreflight', () => {
  it('clears a purchase when every condition holds', async () => {
    const report = await purchasePreflight({
      projectId: 'p1',
      investorWallet: WALLET,
      tokenCount: 1
    });
    expect(report).toMatchObject({ canPurchase: true, amountUsd: 10 });
  });

  it('names an insufficient balance rather than letting settlement discover it', async () => {
    usdcBalance = parseUnits('3', 6);
    const report = await purchasePreflight({ projectId: 'p1', investorWallet: WALLET, tokenCount: 1 });

    expect((report as { canPurchase: boolean }).canPurchase).toBe(false);
    expect(checkOf(report, 'investor_usdc')?.ok).toBe(false);
    expect(checkOf(report, 'investor_usdc')?.detail).toContain('hacen falta 10');
  });

  it('distinguishes a running timelock from one never scheduled', async () => {
    const readyAt = Math.floor(Date.now() / 1000) + 3600;
    timelock = { alreadyApproved: false, ready: false, readyAt, inSetupWindow: false };
    let report = await purchasePreflight({ projectId: 'p1', investorWallet: WALLET, tokenCount: 1 });
    expect(checkOf(report, 'investor_whitelisted')?.detail).toContain('timelock corriendo');

    timelock = { alreadyApproved: false, ready: false, readyAt: null, inSetupWindow: false };
    report = await purchasePreflight({ projectId: 'p1', investorWallet: WALLET, tokenCount: 1 });
    expect(checkOf(report, 'investor_whitelisted')?.detail).toContain('sin agendar');
  });

  it('says the approval is pending execution once the wait is over', async () => {
    timelock = { alreadyApproved: false, ready: true, readyAt: 1, inSetupWindow: false };
    const report = await purchasePreflight({ projectId: 'p1', investorWallet: WALLET, tokenCount: 1 });
    expect(checkOf(report, 'investor_whitelisted')?.detail).toContain('falta ejecutar');
  });

  it('catches a treasury that cannot cover the shares', async () => {
    shareBalance = 0n;
    const report = await purchasePreflight({ projectId: 'p1', investorWallet: WALLET, tokenCount: 1 });
    expect(checkOf(report, 'treasury_shares')?.ok).toBe(false);
  });

  it('catches supply that would not cover the order', async () => {
    project = { ...(project as object), availableTokens: 0 };
    const report = await purchasePreflight({ projectId: 'p1', investorWallet: WALLET, tokenCount: 5 });
    expect(checkOf(report, 'supply_available')?.ok).toBe(false);
  });

  it('catches an operator without gas to deliver', async () => {
    operatorEth = 0n;
    const report = await purchasePreflight({ projectId: 'p1', investorWallet: WALLET, tokenCount: 1 });
    expect(checkOf(report, 'operator_gas')?.ok).toBe(false);
  });

  it('catches a delivery module that would refuse', async () => {
    canDeliver = false;
    const report = await purchasePreflight({ projectId: 'p1', investorWallet: WALLET, tokenCount: 1 });
    expect(checkOf(report, 'delivery_module')?.ok).toBe(false);
  });

  /**
   * The module's permissions were all green for the purchase that took the money
   * and then reverted: the vault refused the recipient for having code, which
   * only simulating the transfer can see.
   */
  it('catches a vault that would refuse the recipient even with the module green', async () => {
    deliveryRevert = 'SANOVA: contract receiver not allowed';
    const report = await purchasePreflight({ projectId: 'p1', investorWallet: WALLET, tokenCount: 1 });

    expect((report as { canPurchase: boolean }).canPurchase).toBe(false);
    expect(checkOf(report, 'delivery_simulation')?.ok).toBe(false);
    expect(checkOf(report, 'delivery_simulation')?.detail).toContain('contract receiver not allowed');
    expect(checkOf(report, 'delivery_module')?.ok).toBe(true);
  });

  it('passes the simulation when the delivery would go through', async () => {
    const report = await purchasePreflight({ projectId: 'p1', investorWallet: WALLET, tokenCount: 1 });
    expect(checkOf(report, 'delivery_simulation')?.ok).toBe(true);
  });

  it('rejects an address that is not one', async () => {
    expect(await purchasePreflight({ projectId: 'p1', investorWallet: 'nope', tokenCount: 1 })).toEqual(
      { error: 'INVALID_INVESTOR_WALLET' }
    );
  });

  it('reports a project that does not exist', async () => {
    project = null;
    expect(
      await purchasePreflight({ projectId: 'missing', investorWallet: WALLET, tokenCount: 1 })
    ).toEqual({ error: 'PROJECT_NOT_FOUND' });
  });
});
