import { describe, expect, it } from 'vitest';
import {
  defaultVaultStandardForChain,
  isAsyncVaultStandard,
  isVaultTokenStandard
} from './vaultStandards';
import { PLUME_MAINNET_CHAIN_ID } from '../blockchain/supportedChains';

describe('vaultStandards', () => {
  it('treats ERC-4626 and ERC-7540 as vault standards', () => {
    expect(isVaultTokenStandard('ERC4626')).toBe(true);
    expect(isVaultTokenStandard('ERC7540')).toBe(true);
    expect(isVaultTokenStandard('SANOVA_KYC')).toBe(false);
  });

  it('flags ERC-7540 as async vault', () => {
    expect(isAsyncVaultStandard('ERC7540')).toBe(true);
    expect(isAsyncVaultStandard('ERC4626')).toBe(false);
  });

  it('defaults Plume to ERC-7540', () => {
    expect(defaultVaultStandardForChain(PLUME_MAINNET_CHAIN_ID)).toBe('ERC7540');
    expect(defaultVaultStandardForChain(8453)).toBe('ERC4626');
  });
});
