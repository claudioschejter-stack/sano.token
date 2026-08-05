import { afterEach, describe, expect, it, vi } from 'vitest';
import KycOperatorModuleArtifact from './artifacts/SanovaKycOperatorModule.json';
import { kycOperatorModuleAddress } from './kycOperatorModule';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SanovaKycOperatorModule artifact', () => {
  it('exposes only whitelisting and Safe-governed configuration', () => {
    const fns = KycOperatorModuleArtifact.abi
      .filter((entry: { type: string }) => entry.type === 'function')
      .map((entry: { name: string }) => entry.name)
      .sort();

    expect(fns).toEqual([
      'isOperator',
      'isTokenAllowed',
      'kycActionId',
      'safe',
      'scheduleKyc',
      'setKyc',
      'setKycBatch',
      'setOperator',
      'setTokenAllowed'
    ]);
  });

  it('only lets scheduling name a whitelisting, never an arbitrary action', () => {
    const schedule = KycOperatorModuleArtifact.abi.find(
      (entry: { type: string; name?: string }) =>
        entry.type === 'function' && entry.name === 'scheduleKyc'
    ) as { inputs: Array<{ type: string }> };

    // No bytes32 argument: the action id is derived inside the module, so an
    // operator cannot schedule a mint, an unpause or a delay change.
    expect(schedule.inputs.map((row) => row.type)).toEqual(['address', 'address', 'bool']);
    expect(schedule.inputs.some((row) => row.type === 'bytes32')).toBe(false);
  });

  it('cannot mint, pause or transfer ownership', () => {
    const fns = KycOperatorModuleArtifact.abi
      .filter((entry: { type: string }) => entry.type === 'function')
      .map((entry: { name: string }) => entry.name);

    for (const forbidden of ['mint', 'pause', 'transferOwnership', 'transfer']) {
      expect(fns).not.toContain(forbidden);
    }
  });

  it('ships deployable bytecode', () => {
    expect(KycOperatorModuleArtifact.bytecode.startsWith('0x')).toBe(true);
    expect(KycOperatorModuleArtifact.bytecode.length).toBeGreaterThan(200);
  });
});

describe('kycOperatorModuleAddress', () => {
  it('is null when unset', () => {
    expect(kycOperatorModuleAddress()).toBeNull();
  });

  it('ignores blank or invalid values', () => {
    vi.stubEnv('KYC_OPERATOR_MODULE_ADDRESS', '');
    expect(kycOperatorModuleAddress()).toBeNull();
    vi.stubEnv('KYC_OPERATOR_MODULE_ADDRESS', 'not-an-address');
    expect(kycOperatorModuleAddress()).toBeNull();
  });

  it('normalises a configured address', () => {
    vi.stubEnv('KYC_OPERATOR_MODULE_ADDRESS', '0x1aebda193d90bcdec23584eb2d7043dfd515b856');
    expect(kycOperatorModuleAddress()).toBe('0x1AEBdA193D90bcdeC23584eB2d7043DFD515b856');
  });
});
