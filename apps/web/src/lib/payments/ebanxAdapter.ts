import { checkoutBaseUrl } from './paymentConfig';

type EbanxPaymentInput = {
  externalId: string;
  amountUsd: number;
  country: string;
  paymentTypeCode?: string;
  userEmail?: string | null;
  successUrl: string;
  backUrl: string;
  name?: string;
};

type EbanxPaymentResult = {
  provider: 'ebanx';
  providerPaymentId?: string;
  providerCheckoutUrl?: string;
  metadata: Record<string, unknown>;
};

function ebanxIntegrationKey(): string | null {
  return process.env.EBANX_API_KEY?.trim() || process.env.EBANX_INTEGRATION_KEY?.trim() || null;
}

function mapCountryToEbanx(country: string): string {
  if (country === 'EU') {
    return process.env.EBANX_DEFAULT_EU_COUNTRY?.trim().toLowerCase() || 'br';
  }
  return country.toLowerCase();
}

export async function createEbanxPayment(input: EbanxPaymentInput): Promise<EbanxPaymentResult> {
  const integrationKey = ebanxIntegrationKey();
  if (!integrationKey) {
    return { provider: 'ebanx', metadata: { configured: false } };
  }

  const countryCode = mapCountryToEbanx(input.country);
  const notificationUrl = `${checkoutBaseUrl()}/api/webhooks/ebanx`;
  const params = new URLSearchParams({
    integration_key: integrationKey,
    operation: 'request',
    mode: 'full',
    payment_type_code: input.paymentTypeCode ?? '_all',
    amount: input.amountUsd.toFixed(2),
    currency_code: 'USD',
    merchant_payment_code: input.externalId,
    country: countryCode,
    name: input.name ?? 'Sanova Investor',
    email: input.userEmail?.trim() ?? 'investor@sanovacapital.com',
    notification_url: notificationUrl,
    redirect_url: input.successUrl
  });

  const apiBase = (process.env.EBANX_API_BASE_URL ?? 'https://api.ebanxpay.com').replace(/\/$/, '');

  try {
    const response = await fetch(`${apiBase}/ws/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const data = (await response.json()) as {
      status?: string;
      payment?: { hash?: string; redirect_url?: string };
      status_message?: string;
    };

    if (data.status !== 'SUCCESS' || !data.payment?.redirect_url) {
      return {
        provider: 'ebanx',
        metadata: {
          configured: true,
          error: data.status_message ?? 'EBANX_REQUEST_FAILED',
          country: countryCode
        }
      };
    }

    return {
      provider: 'ebanx',
      providerPaymentId: data.payment.hash ?? input.externalId,
      providerCheckoutUrl: data.payment.redirect_url,
      metadata: { configured: true, country: countryCode, mode: 'api' }
    };
  } catch (error) {
    return {
      provider: 'ebanx',
      metadata: {
        configured: true,
        error: error instanceof Error ? error.message : 'EBANX_REQUEST_FAILED'
      }
    };
  }
}

export function isEbanxPaymentPaid(status?: string | null): boolean {
  const normalized = status?.trim().toUpperCase() ?? '';
  return normalized === 'CO' || normalized === 'CONFIRMED' || normalized === 'SUCCESS';
}
