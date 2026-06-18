import { getPaymentCheckoutRowById } from './depositPaymentOptions';

/** Stripe Checkout session payment_method_types from catalog option id. */
export function stripePaymentMethodTypes(paymentOptionId?: string | null): string[] {
  if (!paymentOptionId) {
    return ['card', 'link'];
  }

  switch (paymentOptionId) {
    case 'apple_pay':
    case 'google_pay':
    case 'credit_card':
    case 'debit_card':
      return ['card', 'link'];
    case 'paypal':
      return process.env.PAYPAL_CLIENT_ID?.trim() || process.env.STRIPE_PAYPAL_ENABLED === 'true'
        ? ['paypal']
        : ['card', 'link'];
    default:
      return ['card', 'link'];
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

export function isRipioOnRampResult(metadata?: Record<string, unknown> | null): boolean {
  return metadata?.mode === 'ripio_on_ramp';
}

export function isPrivyClientFundResult(metadata?: Record<string, unknown> | null): boolean {
  return metadata?.mode === 'privy_client_fund';
}

export function isPendingManualGatewayResult(metadata?: Record<string, unknown> | null): boolean {
  return isLocalRailManualResult(metadata) || isRipioOnRampResult(metadata);
}

export function isWiseManualResult(metadata?: Record<string, unknown> | null): boolean {
  return metadata?.mode === 'manual_reconciliation' && metadata?.provider === 'wise';
}
