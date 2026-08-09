/**
 * Name an asset by its token code, not by its title.
 *
 * Añelo has two Urban View buildings, UV2 and UV3, with separate tokens, vaults
 * and investors. Their titles carry the same words in a different order —
 * "APART HOTEL URBAN VIEW - AÑELO" and "AÑELO - APART HOTEL URBAN VIEW" — and
 * neither mentions UV2 or UV3. Two alerts about "APART HOTEL URBAN VIEW - AÑELO"
 * are indistinguishable, and acting on the wrong contract is worse than not
 * acting: one of them holds investors' money.
 *
 * So the code leads. `[UV3RWA] AÑELO - APART HOTEL URBAN VIEW` can be read wrong
 * only by ignoring the first thing on the line.
 */

export type AssetIdentity = {
  title: string;
  tokenSymbol?: string | null;
  contractAddress?: string | null;
};

/** Short, stable identifier: the token symbol, else the token address. */
export function assetCode(asset: AssetIdentity): string | null {
  const symbol = asset.tokenSymbol?.trim();
  if (symbol) return symbol;

  // Not deployed yet, or deployed without a symbol: the address still separates it.
  const address = asset.contractAddress?.trim();
  if (address) {
    return address.length > 12 ? `${address.slice(0, 10)}…` : address;
  }

  return null;
}

export function assetAlertLabel(asset: AssetIdentity): string {
  const code = assetCode(asset);
  return code ? `[${code}] ${asset.title}` : asset.title;
}
