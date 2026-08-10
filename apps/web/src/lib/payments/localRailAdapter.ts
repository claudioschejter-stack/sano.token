import { checkoutBaseUrl } from './paymentConfig';
import type { PaymentCheckoutRow } from './paymentCheckoutCatalog';

/**
 * El carril local de conciliación manual.
 *
 * Antes ruteaba a Wise, AstroPay y EBANX. Ninguno cobraba para Sanova y los tres
 * se retiraron: Macro cubre Argentina con su propio adapter y Bridge cubre el
 * resto. Queda el modo de conciliación manual, que es lo que usa un carril
 * habilitado sin integración automática.
 */

type LocalRailRequest = {
  depositId: string;
  amountUsd: number;
  row: Pick<PaymentCheckoutRow, 'id' | 'label' | 'provider' | 'providerRail'>;
  userEmail?: string | null;
  redirectPath?: string | null;
  country?: string | null;
};

type LocalRailResult = {
  provider: string;
  providerPaymentId?: string;
  providerCheckoutUrl?: string;
  metadata?: Record<string, unknown>;
};

export async function createLocalRailCheckout(input: LocalRailRequest): Promise<LocalRailResult> {
  if (process.env.LOCAL_RAILS_ENABLED === 'true') {
    return {
      provider: input.row.provider,
      providerPaymentId: input.depositId,
      metadata: {
        configured: true,
        rail: input.row.providerRail,
        optionId: input.row.id,
        label: input.row.label,
        mode: 'manual_reconciliation',
        instructions: `Pago ${input.row.label} pendiente de conciliación automática. Referencia: ${input.depositId}`
      }
    };
  }

  return {
    provider: input.row.provider,
    metadata: { configured: false, rail: input.row.providerRail, optionId: input.row.id }
  };
}

/** `checkoutBaseUrl` sigue usándose para armar los retornos del carril manual. */
export function localRailRedirectUrl(input: LocalRailRequest): string {
  return input.redirectPath
    ? `${checkoutBaseUrl()}${input.redirectPath}`
    : `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=success`;
}
