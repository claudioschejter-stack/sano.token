import { describe, expect, it, vi } from 'vitest';

const waitForAutomationTx = vi.fn(async (tx: { hash: string }) => ({ hash: tx.hash }));
vi.mock('./automationTx', () => ({ waitForAutomationTx }));

const contractCalls: Array<{ address: string; args: unknown[] }> = [];

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  class FakeContract {
    constructor(
      private address: string,
      _abi: unknown,
      private runner: { __owners: string[]; __threshold: number }
    ) {}

    async getOwners() {
      return this.runner.__owners;
    }

    async getThreshold() {
      return BigInt(this.runner.__threshold);
    }

    async execTransaction(...args: unknown[]) {
      contractCalls.push({ address: this.address, args });
      return { hash: '0xexec' };
    }
  }
  return { ...actual, Contract: FakeContract };
});

const { execAsSafeOwner, execAsOwner } = await import('./safeExec');

const SAFE = '0x1111111111111111111111111111111111111111';
const OWNER = '0x2222222222222222222222222222222222222222';
const TARGET = '0x3333333333333333333333333333333333333333';

function signer(options: { owners: string[]; threshold: number; code?: string; address?: string }) {
  return {
    __owners: options.owners,
    __threshold: options.threshold,
    getAddress: async () => options.address ?? OWNER,
    provider: { getCode: async () => options.code ?? '0x60' },
    sendTransaction: async () => ({ hash: '0xeoa' })
  } as never;
}

describe('execAsSafeOwner', () => {
  it('sends a pre-validated owner signature, never an empty one', async () => {
    contractCalls.length = 0;
    await execAsSafeOwner({
      safe: SAFE,
      signer: signer({ owners: [OWNER.toLowerCase()], threshold: 1 }),
      target: TARGET,
      data: '0xdeadbeef'
    });

    const signatures = contractCalls[0]?.args[9] as string;
    expect(signatures).not.toBe('0x');
    expect(signatures.toLowerCase()).toContain(OWNER.slice(2).toLowerCase());
  });

  it('refuses to sign when the wallet is not a Safe owner', async () => {
    await expect(
      execAsSafeOwner({
        safe: SAFE,
        signer: signer({ owners: ['0x9999999999999999999999999999999999999999'], threshold: 1 }),
        target: TARGET,
        data: '0x'
      })
    ).rejects.toThrow(/SIGNER_NOT_SAFE_OWNER/);
  });

  it('stops before broadcasting when the Safe needs more signatures', async () => {
    await expect(
      execAsSafeOwner({
        safe: SAFE,
        signer: signer({ owners: [OWNER.toLowerCase()], threshold: 2 }),
        target: TARGET,
        data: '0x'
      })
    ).rejects.toThrow(/SAFE_THRESHOLD_2/);
  });
});

describe('execAsOwner', () => {
  it('sends a plain transaction when the owner is an EOA the signer controls', async () => {
    const hash = await execAsOwner({
      owner: OWNER,
      signer: signer({ owners: [], threshold: 1, code: '0x' }),
      target: TARGET,
      data: '0x'
    });
    expect(hash).toBe('0xeoa');
  });

  it('rejects an EOA owner the signer does not control', async () => {
    await expect(
      execAsOwner({
        owner: SAFE,
        signer: signer({ owners: [], threshold: 1, code: '0x' }),
        target: TARGET,
        data: '0x'
      })
    ).rejects.toThrow(/SIGNER_NOT_OWNER_EOA/);
  });

  it('routes through the Safe when the owner is a contract', async () => {
    contractCalls.length = 0;
    await execAsOwner({
      owner: SAFE,
      signer: signer({ owners: [OWNER.toLowerCase()], threshold: 1 }),
      target: TARGET,
      data: '0x'
    });
    expect(contractCalls[0]?.address).toBe(SAFE);
  });
});
