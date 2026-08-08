import { getStablecoinNetwork } from './stablecoinNetworks';
import { resolveMercadoPagoChargeAmount } from './mercadoPagoCharge';
import { mercadoPagoAccessToken } from './mercadoPagoClient';
import { isMercadoPagoPixConfigured } from './mercadoPagoPix/config';
import { getBridgeApiKey, isBridgeWireCountry } from './bridgeClient';
import { ripioConfigured } from './ripioClient';
import { isMacroClickConfigured } from './macroClick/config';
import { quoteBaseCryptoCheckoutGasUsd } from './baseUserPaysGasQuote';

// ---------------------------------------------------------------------------
// FX table (fallback rates; production should use FX_ARS or a per-rail override)
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

/**
 * @deprecated Fixed estimate removed — crypto checkout uses live Base User-pays gas quotes.
 * Kept as a last-resort fallback only when RPC/price oracles fail.
 */
export const CRYPTO_BASE_GAS_USD = 0.02;

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
  /** Live User-pays gas quote (USDC) already included in totalUsd. */
  networkFeeUsd: number;
  /** ISO timestamp of the gas quote (null when fallback constant was used). */
  networkFeeQuotedAt: string | null;
  /** Quote validity window in seconds for the crypto panel countdown. */
  networkFeeQuoteTtlSec: number;
  stablecoinNetwork: string;
};

export type SimplifiedCardMethod = {
  provider: 'privy' | 'mercado_pago_embedded' | 'macro_click';
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
  provider: 'macro_click' | 'bridge';
  configured: boolean;
  totalUsd: number;
  totalLocal: number;
  displayCurrency: string;
  feeBps: number;
  widgetUrl: string | null;
};

export type SimplifiedRipioMethod = {
  configured: boolean;
  totalUsd: number;
  displayCurrency: 'ARS' | 'USD';
  totalLocal: number;
  feeBps: number;
};

export type CheckoutBestRoutes = {
  fiatWallet: SimplifiedFiatWalletMethod;
  cryptoWallet: SimplifiedCryptoWalletMethod;
  card: SimplifiedCardMethod;
  wire: SimplifiedWireMethod;
  ripio: SimplifiedRipioMethod;
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
  macro_card: 199, // Macro hosted button, debit/credit
  macro_wire: 80, // Macro transfer
  bridge_wire: 80 // Bridge VA ACH/wire developer fee ballpark
};

/** Where Macro can collect. Its licence is Argentine; nothing else is claimed. */
function isMacroCountry(country: string): boolean {
  return country === 'AR';
}

function bridgeApiConfigured(): boolean {
  return Boolean(getBridgeApiKey());
}

function prefersBridgeWire(country: string): boolean {
  return isBridgeWireCountry(country) && bridgeApiConfigured();
}

/**
 * Transak is retired.
 *
 * It was the fallback for the card, the transfer and the wallet lane in every
 * country nobody else covered, which made it look like broad coverage while
 * nothing was actually verified through it. Argentina now pays cards and
 * transfers through Macro, which is the bank the operation already runs on.
 *
 * Where no provider is configured the lane reports itself unavailable. That is
 * the honest answer, and it is also the useful one: a lane that offers itself and
 * fails at the last step costs the investor a checkout, while one that says no up
 * front costs nothing.
 */
function fiatFeeBpsForCountry(country: string): number {
  if (country === 'AR') return FEES.mercado_pago_fiat + FX_BUFFER_BPS;
  if (country === 'BR') return FEES.pix_br + FX_BUFFER_BPS;
  return FEES.mercado_pago_fiat + FX_BUFFER_BPS;
}

function fiatConfiguredForCountry(country: string): boolean {
  if (country === 'AR') return Boolean(mercadoPagoAccessToken());
  if (country === 'BR') return isMercadoPagoPixConfigured();
  return false;
}

function fiatProviderForCountry(country: string): 'mercado_pago' | null {
  if (country === 'AR' || country === 'BR') return 'mercado_pago';
  return null;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

export async function resolveCheckoutBestRoutes(input: {
  amountUsd: number;
  country: string;
  referenceId: string;
  investorName?: string;
  /** Optional Sanova wallet — improves eth_estimateGas accuracy. */
  payerAddress?: string | null;
}): Promise<CheckoutBestRoutes> {
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
    widgetUrl: null,
    mpPreferenceId: null,
    staticQrData: process.env.FIAT_STATIC_QR_DATA?.trim() || null
  };

  // --- Crypto wallet: investment + live User-pays gas (USDC on Base) ---
  let networkFeeUsd = CRYPTO_BASE_GAS_USD;
  let networkFeeQuotedAt: string | null = null;
  try {
    // RWA carts usually settle via approve+deposit (vault). Quote the heavier path so
    // the payable amount never understates User-pays gas vs a single transfer.
    const [transferQuote, vaultQuote] = await Promise.all([
      quoteBaseCryptoCheckoutGasUsd({
        amountUsd,
        fromAddress: input.payerAddress,
        path: 'transfer'
      }),
      quoteBaseCryptoCheckoutGasUsd({
        amountUsd,
        fromAddress: input.payerAddress,
        path: 'vault'
      })
    ]);
    const gasQuote =
      vaultQuote.networkFeeUsd >= transferQuote.networkFeeUsd ? vaultQuote : transferQuote;
    networkFeeUsd = gasQuote.networkFeeUsd;
    networkFeeQuotedAt = gasQuote.quotedAt;
  } catch (error) {
    console.warn('[checkout-methods] live gas quote failed; using fallback', error);
  }
  const cryptoTotalUsd = Number((amountUsd + networkFeeUsd).toFixed(6));
  const cryptoWallet: SimplifiedCryptoWalletMethod = {
    configured: Boolean(treasuryAddress),
    totalUsd: cryptoTotalUsd,
    displayCurrency: 'USDC',
    feeBps: 0,
    networkFeeUsd,
    networkFeeQuotedAt,
    networkFeeQuoteTtlSec: 30,
    stablecoinNetwork: 'BASE'
  };

  /**
   * Card through Macro, which is the bank the operation already runs on.
   *
   * Its hosted button takes debit and credit, settles to the treasury and reports
   * back by webhook — the same path the transfer lane uses, so one integration
   * covers both instead of a separate provider per card.
   */
  const macroReady = isMacroClickConfigured();
  const cardFeeBps = FEES.macro_card + FX_BUFFER_BPS;
  const cardLocal = resolveLocalAmount(amountUsd, c, cardFeeBps);
  const card: SimplifiedCardMethod = {
    provider: 'macro_click',
    configured: macroReady && isMacroCountry(c),
    totalUsd: Number(cardLocal.totalUsd.toFixed(2)),
    totalLocal: cardLocal.totalLocal,
    displayCurrency: cardLocal.displayCurrency,
    feeBps: cardFeeBps,
    widgetUrl: null,
    mpPublicKey: null,
    mpSandbox: false
  };

  // --- Wire: Bridge virtual account where it reaches; Macro in Argentina ---
  const useBridgeWire = prefersBridgeWire(c);
  const useMacroWire = !useBridgeWire && macroReady && isMacroCountry(c);
  const wireFeeBps = (useBridgeWire ? FEES.bridge_wire : FEES.macro_wire) + FX_BUFFER_BPS;
  /**
   * Quote the transfer in the payer's own currency, like every other lane.
   *
   * It used to show USD while the wallet and card lanes showed pesos, so the
   * cheapest option looked like the most expensive: 20.20 next to 21.294 reads
   * as a smaller number until you notice they are different currencies. The
   * investor pays in local currency either way.
   */
  const wireLocal = resolveLocalAmount(amountUsd, c, wireFeeBps);
  const wire: SimplifiedWireMethod = {
    provider: useBridgeWire ? 'bridge' : 'macro_click',
    configured: useBridgeWire ? bridgeApiConfigured() : useMacroWire,
    totalUsd: Number(wireLocal.totalUsd.toFixed(2)),
    totalLocal: wireLocal.totalLocal,
    displayCurrency: wireLocal.displayCurrency,
    feeBps: wireFeeBps,
    widgetUrl: null
  };

  const ripioFeeBps = 140;
  const ripioLocal = resolveLocalAmount(amountUsd, c === 'AR' ? 'AR' : c, ripioFeeBps);
  const ripio: SimplifiedRipioMethod = {
    configured: c === 'AR' && ripioConfigured(),
    totalUsd: Number(ripioLocal.totalUsd.toFixed(2)),
    totalLocal: ripioLocal.totalLocal,
    displayCurrency: c === 'AR' ? 'ARS' : 'USD',
    feeBps: ripioFeeBps
  };

  return {
    fiatWallet,
    cryptoWallet,
    card,
    wire,
    ripio,
    treasuryAddress,
    country: c
  };
}
