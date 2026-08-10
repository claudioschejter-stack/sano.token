import { checkoutBaseUrl } from './paymentConfig';
import { resolveMercadoPagoChargeAmount } from './mercadoPagoCharge';
import { mercadoPagoAccessToken, mercadoPagoCheckoutUrl, isMercadoPagoSandbox, mercadoPagoTokenLooksInvalid } from './mercadoPagoClient';
import {
  createMercadoPagoEmbeddedPreference,
  isMercadoPagoWalletOption
} from './mercadoPagoEmbeddedService';

type CheckoutRequest = {
  paymentIntentId: string;
  projectId: string;
  amountUsd: number;
  tokenCount: number;
  paymentOptionId?: string | null;
};

type CheckoutResult = {
  provider: string;
  providerPaymentId?: string;
  providerCheckoutUrl?: string;
  metadata?: Record<string, unknown>;
};

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function mercadoPagoNotificationUrl(): string {
  return `${checkoutBaseUrl()}/api/webhooks/mercadopago`;
}

function mercadoPagoPreferenceItem(title: string, amountUsd: number) {
  const charge = resolveMercadoPagoChargeAmount(amountUsd);
  return {
    title,
    quantity: 1,
    currency_id: charge.currency,
    unit_price: charge.amount
  };
}

function mercadoPagoMisconfigured(accessToken: string | null): CheckoutResult | null {
  const tokenError = mercadoPagoTokenLooksInvalid(accessToken);
  if (!accessToken) {
    return { provider: 'mercado_pago', metadata: { configured: false } };
  }
  if (tokenError) {
    return {
      provider: 'mercado_pago',
      metadata: { configured: true, error: tokenError, sandbox: isMercadoPagoSandbox(accessToken) }
    };
  }
  return null;
}

export async function createMercadoPagoCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
  const accessToken = mercadoPagoAccessToken();
  const misconfigured = mercadoPagoMisconfigured(accessToken);
  if (misconfigured) {
    return misconfigured;
  }

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      external_reference: input.paymentIntentId,
      items: [mercadoPagoPreferenceItem(`Sanova RWA tokens (${input.tokenCount})`, input.amountUsd)],
      notification_url: mercadoPagoNotificationUrl(),
      auto_return: 'approved',
      back_urls: {
        success: `${checkoutBaseUrl()}/marketplace/${input.projectId}/checkout?payment_intent=${input.paymentIntentId}&status=success`,
        failure: `${checkoutBaseUrl()}/marketplace/${input.projectId}/checkout?payment_intent=${input.paymentIntentId}&status=failed`,
        pending: `${checkoutBaseUrl()}/marketplace/${input.projectId}/checkout?payment_intent=${input.paymentIntentId}&status=pending`
      },
      metadata: {
        paymentIntentId: input.paymentIntentId,
        projectId: input.projectId
      }
    })
  });

  if (!response.ok) {
    return { provider: 'mercado_pago', metadata: { configured: true, error: await response.text() } };
  }

  const data = await parseJson<{ id?: string; init_point?: string; sandbox_init_point?: string }>(response);
  return {
    provider: 'mercado_pago',
    providerPaymentId: data.id,
    providerCheckoutUrl: mercadoPagoCheckoutUrl(data),
    metadata: { configured: true, sandbox: isMercadoPagoSandbox(accessToken) }
  };
}

type CartCheckoutRequest = {
  batchId: string;
  totalUsd: number;
  totalTokens: number;
  primaryProjectId: string;
  paymentIntentIds: string[];
  paymentOptionId?: string | null;
};

function cartReturnUrls(batchId: string) {
  const base = `${checkoutBaseUrl()}/marketplace/carrito?batch=${encodeURIComponent(batchId)}`;
  return {
    success: `${base}&status=success`,
    cancel: `${base}&status=cancelled`,
    pending: `${base}&status=pending`,
    failed: `${base}&status=failed`
  };
}

export async function createMercadoPagoCartCheckout(input: CartCheckoutRequest): Promise<CheckoutResult> {
  if (isMercadoPagoWalletOption(input.paymentOptionId)) {
    return createMercadoPagoEmbeddedCartCheckout(input);
  }

  const accessToken = mercadoPagoAccessToken();
  const misconfigured = mercadoPagoMisconfigured(accessToken);
  if (misconfigured) {
    return misconfigured;
  }

  const primaryIntentId = input.paymentIntentIds[0];
  const urls = cartReturnUrls(input.batchId);
  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      external_reference: primaryIntentId,
      items: [mercadoPagoPreferenceItem(`Sanova RWA cart (${input.totalTokens} tokens)`, input.totalUsd)],
      notification_url: mercadoPagoNotificationUrl(),
      auto_return: 'approved',
      back_urls: {
        success: urls.success,
        failure: urls.failed,
        pending: urls.pending
      },
      metadata: {
        paymentIntentId: primaryIntentId,
        cartBatchId: input.batchId,
        paymentIntentIds: input.paymentIntentIds.join(',')
      }
    })
  });

  if (!response.ok) {
    return { provider: 'mercado_pago', metadata: { configured: true, error: await response.text() } };
  }

  const data = await parseJson<{ id?: string; init_point?: string; sandbox_init_point?: string }>(response);
  return {
    provider: 'mercado_pago',
    providerPaymentId: data.id,
    providerCheckoutUrl: mercadoPagoCheckoutUrl(data),
    metadata: { configured: true, cartBatchId: input.batchId, sandbox: isMercadoPagoSandbox(accessToken) }
  };
}

type DepositCheckoutRequest = {
  depositId: string;
  amountUsd: number;
  paymentOptionId?: string | null;
  paymentLabel?: string | null;
};

export async function createMercadoPagoEmbeddedDepositCheckout(input: DepositCheckoutRequest): Promise<CheckoutResult> {
  const label = input.paymentLabel?.trim() || 'Depósito Sanova';
  const preference = await createMercadoPagoEmbeddedPreference({
    externalReference: input.depositId,
    amountUsd: input.amountUsd,
    title: label,
    metadata: {
      depositId: input.depositId,
      paymentOptionId: input.paymentOptionId ?? null
    }
  });

  if (preference.ok === false) {
    return {
      provider: 'mercado_pago',
      metadata: { configured: true, embedded: false, error: preference.error, sandbox: preference.sandbox }
    };
  }

  return {
    provider: 'mercado_pago',
    providerPaymentId: preference.session.preferenceId,
    metadata: {
      configured: true,
      depositId: input.depositId,
      paymentOptionId: input.paymentOptionId ?? null,
      ...preference.session
    }
  };
}

export async function createMercadoPagoEmbeddedCartCheckout(input: CartCheckoutRequest): Promise<CheckoutResult> {
  const primaryIntentId = input.paymentIntentIds[0];
  const preference = await createMercadoPagoEmbeddedPreference({
    externalReference: primaryIntentId,
    amountUsd: input.totalUsd,
    title: `Sanova RWA cart (${input.totalTokens} tokens)`,
    metadata: {
      cartBatchId: input.batchId,
      paymentIntentIds: input.paymentIntentIds.join(','),
      paymentOptionId: input.paymentOptionId ?? null
    }
  });

  if (preference.ok === false) {
    return {
      provider: 'mercado_pago',
      metadata: { configured: true, embedded: false, error: preference.error, sandbox: preference.sandbox }
    };
  }

  return {
    provider: 'mercado_pago',
    providerPaymentId: preference.session.preferenceId,
    metadata: {
      configured: true,
      cartBatchId: input.batchId,
      paymentOptionId: input.paymentOptionId ?? null,
      ...preference.session
    }
  };
}

export async function createMercadoPagoDepositCheckout(input: DepositCheckoutRequest): Promise<CheckoutResult> {
  if (isMercadoPagoWalletOption(input.paymentOptionId)) {
    return createMercadoPagoEmbeddedDepositCheckout(input);
  }

  const accessToken = mercadoPagoAccessToken();
  const misconfigured = mercadoPagoMisconfigured(accessToken);
  if (misconfigured) {
    return misconfigured;
  }

  const label = input.paymentLabel?.trim() || 'Depósito Sanova';
  const urls = {
    success: `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=success`,
    failure: `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=failed`,
    pending: `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=pending`
  };

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      external_reference: input.depositId,
      items: [mercadoPagoPreferenceItem(label, input.amountUsd)],
      notification_url: mercadoPagoNotificationUrl(),
      auto_return: 'approved',
      back_urls: urls,
      metadata: {
        depositId: input.depositId,
        paymentOptionId: input.paymentOptionId ?? null
      }
    })
  });

  if (!response.ok) {
    return { provider: 'mercado_pago', metadata: { configured: true, error: await response.text() } };
  }

  const data = await parseJson<{ id?: string; init_point?: string; sandbox_init_point?: string }>(response);
  return {
    provider: 'mercado_pago',
    providerPaymentId: data.id,
    providerCheckoutUrl: mercadoPagoCheckoutUrl(data),
    metadata: {
      configured: true,
      depositId: input.depositId,
      paymentOptionId: input.paymentOptionId ?? null,
      sandbox: isMercadoPagoSandbox(accessToken)
    }
  };
}
