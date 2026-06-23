import { checkoutBaseUrl } from '../payments/paymentConfig';
import { resolveMercadoPagoChargeAmount } from '../payments/mercadoPagoCharge';
import {
  isMercadoPagoSandbox,
  mercadoPagoAccessToken,
  mercadoPagoCheckoutUrl,
  mercadoPagoTokenLooksInvalid
} from '../payments/mercadoPagoClient';
import type { MercadoPagoCheckoutSession } from './paymentRouteTypes';

export type CreateMercadoPagoDirectPreferenceInput = {
  amountUsd: number;
  externalReference: string;
  title?: string;
  country?: string;
  metadata?: Record<string, unknown>;
};

export type CreateMercadoPagoDirectPreferenceResult =
  | { ok: true; session: MercadoPagoCheckoutSession }
  | { ok: false; error: string; sandbox: boolean };

function mercadoPagoNotificationUrl(): string {
  return `${checkoutBaseUrl()}/api/webhooks/mercadopago`;
}

function resolveFxRate(amountUsd: number, amountLocal: number): number {
  if (amountUsd <= 0) {
    return 0;
  }
  return Number((amountLocal / amountUsd).toFixed(4));
}

function misconfigured(): { error: string; sandbox: boolean } | null {
  const accessToken = mercadoPagoAccessToken();
  if (!accessToken) {
    return { error: 'MISSING_ACCESS_TOKEN', sandbox: false };
  }
  const tokenError = mercadoPagoTokenLooksInvalid(accessToken);
  if (tokenError) {
    return { error: tokenError, sandbox: isMercadoPagoSandbox(accessToken) };
  }
  return null;
}

export async function createMercadoPagoDirectPreference(
  input: CreateMercadoPagoDirectPreferenceInput
): Promise<CreateMercadoPagoDirectPreferenceResult> {
  const configError = misconfigured();
  if (configError) {
    return { ok: false, ...configError };
  }

  const accessToken = mercadoPagoAccessToken()!;
  const country = input.country ?? 'AR';
  const charge = resolveMercadoPagoChargeAmount(input.amountUsd, country);
  const title = input.title?.trim() || 'Inversión Sanova Capital';
  const returnBase = `${checkoutBaseUrl()}/marketplace/carrito?reference=${encodeURIComponent(input.externalReference)}`;

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      external_reference: input.externalReference,
      items: [
        {
          title,
          quantity: 1,
          currency_id: charge.currency,
          unit_price: charge.amount
        }
      ],
      notification_url: mercadoPagoNotificationUrl(),
      auto_return: 'approved',
      back_urls: {
        success: `${returnBase}&status=success`,
        failure: `${returnBase}&status=failed`,
        pending: `${returnBase}&status=pending`
      },
      metadata: {
        amountUsd: input.amountUsd,
        country,
        ...input.metadata
      }
    })
  });

  if (!response.ok) {
    return {
      ok: false,
      error: `PREFERENCE_${response.status}`,
      sandbox: isMercadoPagoSandbox(accessToken)
    };
  }

  const data = (await response.json()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  };

  const initPoint = mercadoPagoCheckoutUrl(data);
  if (!data.id || !initPoint) {
    return {
      ok: false,
      error: 'PREFERENCE_MISSING_INIT_POINT',
      sandbox: isMercadoPagoSandbox(accessToken)
    };
  }

  return {
    ok: true,
    session: {
      preferenceId: data.id,
      initPoint,
      amountUsd: input.amountUsd,
      amountLocal: charge.amount,
      localCurrency: charge.currency,
      fxRate: resolveFxRate(input.amountUsd, charge.amount),
      sandbox: isMercadoPagoSandbox(accessToken)
    }
  };
}
