import { getPaymentCheckoutRowById } from './depositPaymentOptions';

/** Stripe Checkout session payment_method_types from catalog option id. */
export function stripePaymentMethodTypes(paymentOptionId?: string | null): string[] {
  if (!paymentOptionId) {
    return ['card'];
  }

  switch (paymentOptionId) {
    case 'apple_pay':
    case 'google_pay':
    case 'credit_card':
    case 'debit_card':
      return ['card'];
    case 'paypal':
      return process.env.PAYPAL_CLIENT_ID?.trim() ? ['paypal'] : ['card'];
    default:
      return ['card'];
  }
}

export function appendStripePaymentMethodTypes(params: URLSearchParams, paymentOptionId?: string | null) {
  for (const type of stripePaymentMethodTypes(paymentOptionId)) {
    params.append('payment_method_types[]', type);
  }
}

export function checkoutRowLabel(paymentOptionId?: string | null): string | null {
  if (!paymentOptionId) {
    return null;
  }
  return getPaymentCheckoutRowById(paymentOptionId)?.label ?? null;
}

export function isLocalRailManualResult(metadata?: Record<string, unknown> | null): boolean {
  return metadata?.mode === 'manual_reconciliation';
}
