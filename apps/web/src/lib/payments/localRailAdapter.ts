import { checkoutBaseUrl } from './paymentConfig';
import type { PaymentCheckoutRow } from './paymentCheckoutCatalog';

type LocalRailRequest = {
  depositId: string;
  amountUsd: number;
  row: Pick<PaymentCheckoutRow, 'id' | 'label' | 'provider' | 'providerRail'>;
  userEmail?: string | null;
  redirectPath?: string | null;
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
    metadata: { configured: true, rail: input.row.providerRail, optionId: input.row.id }
  };
}

export function createDLocalCheckout(input: LocalRailRequest): LocalRailResult {
  const apiKey = process.env.DLOCAL_API_KEY?.trim();
  if (!apiKey) {
    return {
      provider: 'dlocal',
      metadata: { configured: false, rail: input.row.providerRail, optionId: input.row.id }
    };
  }

  const base = (process.env.DLOCAL_CHECKOUT_BASE_URL ?? 'https://checkout.dlocal.com').replace(/\/$/, '');
  const params = new URLSearchParams({
    amount: input.amountUsd.toFixed(2),
    currency: 'USD',
    external_id: input.depositId,
    payment_method_id: input.row.providerRail,
    country: process.env.DLOCAL_DEFAULT_COUNTRY ?? 'AR',
    success_url: redirectUrl(input),
    back_url: `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=cancelled`
  });

  if (input.userEmail) {
    params.set('email', input.userEmail);
  }

  return {
    provider: 'dlocal',
    providerPaymentId: input.depositId,
    providerCheckoutUrl: `${base}/payments?${params.toString()}`,
    metadata: {
      configured: true,
      rail: input.row.providerRail,
      optionId: input.row.id,
      label: input.row.label
    }
  };
}

export function createLocalRailCheckout(input: LocalRailRequest): LocalRailResult {
  if (input.row.provider === 'astropay') {
    const astro = createAstroPayCheckout(input);
    if (astro.metadata?.configured) {
      return astro;
    }
  }

  if (input.row.provider === 'dlocal' || input.row.provider === 'ebanx') {
    const dlocal = createDLocalCheckout(input);
    if (dlocal.metadata?.configured) {
      return dlocal;
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
        instructions: `Pago ${input.row.label} pendiente de conciliación automática.`
      }
    };
  }

  return {
    provider: input.row.provider,
    metadata: { configured: false, rail: input.row.providerRail, optionId: input.row.id }
  };
}
