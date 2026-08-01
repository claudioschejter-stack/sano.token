import { afterEach, describe, expect, it } from 'vitest';
import { parseMorphoVaultConfigs } from './morphoEarnService';

describe('parseMorphoVaultConfigs', () => {
  afterEach(() => {
    delete process.env.MORPHO_VAULT_ADDRESSES;
  });

  it('defaults to Gauntlet + Steakhouse High Yield v1.1 (non-idle)', () => {
    delete process.env.MORPHO_VAULT_ADDRESSES;
    const configs = parseMorphoVaultConfigs();
    expect(configs).toHaveLength(2);
    expect(configs[1]?.address.toLowerCase()).toBe(
      '0xbeefa7b88064feef0cee02aaebbd95d30df3878f'
    );
  });
});
