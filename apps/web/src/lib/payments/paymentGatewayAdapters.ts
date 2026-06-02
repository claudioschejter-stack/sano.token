import { checkoutBaseUrl } from './paymentConfig';

type CheckoutRequest = {
  paymentIntentId: string;
  projectId: string;
  amountUsd: number;
  tokenCount: number;
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
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return { provider: 'mercado_pago', metadata: { configured: false } };
  }

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      external_reference: input.paymentIntentId,
      items: [
        {
          title: `Sanova RWA tokens (${input.tokenCount})`,
          quantity: 1,
          currency_id: 'USD',
          unit_price: input.amountUsd
        }
      ],
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

  const data = await parseJson<{ id?: string; init_point?: string }>(response);
  return {
    provider: 'mercado_pago',
    providerPaymentId: data.id,
    providerCheckoutUrl: data.init_point,
    metadata: { configured: true }
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
    metadata: { configured: true, cartBatchId: input.batchId }
  };
}

export async function createMercadoPagoCartCheckout(input: CartCheckoutRequest): Promise<CheckoutResult> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return { provider: 'mercado_pago', metadata: { configured: false } };
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
      items: [
        {
          title: `Sanova RWA cart (${input.totalTokens} tokens)`,
          quantity: 1,
          currency_id: 'USD',
          unit_price: input.totalUsd
        }
      ],
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

  const data = await parseJson<{ id?: string; init_point?: string }>(response);
  return {
    provider: 'mercado_pago',
    providerPaymentId: data.id,
    providerCheckoutUrl: data.init_point,
    metadata: { configured: true, cartBatchId: input.batchId }
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
