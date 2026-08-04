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
      'safe',
      'setKyc',
      'setKycBatch',
      'setOperator',
      'setTokenAllowed'
    ]);
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
