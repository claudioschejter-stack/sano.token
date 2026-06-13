import { describe, expect, it } from 'vitest';
import { defaultVaultStandardForChain, isVaultTokenStandard } from './vaultStandards';
import { BASE_MAINNET_CHAIN_ID } from '../blockchain/supportedChains';

describe('vaultStandards', () => {
  it('treats ERC-4626 as the Morpho vault standard', () => {
    expect(isVaultTokenStandard('ERC4626')).toBe(true);
    expect(isVaultTokenStandard('SANOVA_KYC')).toBe(false);
  });

  it('defaults Base mainnet to ERC-4626', () => {
    expect(defaultVaultStandardForChain(BASE_MAINNET_CHAIN_ID)).toBe('ERC4626');
  });
});
