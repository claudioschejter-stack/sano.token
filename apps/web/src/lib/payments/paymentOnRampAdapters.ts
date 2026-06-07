import { checkoutBaseUrl } from './paymentConfig';
import { getPaymentCheckoutRowById } from './depositPaymentOptions';
import { createLocalRailCheckout } from './localRailAdapter';
import { appendStripePaymentMethodTypes } from './stripeCheckoutOptions';
import { getStablecoinNetwork, type StablecoinNetworkId } from './stablecoinNetworks';
import {
  createCoinbaseCheckout,
  createMercadoPagoCheckout,
  createMercadoPagoDepositCheckout,
  createStripeCheckout
} from './paymentGatewayAdapters';

type OnRampRequest = {
  depositId: string;
  amountUsd: number;
  stablecoinNetwork?: string | null;
  userEmail?: string | null;
  walletAddress?: string | null;
  redirectPath?: string | null;
};

type OnRampResult = {
  provider: string;
  providerPaymentId?: string;
  providerCheckoutUrl?: string;
  metadata?: Record<string, unknown>;
};

const TRANSAK_HOST = {
  PRODUCTION: 'https://global.transak.com',
  STAGING: 'https://global-stg.transak.com'
} as const;

function transakHost() {
  const env = (process.env.TRANSAK_ENV ?? 'PRODUCTION').trim().toUpperCase();
  return env === 'STAGING' ? TRANSAK_HOST.STAGING : TRANSAK_HOST.PRODUCTION;
}

function transakNetworkId(networkId?: string | null): string {
  switch ((networkId ?? 'BASE').toUpperCase() as StablecoinNetworkId) {
    case 'POLYGON':
      return 'polygon';
    case 'SOLANA':
      return 'solana';
    case 'TRON':
      return 'mainnet';
    default:
      return 'base';
  }
}

export function createTransakOnRampCheckout(input: OnRampRequest): OnRampResult {
  const apiKey = process.env.TRANSAK_API_KEY?.trim();
  if (!apiKey) {
    return { provider: 'transak', metadata: { configured: false } };
  }

  const network = getStablecoinNetwork(input.stablecoinNetwork);
  const walletAddress = network.treasuryAddress ?? input.walletAddress;
  if (!walletAddress) {
    return { provider: 'transak', metadata: { configured: true, error: 'TREASURY_NOT_CONFIGURED' } };
  }

  const cryptoCode = network.symbol === 'USDT' ? 'USDT' : 'USDC';
  const params = new URLSearchParams({
    apiKey,
    environment: transakHost().includes('stg') ? 'STAGING' : 'PRODUCTION',
    cryptoCurrencyCode: cryptoCode,
    network: transakNetworkId(network.id),
    walletAddress,
    disableWalletAddressForm: 'true',
    fiatAmount: input.amountUsd.toFixed(2),
    fiatCurrency: 'USD',
    partnerOrderId: input.depositId,
    redirectURL: input.redirectPath
      ? `${checkoutBaseUrl()}${input.redirectPath}`
      : `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=success`,
    hideMenu: 'true'
  });

  if (input.userEmail) {
    params.set('email', input.userEmail);
  }

  return {
    provider: 'transak',
    providerPaymentId: input.depositId,
    providerCheckoutUrl: `${transakHost()}/?${params.toString()}`,
    metadata: { configured: true, network: network.id, mode: 'on_ramp' }
  };
}

export function createTransakOffRampCheckout(input: {
  withdrawalId: string;
  amountUsd: number;
  walletAddress: string;
  userEmail?: string | null;
}): OnRampResult {
  const apiKey = process.env.TRANSAK_API_KEY?.trim();
  if (!apiKey) {
    return { provider: 'transak', metadata: { configured: false } };
  }

  const params = new URLSearchParams({
    apiKey,
    environment: transakHost().includes('stg') ? 'STAGING' : 'PRODUCTION',
    productsAvailed: 'SELL',
    cryptoCurrencyCode: 'USDC',
    network: 'base',
    walletAddress: input.walletAddress,
    fiatAmount: input.amountUsd.toFixed(2),
    fiatCurrency: 'USD',
    partnerOrderId: input.withdrawalId,
    redirectURL: `${checkoutBaseUrl()}/dashboard/portfolio?withdrawal=${input.withdrawalId}&status=success`,
    hideMenu: 'true'
  });

  if (input.userEmail) {
    params.set('email', input.userEmail);
  }

  return {
    provider: 'transak',
    providerPaymentId: input.withdrawalId,
    providerCheckoutUrl: `${transakHost()}/?${params.toString()}`,
    metadata: { configured: true, mode: 'off_ramp' }
  };
}

export function createBridgeOnRampCheckout(input: OnRampRequest): OnRampResult {
  const apiKey = process.env.BRIDGE_API_KEY?.trim();
  if (!apiKey) {
    return { provider: 'bridge', metadata: { configured: false } };
  }

  const network = getStablecoinNetwork(input.stablecoinNetwork);
  const walletAddress = network.treasuryAddress;
  if (!walletAddress) {
    return { provider: 'bridge', metadata: { configured: true, error: 'TREASURY_NOT_CONFIGURED' } };
  }

  const params = new URLSearchParams({
    amount: input.amountUsd.toFixed(2),
    currency: 'usd',
    destination_address: walletAddress,
    destination_chain: network.id.toLowerCase(),
    external_id: input.depositId,
    redirect_uri: input.redirectPath
      ? `${checkoutBaseUrl()}${input.redirectPath}`
      : `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=success`
  });

  return {
    provider: 'bridge',
    providerPaymentId: input.depositId,
    providerCheckoutUrl: `https://dashboard.bridge.xyz/on-ramp?${params.toString()}`,
    metadata: { configured: true, network: network.id, note: 'Complete Bridge onboarding for live checkout' }
  };
}

export async function createDepositProviderCheckout(input: OnRampRequest & {
  method: string;
  projectId?: string;
  tokenCount?: number;
  paymentIntentId?: string;
  paymentOptionId?: string | null;
}): Promise<OnRampResult> {
  const checkoutRow = input.paymentOptionId ? getPaymentCheckoutRowById(input.paymentOptionId) : null;

  if (input.method === 'LOCAL_RAIL' && checkoutRow) {
    return createLocalRailCheckout({
      depositId: input.depositId,
      amountUsd: input.amountUsd,
      row: checkoutRow,
      userEmail: input.userEmail,
      redirectPath: input.redirectPath
    });
  }

  switch (input.method) {
    case 'STRIPE':
      if (input.paymentIntentId && input.projectId) {
        return createStripeCheckout({
          paymentIntentId: input.paymentIntentId,
          projectId: input.projectId,
          amountUsd: input.amountUsd,
          tokenCount: input.tokenCount ?? 1
        });
      }
      return createStripeDepositCheckout({
        ...input,
        paymentOptionId: checkoutRow?.id ?? input.paymentOptionId
      });
    case 'MERCADO_PAGO':
      if (input.paymentIntentId && input.projectId) {
        return createMercadoPagoCheckout({
          paymentIntentId: input.paymentIntentId,
          projectId: input.projectId,
          amountUsd: input.amountUsd,
          tokenCount: input.tokenCount ?? 1
        });
      }
      return createMercadoPagoDepositCheckout({
        depositId: input.depositId,
        amountUsd: input.amountUsd,
        paymentOptionId: checkoutRow?.id ?? input.paymentOptionId,
        paymentLabel: checkoutRow?.label
      });
    case 'COINBASE':
      if (input.paymentIntentId && input.projectId) {
        return createCoinbaseCheckout({
          paymentIntentId: input.paymentIntentId,
          projectId: input.projectId,
          amountUsd: input.amountUsd,
          tokenCount: input.tokenCount ?? 1
        });
      }
      return { provider: 'coinbase', metadata: { configured: Boolean(process.env.COINBASE_COMMERCE_API_KEY) } };
    case 'TRANSAK':
      return createTransakOnRampCheckout(input);
    case 'BRIDGE':
      return createBridgeOnRampCheckout(input);
    case 'USDC_ONCHAIN':
      return { provider: 'stablecoin_onchain', metadata: { configured: true } };
    default:
      return { provider: String(input.method).toLowerCase(), metadata: { configured: false } };
  }
}

async function createStripeDepositCheckout(
  input: OnRampRequest & { paymentOptionId?: string | null }
): Promise<OnRampResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { provider: 'stripe', metadata: { configured: false } };
  }

  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': 'Saldo Sanova',
    'line_items[0][price_data][unit_amount]': Math.round(input.amountUsd * 100).toString(),
    'line_items[0][quantity]': '1',
    success_url: `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=success`,
    cancel_url: `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=cancelled`,
    client_reference_id: input.depositId,
    'metadata[depositId]': input.depositId
  });

  if (input.paymentOptionId) {
    params.set('metadata[paymentOptionId]', input.paymentOptionId);
  }

  appendStripePaymentMethodTypes(params, input.paymentOptionId);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!response.ok) {
    return { provider: 'stripe', metadata: { configured: true, error: await response.text() } };
  }

  const data = (await response.json()) as { id?: string; url?: string };
  return {
    provider: 'stripe',
    providerPaymentId: data.id,
    providerCheckoutUrl: data.url,
    metadata: { configured: true, depositId: input.depositId }
  };
}
