/** Resolve localized label for a payment checkout row by id. */
export function resolvePaymentCheckoutLabel(
  optionId: string,
  fallbackLabel: string,
  paymentMethods: Record<string, string> | undefined
): string {
  const localized = paymentMethods?.[optionId];
  return localized?.trim() ? localized : fallbackLabel;
}
