import type { TokenStandard } from './launchTypes';

/** Vault share standards compatible with Morpho collateral and Centrifuge async RWA pools. */
export const VAULT_TOKEN_STANDARDS = ['ERC4626', 'ERC7540'] as const;

export type VaultTokenStandard = (typeof VAULT_TOKEN_STANDARDS)[number];

export function isVaultTokenStandard(
  standard: string | null | undefined
): standard is VaultTokenStandard {
  return standard === 'ERC4626' || standard === 'ERC7540';
}

/** ERC-7540 extends ERC-4626 with async deposit/redeem (Centrifuge v3 pattern). */
export function isAsyncVaultStandard(standard: string | null | undefined): boolean {
  return standard === 'ERC7540';
}

export function defaultVaultStandardForChain(chainId: number): VaultTokenStandard {
  // Plume RWA issuance defaults to async vault for Centrifuge onboarding.
  if (chainId === 98866 || chainId === 98867) {
    return 'ERC7540';
  }
  return 'ERC4626';
}

export function vaultStandardLabel(standard: TokenStandard | string): string {
  if (standard === 'ERC7540') {
    return 'ERC-7540 (async vault)';
  }
  if (standard === 'ERC4626') {
    return 'ERC-4626 (sync vault)';
  }
  return standard;
}
