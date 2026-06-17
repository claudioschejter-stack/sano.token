import { checkoutBaseUrl } from './paymentConfig';
import { getPaymentCheckoutRowById } from './depositPaymentOptions';
import { createLocalRailCheckout } from './localRailAdapter';
import { getStablecoinNetwork } from './stablecoinNetworks';
import { createCoinbaseCheckout } from './paymentGatewayAdapters';
import { resolveDepositMethodForUsdcBase } from './paymentCheckoutPolicy';
import { createRipioOnRampCheckout } from './ripioOnRampAdapter';

type OnRampRequest = {
  depositId: string;
  amountUsd: number;
  stablecoinNetwork?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  walletAddress?: string | null;
  redirectPath?: string | null;
  country?: string | null;
  paymentOptionRail?: string | null;
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

/** Todos los on-ramps fiat depositan USDC en treasury Base (Morpho). */
function baseTreasuryAddress(): string | null {
  return getStablecoinNetwork('BASE').treasuryAddress;
}

export function createTransakOnRampCheckout(input: OnRampRequest): OnRampResult {
  const apiKey = process.env.TRANSAK_API_KEY?.trim();
  if (!apiKey) {
    return { provider: 'transak', metadata: { configured: false } };
  }

  const walletAddress = baseTreasuryAddress();
  if (!walletAddress) {
    return { provider: 'transak', metadata: { configured: true, error: 'TREASURY_NOT_CONFIGURED' } };
  }

  const params = new URLSearchParams({
    apiKey,
    environment: transakHost().includes('stg') ? 'STAGING' : 'PRODUCTION',
    cryptoCurrencyCode: 'USDC',
    network: 'base',
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
    metadata: { configured: true, network: 'BASE', mode: 'on_ramp', settlement: 'treasury_first' }
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

  const walletAddress = baseTreasuryAddress();
  if (!walletAddress) {
    return { provider: 'bridge', metadata: { configured: true, error: 'TREASURY_NOT_CONFIGURED' } };
  }

  const params = new URLSearchParams({
    amount: input.amountUsd.toFixed(2),
    currency: 'usd',
    destination_address: walletAddress,
    destination_chain: 'base',
    external_id: input.depositId,
    redirect_uri: input.redirectPath
      ? `${checkoutBaseUrl()}${input.redirectPath}`
      : `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=success`
  });

  return {
    provider: 'bridge',
    providerPaymentId: input.depositId,
    providerCheckoutUrl: `https://dashboard.bridge.xyz/on-ramp?${params.toString()}`,
    metadata: { configured: true, network: 'BASE', settlement: 'treasury_first' }
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
  const baseInput: OnRampRequest = {
    ...input,
    stablecoinNetwork: 'BASE'
  };

  if (input.method === 'LOCAL_RAIL' && checkoutRow) {
    return createLocalRailCheckout({
      depositId: input.depositId,
      amountUsd: input.amountUsd,
      row: checkoutRow,
      userEmail: input.userEmail,
      redirectPath: input.redirectPath,
      country: input.country
    });
  }

  switch (input.method) {
    case 'MERCADO_PAGO': {
      const resolved = checkoutRow
        ? resolveDepositMethodForUsdcBase(checkoutRow)
        : { method: 'RIPIO' as const, ripioRail: 'mercado_pago' };
      return createRipioOnRampCheckout({
        ...baseInput,
        paymentOptionRail: resolved.ripioRail ?? 'mercado_pago'
      });
    }
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
      return createTransakOnRampCheckout(baseInput);
    case 'RIPIO':
      return createRipioOnRampCheckout({
        ...baseInput,
        paymentOptionRail: checkoutRow?.providerRail ?? input.paymentOptionRail
      });
    case 'BRIDGE':
      if (checkoutRow?.provider === 'wise') {
        return createLocalRailCheckout({
          depositId: input.depositId,
          amountUsd: input.amountUsd,
          row: checkoutRow,
          userEmail: input.userEmail,
          redirectPath: input.redirectPath
        });
      }
      return createBridgeOnRampCheckout(baseInput);
    case 'USDC_ONCHAIN':
      return { provider: 'stablecoin_onchain', metadata: { configured: true, network: 'BASE' } };
    default:
      return { provider: String(input.method).toLowerCase(), metadata: { configured: false } };
  }
}
