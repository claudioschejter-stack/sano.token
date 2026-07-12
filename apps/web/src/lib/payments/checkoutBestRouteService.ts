import { getStablecoinNetwork } from './stablecoinNetworks';
import { resolveMercadoPagoChargeAmount } from './mercadoPagoCharge';
import { mercadoPagoAccessToken } from './mercadoPagoClient';
import { isMercadoPagoPixConfigured } from './mercadoPagoPix/config';

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

/** Estimated Base network gas paid by the buyer (included in crypto all-in total). */
export const CRYPTO_BASE_GAS_USD = 0.001;

/**
 * Small FX buffer (bps) baked into local-currency methods so the displayed total
 * covers gateway FX + conversion to USDC on Base.
 */
const FX_BUFFER_BPS = 20;

function resolveLocalAmount(
  amountUsd: number,
  country: string,
  feesBps: number = 0
): { totalLocal: number; displayCurrency: string; totalUsd: number } {
  const totalUsd = amountUsd * (1 + feesBps / 10_000);

  if (country === 'AR') {
    const mpCharge = resolveMercadoPagoChargeAmount(totalUsd, 'AR');
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
  configured: boolean;
  totalUsd: number;
  displayCurrency: 'USDC';
  feeBps: number;
  /** Gas estimate already included in totalUsd (shown in fee breakdown). */
  networkFeeUsd: number;
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
  provider: 'transak' | 'bridge';
  configured: boolean;
  totalUsd: number;
  displayCurrency: 'USD';
  feeBps: number;
  widgetUrl: string | null;
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
// Fee table per method/provider (buyer-paid; all-in totals use these + FX buffer)
// ---------------------------------------------------------------------------

const FEES: Record<string, number> = {
  mercado_pago_fiat: 280, // AR, ~2.8%
  pix_br: 25, // Pix BR ~0.25%
  transak_fiat: 180, // ~1.8% global
  transak_card: 199, // Transak card ~1.99%
  transak_wire: 80 // Transak bank transfer ~0.8%
};

function fiatFeeBpsForCountry(country: string): number {
  if (country === 'AR') return FEES.mercado_pago_fiat + FX_BUFFER_BPS;
  if (country === 'BR') return FEES.pix_br + FX_BUFFER_BPS;
  return FEES.transak_fiat + FX_BUFFER_BPS;
}

function fiatConfiguredForCountry(country: string): boolean {
  if (country === 'AR') return Boolean(mercadoPagoAccessToken());
  if (country === 'BR') return isMercadoPagoPixConfigured();
  return Boolean(process.env.TRANSAK_API_KEY?.trim());
}

function fiatProviderForCountry(country: string): 'mercado_pago' | 'transak' {
  if (country === 'AR' || country === 'BR') return 'mercado_pago';
  return 'transak';
}

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
  const treasuryAddress = getStablecoinNetwork('BASE').treasuryAddress;

  // --- Fiat wallet (AR = Mercado Pago, BR = Pix, else Transak) ---
  const fiatFeeBps = fiatFeeBpsForCountry(c);
  const fiatLocal = resolveLocalAmount(amountUsd, c, fiatFeeBps);
  const fiatWallet: SimplifiedFiatWalletMethod = {
    provider: fiatProviderForCountry(c),
    configured: fiatConfiguredForCountry(c),
    totalUsd: Number(fiatLocal.totalUsd.toFixed(2)),
    totalLocal: fiatLocal.totalLocal,
    displayCurrency: fiatLocal.displayCurrency,
    feeBps: fiatFeeBps,
    widgetUrl: transakWidgetUrl({ amountUsd: fiatLocal.totalUsd, country: c, referenceId }),
    mpPreferenceId: null,
    staticQrData: process.env.FIAT_STATIC_QR_DATA?.trim() || null
  };

  // --- Crypto wallet: amount + Base gas only (no duplicate bps markup) ---
  const cryptoTotalUsd = Number((amountUsd + CRYPTO_BASE_GAS_USD).toFixed(2));
  const cryptoWallet: SimplifiedCryptoWalletMethod = {
    configured: Boolean(treasuryAddress),
    totalUsd: cryptoTotalUsd,
    displayCurrency: 'USDC',
    feeBps: 0,
    networkFeeUsd: CRYPTO_BASE_GAS_USD,
    stablecoinNetwork: 'BASE'
  };

  // --- Card ---
  const cardFeeBps = FEES.transak_card + FX_BUFFER_BPS;
  const cardLocal = resolveLocalAmount(amountUsd, c, cardFeeBps);
  const cardWidgetUrl = transakWidgetUrl({
    amountUsd: cardLocal.totalUsd,
    country: c,
    referenceId,
    paymentMethod: 'credit_debit_card'
  });
  const card: SimplifiedCardMethod = {
    provider: 'transak',
    configured: Boolean(cardWidgetUrl),
    totalUsd: Number(cardLocal.totalUsd.toFixed(2)),
    totalLocal: cardLocal.totalLocal,
    displayCurrency: cardLocal.displayCurrency,
    feeBps: cardFeeBps,
    widgetUrl: cardWidgetUrl,
    mpPublicKey: null,
    mpSandbox: false
  };

  // --- Wire (Transak bank transfer) ---
  const wireFeeBps = FEES.transak_wire + FX_BUFFER_BPS;
  const wireTotal = amountUsd * (1 + wireFeeBps / 10_000);
  const wireWidgetUrl = transakWidgetUrl({
    amountUsd: Number(wireTotal.toFixed(2)),
    country: c,
    referenceId,
    paymentMethod: 'bank_transfer'
  });
  const wire: SimplifiedWireMethod = {
    provider: 'transak',
    configured: Boolean(wireWidgetUrl),
    totalUsd: Number(wireTotal.toFixed(2)),
    displayCurrency: 'USD',
    feeBps: wireFeeBps,
    widgetUrl: wireWidgetUrl
  };

  return {
    fiatWallet,
    cryptoWallet,
    card,
    wire,
    treasuryAddress,
    country: c
  };
}
