import { getPaymentCheckoutRowById } from './depositPaymentOptions';

/**
 * Cómo leer el resultado de un checkout, según el modo que dejó el adapter.
 *
 * Antes vivía en `stripeCheckoutOptions.ts` junto a los tipos de método de pago
 * de Stripe. Stripe se retiró y estos helpers no tenían nada que ver con él:
 * quedaban en un archivo que mentía sobre su contenido.
 */

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
