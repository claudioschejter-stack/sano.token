/**
 * Name an asset in a way that says *which* asset.
 *
 * Añelo has two Urban View buildings, UV2 and UV3, with separate tokens, vaults
 * and investors. Their titles carry the same words in a different order —
 * "APART HOTEL URBAN VIEW - AÑELO" and "AÑELO - APART HOTEL URBAN VIEW" — and
 * neither mentions UV2 or UV3. Two alerts arriving about "APART HOTEL URBAN
 * VIEW - AÑELO" are indistinguishable, and acting on the wrong contract is worse
 * than not acting: one of them holds investors' money.
 *
 * The token symbol is what actually separates them (`ANELO UV2 RWA` vs
 * `UV3RWA`), so it belongs wherever the asset is named for an operator.
 */
export function assetAlertLabel(asset: {
  title: string;
  tokenSymbol?: string | null;
  contractAddress?: string | null;
}): string {
  const symbol = asset.tokenSymbol?.trim();
  if (symbol) {
    return `${asset.title} [${symbol}]`;
  }

  // No symbol yet (asset not deployed): the address is the next best identifier.
  const address = asset.contractAddress?.trim();
  if (address) {
    return `${asset.title} [${address.slice(0, 10)}…]`;
  }

  return asset.title;
}
