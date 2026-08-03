/** Round to USDC precision (6 decimals). */
export function roundUsdc(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Format USD/USDC amounts without rounding away sub-cent gas (e.g. 20.000721 → "20.000721").
 * Always keeps at least 2 decimals; keeps up to 6 when needed.
 */
export function formatUsdPrecise(value: number): string {
  const rounded = roundUsdc(value);
  const fixed = Math.abs(rounded).toFixed(6);
  const [whole, fraction = '000000'] = fixed.split('.');
  const trimmedFrac = fraction.replace(/0+$/, '');
  const decimals = trimmedFrac.length <= 2 ? fraction.slice(0, 2) : trimmedFrac;
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${whole}.${decimals}`;
}
