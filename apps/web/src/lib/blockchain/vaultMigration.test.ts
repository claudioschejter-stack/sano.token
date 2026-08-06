import { beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1';
const VAULT = '0x125782B1302be9a2f58849f8A86F25F78009b367';
const TREASURY = '0xa993743CFB85E8d6481Ef60bb3D397F49604A592';

let asset: Record<string, unknown> | null;
let totalSupply = 5000n * 10n ** 18n;
let treasuryShares = 5000n * 10n ** 18n;
let create2FactoryCode = '0x60806040';
let kycTimelock: Record<string, unknown> | null = {
  ready: true,
  readyAt: null,
  alreadyApproved: false,
  inSetupWindow: false
};

vi.mock('../admin/assetsService', () => ({
  getAdminAsset: async () => asset,
  updateAdminAsset: async () => asset,
  appendDeploymentEvent: async () => asset
}));
vi.mock('./treasuryPolicy', () => ({ resolveTreasuryAddress: () => TREASURY }));
vi.mock('./treasuryOwnerSigner', () => ({
  resolveTreasuryOwnerSigner: async () => ({ getAddress: async () => TREASURY })
}));
vi.mock('./explorerUrls', () => ({ resolveChainId: () => 8453 }));
vi.mock('./safeExec', () => ({ execAsOwner: async () => '0xdead' }));
vi.mock('./rpcRetry', () => ({ readWithRetry: async (fn: () => Promise<unknown>) => fn() }));
vi.mock('./vaultShareUnits', () => ({
  readVaultShareDecimals: async () => 18,
  vaultSharesForTokens: (count: number, decimals: number) =>
    BigInt(count) * 10n ** BigInt(decimals)
}));
vi.mock('./vaultRecipientAllowlist', () => ({
  ensureVaultRecipientAllowed: async () => ({ ok: true, status: 'ALREADY_ALLOWED' }),
  setVaultAdminDelay: async () => ({ ok: true, status: 'APPLIED', txHash: '0x1', delaySeconds: 3600 })
}));
vi.mock('./kycAllowlist', () => ({ setInvestorKycAllowlist: async () => ({ txHash: '0x2' }) }));
vi.mock('./scheduleTokenKyc', () => ({
  scheduleTokenKyc: async () => ({ ok: false, code: 'X' }),
  readKycTimelock: async () => kycTimelock
}));
vi.mock('./deliveryOperatorModule', () => ({
  deliveryOperatorModuleAddress: () => null,
  setupDeliveryOperatorModule: async () => ({ steps: [] })
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  class FakeContract {
    interface = { encodeFunctionData: () => '0x' };
    constructor(public address: string) {}
    async totalSupply() {
      return totalSupply;
    }
    async balanceOf() {
      return treasuryShares;
    }
    async name() {
      return 'Sanova Vault';
    }
    async symbol() {
      return 'vSNVA';
    }
  }
  class FakeProvider {
    async getCode() {
      return create2FactoryCode;
    }
    destroy() {}
  }
  return { ...actual, Contract: FakeContract, JsonRpcProvider: FakeProvider };
});

const { advanceVaultMigration } = await import('./vaultMigration');

function stepOf(report: { steps: Array<{ step: string; status: string; detail: string }> }, step: string) {
  return report.steps.find((row) => row.step === step);
}

beforeEach(() => {
  totalSupply = 5000n * 10n ** 18n;
  treasuryShares = 5000n * 10n ** 18n;
  create2FactoryCode = '0x60806040';
  kycTimelock = { ready: true, readyAt: null, alreadyApproved: false, inSetupWindow: false };
  asset = {
    id: 'p1',
    title: 'Activo',
    contractAddress: TOKEN,
    vaultAddress: VAULT,
    totalTokens: 5000,
    chainId: 8453,
    collateralTargets: [],
    deploymentEvents: []
  };
});

/**
 * The migration redeems the treasury's shares and re-deposits them elsewhere.
 * Doing that while an investor holds shares of the old vault would strand their
 * balance in a vault the platform no longer points at, so the guard that stops
 * it is the one thing here that protects somebody else's property.
 */
describe('advanceVaultMigration', () => {
  it('refuses when anyone other than the treasury holds shares', async () => {
    treasuryShares = 4999n * 10n ** 18n;

    const report = await advanceVaultMigration({ projectId: 'p1', dryRun: true });

    expect(report.done).toBe(false);
    expect(stepOf(report, 'prechecks')?.status).toBe('BLOCKED');
    expect(stepOf(report, 'prechecks')?.detail).toContain('1.0 shares fuera de la tesorería');
  });

  it('plans the migration when the treasury is the sole holder', async () => {
    const report = await advanceVaultMigration({ projectId: 'p1', dryRun: true });

    expect(stepOf(report, 'prechecks')?.status).toBe('OK');
    expect(stepOf(report, 'plan')?.status).toBe('PENDING');
  });

  it('stops on a registered Morpho market unless forced', async () => {
    asset = {
      ...(asset as object),
      collateralTargets: [{ protocol: 'MORPHO', status: 'REGISTERED', externalId: '0xmarket' }]
    };

    const blocked = await advanceVaultMigration({ projectId: 'p1', dryRun: true });
    expect(stepOf(blocked, 'morpho')?.status).toBe('BLOCKED');

    const forced = await advanceVaultMigration({ projectId: 'p1', dryRun: true, force: true });
    expect(stepOf(forced, 'morpho')?.status).toBe('SKIPPED');
  });

  /**
   * The deployment used to be the last step needing a bare private key, which is
   * exactly what moving governance into the Safe was meant to retire.
   */
  it('plans to deploy through the Safe when the CREATE2 proxy is present', async () => {
    const report = await advanceVaultMigration({ projectId: 'p1', dryRun: true });

    expect(stepOf(report, 'deployer')?.status).toBe('OK');
    expect(stepOf(report, 'deployer')?.detail).toContain('no hace falta ninguna clave suelta');
  });

  it('warns that a key would be needed where no CREATE2 proxy exists', async () => {
    create2FactoryCode = '0x';
    const report = await advanceVaultMigration({ projectId: 'p1', dryRun: true });

    expect(stepOf(report, 'deployer')?.status).toBe('PENDING');
    expect(stepOf(report, 'deployer')?.detail).toContain('TOKEN_DEPLOY_PRIVATE_KEY');
  });

  it('reports a project that does not exist', async () => {
    asset = null;
    const report = await advanceVaultMigration({ projectId: 'missing', dryRun: true });
    expect(stepOf(report, 'project')?.detail).toBe('PROJECT_NOT_FOUND');
  });
});
