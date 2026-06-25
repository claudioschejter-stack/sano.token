import { getStablecoinNetwork } from './stablecoinNetworks';
import { resolveMercadoPagoChargeAmount } from './mercadoPagoCharge';
import {
  isMercadoPagoEmbeddedConfigured,
  mercadoPagoPublicKey
} from './mercadoPagoEmbeddedService';
import { mercadoPagoAccessToken, isMercadoPagoSandbox } from './mercadoPagoClient';
import { buildBridgeVirtualAccountInstructions } from '../checkout/bridgeVirtualAccountService';
import type { BridgeVirtualAccountInstructions } from '../checkout/paymentRouteTypes';

// ---------------------------------------------------------------------------
// FX table (fallback rates; production should use MERCADOPAGO_FX_ARS / DLOCAL env)
// ---------------------------------------------------------------------------

const FX_TABLE: Record<string, { currency: string; rate: number }> = {
  AR: { currency: 'ARS', rate: 1050 },
  BR: { currency: 'BRL', rate: 5.7 },
  MX: { currency: 'MXN', rate: 17.2 },
  CO: { currency: 'COP', rate: 4100 },
  CL: { currency: 'CLP', rate: 920 },
  PE: { currency: 'PEN', rate: 3.8 },
  EU: { currency: 'EUR', rate: 0.92 },
  GB: { currency: 'GBP', rate: 0.79 },
  CA: { currency: 'CAD', rate: 1.36 },
  AU: { currency: 'AUD', rate: 1.55 },
  IN: { currency: 'INR', rate: 83.5 }
};

function resolveLocalAmount(
  amountUsd: number,
  country: string,
  feesBps: number = 0
): { totalLocal: number; displayCurrency: string; totalUsd: number } {
  const totalUsd = amountUsd * (1 + feesBps / 10_000);

  if (country === 'AR') {
    const mpCharge = resolveMercadoPagoChargeAmount(amountUsd * (1 + feesBps / 10_000), 'AR');
    return { totalLocal: mpCharge.amount, displayCurrency: mpCharge.currency, totalUsd };
  }

  const fx = FX_TABLE[country.toUpperCase()];
  if (!fx) {
    return { totalLocal: Number(totalUsd.toFixed(2)), displayCurrency: 'USD', totalUsd };
  }

  return {
    totalLocal: Number((totalUsd * fx.rate).toFixed(2)),
    displayCurrency: fx.currency,
    totalUsd
  };
}

function transakHost(): string {
  const env = (process.env.TRANSAK_ENV ?? 'PRODUCTION').trim().toUpperCase();
  return env === 'STAGING' ? 'https://global-stg.transak.com' : 'https://global.transak.com';
}

function transakWidgetUrl(params: {
  amountUsd: number;
  country: string;
  referenceId: string;
  paymentMethod?: 'credit_debit_card' | 'bank_transfer';
  walletAddress?: string;
}): string | null {
  const apiKey = process.env.TRANSAK_API_KEY?.trim();
  const treasury = getStablecoinNetwork('BASE').treasuryAddress;
  if (!apiKey || !treasury) {
    return null;
  }

  const p = new URLSearchParams({
    apiKey,
    environment: transakHost().includes('stg') ? 'STAGING' : 'PRODUCTION',
    cryptoCurrencyCode: 'USDC',
    network: 'base',
    walletAddress: params.walletAddress ?? treasury,
    fiatAmount: params.amountUsd.toFixed(2),
    fiatCurrency: 'USD',
    partnerOrderId: params.referenceId,
    disableWalletAddressForm: 'true',
    hideMenu: 'true',
    countryCode: params.country.toUpperCase()
  });

  if (params.paymentMethod) {
    p.set('defaultPaymentMethod', params.paymentMethod);
  }

  return `${transakHost()}/?${p.toString()}`;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SimplifiedFiatWalletMethod = {
  provider: 'mercado_pago' | 'transak';
  configured: boolean;
  totalUsd: number;
  totalLocal: number;
  displayCurrency: string;
  feeBps: number;
  /** Transak widget URL (always populated when TRANSAK_API_KEY is set, including AR) */
  widgetUrl: string | null;
  /** MP preference ID to create QR (populated async on client) */
  mpPreferenceId: string | null;
  /**
   * Raw QR data string for a static interoperable merchant QR (e.g. MODO / BCRA standard).
   * Set via FIAT_STATIC_QR_DATA env var. When configured, this is shown as the primary
   * "Universal QR" that all BCRA-compliant Argentine wallets can scan natively.
   */
  staticQrData: string | null;
};

export type SimplifiedCryptoWalletMethod = {
  totalUsd: number;
  displayCurrency: 'USDC';
  feeBps: number;
  stablecoinNetwork: string;
};

export type SimplifiedCardMethod = {
  provider: 'privy' | 'mercado_pago_embedded' | 'transak';
  configured: boolean;
  totalUsd: number;
  totalLocal: number;
  displayCurrency: string;
  feeBps: number;
  widgetUrl: string | null;
  mpPublicKey: string | null;
  mpSandbox: boolean;
};

export type SimplifiedWireMethod = {
  totalUsd: number;
  displayCurrency: 'USD';
  feeBps: number;
  instructions: BridgeVirtualAccountInstructions;
};

export type CheckoutBestRoutes = {
  fiatWallet: SimplifiedFiatWalletMethod;
  cryptoWallet: SimplifiedCryptoWalletMethod;
  card: SimplifiedCardMethod;
  wire: SimplifiedWireMethod;
  /** Treasury address for USDC Base payments (exposed from server-side env) */
  treasuryAddress: string | null;
  country: string;
};

// ---------------------------------------------------------------------------
// Fee table per method/provider
// ---------------------------------------------------------------------------

const FEES: Record<string, number> = {
  mercado_pago_fiat: 280,       // AR, ~2.8%
  transak_fiat: 180,            // ~1.8% global
  crypto_usdc: 10,              // gas only (~0.1%)
  mercado_pago_card: 350,       // card + MP ~3.5%
  transak_card: 199,            // Transak card ~1.99%
  bridge_wire: 80               // Bridge ~0.8%
};

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

export function resolveCheckoutBestRoutes(input: {
  amountUsd: number;
  country: string;
  referenceId: string;
  investorName?: string;
}): CheckoutBestRoutes {
  const { amountUsd, country, referenceId } = input;
  const c = country.toUpperCase();

  // --- Fiat wallet ---
  const fiatFeeBps = c === 'AR' ? FEES.mercado_pago_fiat : FEES.transak_fiat;
  const fiatLocal = resolveLocalAmount(amountUsd, c, fiatFeeBps);
  const fiatWallet: SimplifiedFiatWalletMethod = {
    provider: c === 'AR' ? 'mercado_pago' : 'transak',
    configured: c === 'AR'
      ? Boolean(mercadoPagoAccessToken())
      : Boolean(process.env.TRANSAK_API_KEY?.trim()),
    totalUsd: fiatLocal.totalUsd,
    totalLocal: fiatLocal.totalLocal,
    displayCurrency: fiatLocal.displayCurrency,
    feeBps: fiatFeeBps,
    // Always populate widgetUrl with Transak URL when available (used as web-based
    // universal fallback for AR users in addition to the native MP QR).
    widgetUrl: transakWidgetUrl({ amountUsd: fiatLocal.totalUsd, country: c, referenceId }),
    mpPreferenceId: null,
    // Static interoperable QR data from MODO / BCRA merchant registration.
    // When set, this is shown as the primary universal QR that all Argentine wallets accept.
    staticQrData: process.env.FIAT_STATIC_QR_DATA?.trim() || null
  };

  // --- Crypto wallet ---
  const cryptoFeeBps = FEES.crypto_usdc;
  const cryptoTotal = amountUsd * (1 + cryptoFeeBps / 10_000);
  const cryptoWallet: SimplifiedCryptoWalletMethod = {
    totalUsd: Number(cryptoTotal.toFixed(2)),
    displayCurrency: 'USDC',
    feeBps: cryptoFeeBps,
    stablecoinNetwork: 'BASE'
  };

  // --- Card (always Privy: routes Stripe, MoonPay, Coinbase, Bridge) ---
  const cardFeeBps = FEES.transak_card; // ~1.99% fee estimate for Privy on-ramp
  const cardLocal = resolveLocalAmount(amountUsd, c, cardFeeBps);
  const card: SimplifiedCardMethod = {
    provider: 'privy',
    configured: Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim()),
    totalUsd: cardLocal.totalUsd,
    totalLocal: cardLocal.totalLocal,
    displayCurrency: cardLocal.displayCurrency,
    feeBps: cardFeeBps,
    widgetUrl: null,
    mpPublicKey: null,
    mpSandbox: false
  };

  // --- Wire ---
  const wireTotal = amountUsd * (1 + FEES.bridge_wire / 10_000);
  const wire: SimplifiedWireMethod = {
    totalUsd: Number(wireTotal.toFixed(2)),
    displayCurrency: 'USD',
    feeBps: FEES.bridge_wire,
    instructions: buildBridgeVirtualAccountInstructions({
      amountUsd: wireTotal,
      referenceId,
      investorName: input.investorName
    })
  };

  return {
    fiatWallet,
    cryptoWallet,
    card,
    wire,
    treasuryAddress: getStablecoinNetwork('BASE').treasuryAddress,
    country: c
  };
}
