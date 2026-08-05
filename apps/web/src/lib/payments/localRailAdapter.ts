import { checkoutBaseUrl } from './paymentConfig';
import type { PaymentCheckoutRow } from './paymentCheckoutCatalog';
import { createEbanxPayment } from './ebanxAdapter';
import { createWiseManualCheckout } from './wiseManualCheckout';

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

function redirectUrl(input: LocalRailRequest): string {
  return input.redirectPath
    ? `${checkoutBaseUrl()}${input.redirectPath}`
    : `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=success`;
}

function backUrl(input: LocalRailRequest): string {
  return input.redirectPath
    ? `${checkoutBaseUrl()}${input.redirectPath.replace('status=success', 'status=cancelled')}`
    : `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=cancelled`;
}

export function createAstroPayCheckout(input: LocalRailRequest): LocalRailResult {
  const apiKey = process.env.ASTROPAY_API_KEY?.trim();
  if (!apiKey) {
    return { provider: 'astropay', metadata: { configured: false, rail: input.row.providerRail } };
  }

  const params = new URLSearchParams({
    amount: input.amountUsd.toFixed(2),
    currency: 'USD',
    external_reference: input.depositId,
    return_url: redirectUrl(input)
  });

  return {
    provider: 'astropay',
    providerPaymentId: input.depositId,
    providerCheckoutUrl: `https://onetouch-api.astropay.com/MerchantTools/MerchantTools.svc/CreatePayment?${params.toString()}`,
    metadata: { configured: true, rail: input.row.providerRail, optionId: input.row.id, mode: 'redirect' }
  };
}


export async function createLocalRailCheckout(input: LocalRailRequest): Promise<LocalRailResult> {
  if (input.row.provider === 'wise') {
    const wise = createWiseManualCheckout({
      referenceId: input.depositId,
      amountUsd: input.amountUsd,
      label: input.row.label
    });
    return {
      provider: 'wise',
      providerPaymentId: wise.providerPaymentId,
      metadata: wise.metadata
    };
  }

  if (input.row.provider === 'astropay') {
    const astro = createAstroPayCheckout(input);
    if (astro.metadata?.configured) {
      return astro;
    }
  }

  if (input.row.provider === 'ebanx') {
    const ebanx = await createEbanxPayment({
      externalId: input.depositId,
      amountUsd: input.amountUsd,
      country: input.country ?? 'BR',
      paymentTypeCode: input.row.providerRail,
      userEmail: input.userEmail,
      successUrl: redirectUrl(input),
      backUrl: backUrl(input),
      name: input.row.label
    });
    if (ebanx.metadata?.configured && ebanx.providerCheckoutUrl) {
      return {
        provider: 'ebanx',
        providerPaymentId: ebanx.providerPaymentId,
        providerCheckoutUrl: ebanx.providerCheckoutUrl,
        metadata: {
          ...ebanx.metadata,
          rail: input.row.providerRail,
          optionId: input.row.id,
          label: input.row.label
        }
      };
    }
  }

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
