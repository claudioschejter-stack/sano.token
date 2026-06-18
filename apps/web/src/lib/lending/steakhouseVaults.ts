/**
 * Steakhouse Financial MetaMorpho vault routing on Base.
 * @see https://steakhouse.financial
 */

export type SteakhouseVaultConfig = {
  address: string;
  label: string;
  curator: 'steakhouse';
};

/** Comma-separated vault addresses from env, e.g. STEAKHOUSE_VAULT_ADDRESSES=0xabc…,0xdef… */
export function steakhouseVaultAddresses(): string[] {
  const raw = process.env.STEAKHOUSE_VAULT_ADDRESSES?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((row) => row.trim().toLowerCase())
    .filter(Boolean);
}

export function isSteakhouseVault(vaultAddress: string | null | undefined): boolean {
  if (!vaultAddress?.trim()) {
    return false;
  }
  const normalized = vaultAddress.trim().toLowerCase();
  return steakhouseVaultAddresses().includes(normalized);
}

export function resolveSteakhouseVaults(): SteakhouseVaultConfig[] {
  return steakhouseVaultAddresses().map((address, index) => ({
    address,
    label: process.env.STEAKHOUSE_VAULT_LABEL?.trim() || `Steakhouse Vault ${index + 1}`,
    curator: 'steakhouse' as const
  }));
}

/** Prefer Steakhouse curator vault when configured; else fall back to project MetaMorpho vault. */
export function resolvePreferredMorphoVault(projectVaultAddress: string | null | undefined): string | null {
  const steakhouse = steakhouseVaultAddresses();
  if (steakhouse.length > 0) {
    return steakhouse[0];
  }
  return projectVaultAddress?.trim() ?? null;
}
