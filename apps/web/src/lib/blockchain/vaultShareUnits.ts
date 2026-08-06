import { Contract, JsonRpcProvider } from 'ethers';
import { readWithRetry } from './rpcRetry';

/**
 * Share amounts sized by the vault instead of by assumption.
 *
 * ERC-4626 reports `decimals()` as the asset's plus `_decimalsOffset()`, and the
 * offset was raised to 3 as an inflation-attack mitigation. So vaults deployed
 * before that change carry 18 decimals and every vault deployed after carries
 * 21, while the app multiplied token counts by a hardcoded 1e18 — which would
 * have handed a new asset's investors a thousandth of what they paid for, with
 * every balance in the audits reading a thousand times too high.
 *
 * Immutable per contract, so caching is safe. Never guess: sending the wrong
 * amount is worse than not sending.
 */

const DECIMALS_ABI = ['function decimals() view returns (uint8)'];
const cache = new Map<string, number>();

export async function readVaultShareDecimals(input: {
  provider: JsonRpcProvider;
  vaultAddress: string;
}): Promise<number | null> {
  const key = input.vaultAddress.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const vault = new Contract(input.vaultAddress, DECIMALS_ABI, input.provider);
  const raw = await readWithRetry(() => vault.decimals() as Promise<bigint>);
  if (raw === null) {
    return null;
  }

  const decimals = Number(raw);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    return null;
  }

  cache.set(key, decimals);
  return decimals;
}

/** One whole token of the asset, expressed in the vault's share units. */
export function vaultSharesForTokens(tokenCount: number, decimals: number): bigint {
  if (!Number.isInteger(tokenCount) || tokenCount <= 0) {
    return 0n;
  }
  return BigInt(tokenCount) * 10n ** BigInt(decimals);
}

/** Test seam: vault decimals never change, but a process can outlive a redeploy. */
export function clearVaultShareDecimalsCache(): void {
  cache.clear();
}
