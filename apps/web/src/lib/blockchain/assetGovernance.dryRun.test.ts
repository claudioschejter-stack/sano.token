import { beforeEach, describe, expect, it, vi } from 'vitest';

const GOVERNANCE_SAFE = '0xa993743CFB85E8d6481Ef60bb3D397F49604A592';
const LEGACY_SAFE = '0x5e7480c43f99cBCc90550a16356C90793c300d52';
const SAFE_OWNER = '0x85CE193C49c0Cbf751F2180D2D91c084BC9E5eBA';
const TOKEN = '0x1dD753e74C68E5Acfa4846D5336e7D552C999664';
const VAULT = '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089';

const executed: string[] = [];
let legacyThreshold = 1;

vi.mock('@sanova/database', () => ({
  prisma: {
    project: {
      findMany: async () => [
        { id: 'proj-apart', title: 'APART HOTEL', contractAddress: TOKEN, vaultAddress: VAULT }
      ]
    }
  }
}));

vi.mock('./safeExec', () => ({
  SAFE_ABI: [],
  execAsSafeOwner: async (input: { target: string }) => {
    executed.push(input.target);
    return '0xexec';
  },
  isSafeContract: async () => true,
  readSafeOwners: async () => [SAFE_OWNER.toLowerCase()],
  readSafeThreshold: async () => legacyThreshold
}));

vi.mock('./treasuryOwnerSigner', () => ({
  isTreasuryOwnerSignerConfigured: () => true,
  resolveTreasuryOwnerSigner: async () => ({ getAddress: async () => SAFE_OWNER })
}));

vi.mock('./kycOperatorModule', () => ({ kycOperatorModuleAddress: () => null }));
vi.mock('./rpcRetry', () => ({ readWithRetry: async (fn: () => Promise<unknown>) => fn() }));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  class FakeContract {
    interface = { encodeFunctionData: () => '0xdata' };
    constructor(
      public address: string,
      _abi: unknown,
      _runner: unknown
    ) {}
    async owner() {
      return LEGACY_SAFE;
    }
    async transferOwnership() {
      executed.push(this.address);
      return { hash: '0xdirect', wait: async () => ({ hash: '0xdirect' }) };
    }
  }
  class FakeProvider {
    destroy() {}
  }
  return {
    ...actual,
    Contract: FakeContract,
    JsonRpcProvider: FakeProvider,
    Wallet: class {
      async getAddress() {
        return '0x0000000000000000000000000000000000000009';
      }
    }
  };
});

const { enforceAssetGovernance } = await import('./assetGovernance');

beforeEach(() => {
  executed.length = 0;
  legacyThreshold = 1;
  vi.stubEnv('GOVERNANCE_SAFE_ADDRESS', GOVERNANCE_SAFE);
  vi.stubEnv('TOKEN_DEPLOY_PRIVATE_KEY', '');
  vi.stubEnv('TREASURY_OWNER_PRIVATE_KEY', '');
});

describe('enforceAssetGovernance dryRun', () => {
  it('plans a step per contract instead of returning nothing', async () => {
    const { steps } = await enforceAssetGovernance({ dryRun: true });
    expect(steps).toHaveLength(2);
    expect(steps.every((step) => step.action === 'transfer_ownership')).toBe(true);
  });

  it('names the wallet that would sign, so the plan is verifiable', async () => {
    const { steps } = await enforceAssetGovernance({ dryRun: true });
    expect(steps[0].detail).toContain(SAFE_OWNER);
    expect(steps[0].detail).toContain(LEGACY_SAFE);
    expect(steps[0].ok).toBe(true);
  });

  it('broadcasts nothing', async () => {
    await enforceAssetGovernance({ dryRun: true });
    expect(executed).toHaveLength(0);
  });

  it('warns when the legacy Safe would need more signatures', async () => {
    legacyThreshold = 2;
    const { steps } = await enforceAssetGovernance({ dryRun: true });
    expect(steps[0].ok).toBe(false);
    expect(steps[0].error).toContain('SAFE_THRESHOLD_2');
  });

  it('executes for real when dryRun is off', async () => {
    await enforceAssetGovernance({});
    expect(executed).toEqual([TOKEN, VAULT]);
  });
});
