/** Catalog option IDs where USDC may be paid from a connected EVM wallet ≠ linked Sanova wallet. */
export const EXTERNAL_USDC_PAYMENT_OPTION_IDS = [
  'walletconnect_usdc',
  'electronic_wallet',
  'metamask_usdc'
] as const;

export type ExternalUsdcPaymentOptionId = (typeof EXTERNAL_USDC_PAYMENT_OPTION_IDS)[number];

export function isExternalUsdcPaymentOptionId(
  value: unknown
): value is ExternalUsdcPaymentOptionId {
  return (
    typeof value === 'string' &&
    (EXTERNAL_USDC_PAYMENT_OPTION_IDS as readonly string[]).includes(value)
  );
}
