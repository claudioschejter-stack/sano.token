import { checkoutBaseUrl } from './paymentConfig';
import { appendStripePaymentMethodTypes } from './stripeCheckoutOptions';
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

export async function createStripeCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { provider: 'stripe', metadata: { configured: false } };
  }

  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': `Sanova RWA tokens (${input.tokenCount})`,
    'line_items[0][price_data][unit_amount]': Math.round(input.amountUsd * 100).toString(),
    'line_items[0][quantity]': '1',
    success_url: `${checkoutBaseUrl()}/marketplace/${input.projectId}/checkout?payment_intent=${input.paymentIntentId}&status=success`,
    cancel_url: `${checkoutBaseUrl()}/marketplace/${input.projectId}/checkout?payment_intent=${input.paymentIntentId}&status=cancelled`,
    client_reference_id: input.paymentIntentId,
    'metadata[paymentIntentId]': input.paymentIntentId,
    'metadata[projectId]': input.projectId
  });

  if (input.paymentOptionId) {
    params.set('metadata[paymentOptionId]', input.paymentOptionId);
  }

  appendStripePaymentMethodTypes(params, input.paymentOptionId);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!response.ok) {
    return { provider: 'stripe', metadata: { configured: true, error: await response.text() } };
  }

  const data = await parseJson<{ id?: string; url?: string }>(response);
  return {
    provider: 'stripe',
    providerPaymentId: data.id,
    providerCheckoutUrl: data.url,
    metadata: { configured: true }
  };
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

export async function createCoinbaseCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!apiKey) {
    return { provider: 'coinbase', metadata: { configured: false } };
  }

  const response = await fetch('https://api.commerce.coinbase.com/charges', {
    method: 'POST',
    headers: {
      'X-CC-Api-Key': apiKey,
      'X-CC-Version': '2018-03-22',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `Sanova RWA tokens (${input.tokenCount})`,
      description: `Project ${input.projectId}`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: input.amountUsd.toFixed(2),
        currency: 'USD'
      },
      metadata: {
        paymentIntentId: input.paymentIntentId,
        projectId: input.projectId
      },
      redirect_url: `${checkoutBaseUrl()}/marketplace/${input.projectId}/checkout?payment_intent=${input.paymentIntentId}&status=success`,
      cancel_url: `${checkoutBaseUrl()}/marketplace/${input.projectId}/checkout?payment_intent=${input.paymentIntentId}&status=cancelled`
    })
  });

  if (!response.ok) {
    return { provider: 'coinbase', metadata: { configured: true, error: await response.text() } };
  }

  const data = await parseJson<{ data?: { id?: string; hosted_url?: string } }>(response);
  return {
    provider: 'coinbase',
    providerPaymentId: data.data?.id,
    providerCheckoutUrl: data.data?.hosted_url,
    metadata: { configured: true }
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

export async function createStripeCartCheckout(input: CartCheckoutRequest): Promise<CheckoutResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { provider: 'stripe', metadata: { configured: false } };
  }

  const primaryIntentId = input.paymentIntentIds[0];
  const urls = cartReturnUrls(input.batchId);
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': `Sanova RWA cart (${input.totalTokens} tokens)`,
    'line_items[0][price_data][unit_amount]': Math.round(input.totalUsd * 100).toString(),
    'line_items[0][quantity]': '1',
    success_url: urls.success,
    cancel_url: urls.cancel,
    client_reference_id: primaryIntentId,
    'metadata[paymentIntentId]': primaryIntentId,
    'metadata[cartBatchId]': input.batchId,
    'metadata[paymentIntentIds]': input.paymentIntentIds.join(',')
  });

  if (input.paymentOptionId) {
    params.set('metadata[paymentOptionId]', input.paymentOptionId);
  }

  appendStripePaymentMethodTypes(params, input.paymentOptionId);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!response.ok) {
    return { provider: 'stripe', metadata: { configured: true, error: await response.text() } };
  }

  const data = await parseJson<{ id?: string; url?: string }>(response);
  return {
    provider: 'stripe',
    providerPaymentId: data.id,
    providerCheckoutUrl: data.url,
    metadata: { configured: true, cartBatchId: input.batchId, paymentOptionId: input.paymentOptionId ?? null }
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

export async function createCoinbaseCartCheckout(input: CartCheckoutRequest): Promise<CheckoutResult> {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!apiKey) {
    return { provider: 'coinbase', metadata: { configured: false } };
  }

  const primaryIntentId = input.paymentIntentIds[0];
  const urls = cartReturnUrls(input.batchId);
  const response = await fetch('https://api.commerce.coinbase.com/charges', {
    method: 'POST',
    headers: {
      'X-CC-Api-Key': apiKey,
      'X-CC-Version': '2018-03-22',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `Sanova RWA cart (${input.totalTokens} tokens)`,
      description: `Multi-project purchase batch ${input.batchId}`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: input.totalUsd.toFixed(2),
        currency: 'USD'
      },
      metadata: {
        paymentIntentId: primaryIntentId,
        cartBatchId: input.batchId,
        paymentIntentIds: input.paymentIntentIds.join(',')
      },
      redirect_url: urls.success,
      cancel_url: urls.cancel
    })
  });

  if (!response.ok) {
    return { provider: 'coinbase', metadata: { configured: true, error: await response.text() } };
  }

  const data = await parseJson<{ data?: { id?: string; hosted_url?: string } }>(response);
  return {
    provider: 'coinbase',
    providerPaymentId: data.data?.id,
    providerCheckoutUrl: data.data?.hosted_url,
    metadata: { configured: true, cartBatchId: input.batchId }
  };
}
