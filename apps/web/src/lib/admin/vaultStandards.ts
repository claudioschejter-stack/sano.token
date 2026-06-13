import type { TokenStandard } from './launchTypes';

/** Vault share standard compatible with Morpho collateral on Base. */
export const VAULT_TOKEN_STANDARDS = ['ERC4626'] as const;

export type VaultTokenStandard = (typeof VAULT_TOKEN_STANDARDS)[number];

export function isVaultTokenStandard(
  standard: string | null | undefined
): standard is VaultTokenStandard {
  return standard === 'ERC4626';
}

export function defaultVaultStandardForChain(_chainId: number): VaultTokenStandard {
  return 'ERC4626';
}

export function vaultStandardLabel(standard: TokenStandard | string): string {
  if (standard === 'ERC4626') {
    return 'ERC-4626 (Morpho vault)';
  }
  return standard;
}
