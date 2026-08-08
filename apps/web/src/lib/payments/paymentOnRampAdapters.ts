import { checkoutBaseUrl } from './paymentConfig';
import { getPaymentCheckoutRowById } from './depositPaymentOptions';
import { createLocalRailCheckout } from './localRailAdapter';
import { getStablecoinNetwork } from './stablecoinNetworks';
import { createCoinbaseCheckout, createMercadoPagoEmbeddedDepositCheckout } from './paymentGatewayAdapters';
import { MERCADOPAGO_WALLET_OPTION_ID } from './mercadoPagoEmbeddedService';
import { resolveDepositMethodForUsdcBase } from './paymentCheckoutPolicy';
import { createRipioOnRampCheckout } from './ripioOnRampAdapter';
import { isPrivyOnRampConfigured, privyFiatAssetForCountry, PRIVY_ON_RAMP_OPTION_ID } from './privyOnRampPolicy';
import { createMacroClickHostedCheckout } from './macroClick/checkoutAdapter';

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

/** Todos los on-ramps fiat depositan USDC en treasury Base (Morpho). */
function baseTreasuryAddress(): string | null {
  return getStablecoinNetwork('BASE').treasuryAddress;
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

  // Hosted path is Sanova's VA / wire panel (Customers + Virtual Accounts → USDC Base treasury).
  // Do not send investors to Bridge's internal dashboard URL.
  const redirectPath =
    input.redirectPath ??
    `/marketplace/carrito?mode=deposit&deposit=${encodeURIComponent(input.depositId)}&method=bridge&status=awaiting_wire`;

  return {
    provider: 'bridge',
    providerPaymentId: input.depositId,
    providerCheckoutUrl: `${checkoutBaseUrl()}${redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`}`,
    metadata: {
      configured: true,
      network: 'BASE',
      settlement: 'treasury_first',
      mode: 'virtual_account',
      destinationAddress: walletAddress,
      amountUsd: input.amountUsd
    }
  };
}

/** Privy fiat on-ramp is completed client-side via `useFiatOnramp().fund()`. */
export function createPrivyOnRampCheckout(input: OnRampRequest): OnRampResult {
  if (!isPrivyOnRampConfigured()) {
    return { provider: 'privy', metadata: { configured: false } };
  }

  const walletAddress = baseTreasuryAddress();
  if (!walletAddress) {
    return { provider: 'privy', metadata: { configured: true, error: 'TREASURY_NOT_CONFIGURED' } };
  }

  const country = input.country?.trim().toUpperCase() ?? 'US';
  const fiatAsset = privyFiatAssetForCountry(country);

  return {
    provider: 'privy',
    providerPaymentId: input.depositId,
    metadata: {
      configured: true,
      mode: 'privy_client_fund',
      network: 'BASE',
      settlement: 'treasury_first',
      country,
      fiatAsset,
      amountUsd: input.amountUsd,
      treasuryAddress: walletAddress,
      depositId: input.depositId,
      redirectPath: input.redirectPath
        ? `${checkoutBaseUrl()}${input.redirectPath}`
        : `${checkoutBaseUrl()}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=success`
    }
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

  if (input.method === 'LOCAL_RAIL' && checkoutRow?.provider === 'macro_click') {
    const currency = checkoutRow.providerRail.includes('usd') ? 'USD' : 'ARS';
    return createMacroClickHostedCheckout({
      referenceId: input.depositId,
      referenceKind: 'deposit',
      amount: input.amountUsd,
      currency,
      label: checkoutRow.label,
      userId: input.userId,
      userEmail: input.userEmail,
      clientIp: '127.0.0.1',
      redirectPath: input.redirectPath
    });
  }

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
      if (
        checkoutRow?.id === MERCADOPAGO_WALLET_OPTION_ID ||
        checkoutRow?.provider === 'mercado_pago' ||
        input.paymentOptionId === MERCADOPAGO_WALLET_OPTION_ID
      ) {
        return createMercadoPagoEmbeddedDepositCheckout({
          depositId: input.depositId,
          amountUsd: input.amountUsd,
          paymentOptionId: checkoutRow?.id ?? input.paymentOptionId ?? null,
          paymentLabel: checkoutRow?.label ?? 'Depósito Sanova'
        });
      }
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
    case 'PRIVY_ONRAMP':
      return createPrivyOnRampCheckout(baseInput);
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
