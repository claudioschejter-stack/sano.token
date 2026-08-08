import type { PaymentCheckoutRow } from './paymentCheckoutCatalog';
import { isMacroClickConfigured } from './macroClick/config';
import { ripioConfigured } from './ripioAvailability';

export type CheckoutFlowMode = 'purchase' | 'deposit';

const STRIPE_OPTION_IDS = new Set([
  'apple_pay',
  'google_pay',
  'debit_card',
  'credit_card',
  'paypal'
]);

/**
 * Three rails, not fourteen.
 *
 * The catalogue carried every provider ever considered, and most of them were
 * half-built: Ramp always answered "not integrated", Stripe was disabled in
 * code, Wise was a set of manual instructions, AstroPay and Binance Pay were
 * partial. Offering them is not offering fourteen options — it is offering
 * fourteen ways to fail, each of which has to be maintained, debugged and
 * reconciled.
 *
 * What survives is what works end to end: USDC directly, Macro for Argentina,
 * and Bridge for every other country's own instant rail. Turning the rest off is
 * one list; keeping them alive is permanent work.
 */
const PURCHASE_ON_RAMP_METHODS = new Set(['BRIDGE', 'PRIVY_ONRAMP', 'RIPIO']);
const PURCHASE_DIRECT_USDC = new Set(['USDC_ONCHAIN', 'COINBASE']);

/**
 * Providers that stay hidden until they work end to end. Kept as a list rather
 * than deleted so re-enabling one is a decision, not an archaeology exercise.
 */
const RETIRED_PROVIDERS = new Set(['ramp', 'wise', 'astropay', 'ebanx']);

const RETIRED_OPTION_IDS = new Set(['binance_pay', 'binance_usdc']);

export function isRetiredCheckoutRow(row: PaymentCheckoutRow): boolean {
  return RETIRED_PROVIDERS.has(row.provider) || RETIRED_OPTION_IDS.has(row.id);
}

/** Mercado Pago solo para depósito; compras fiat van por on-ramp → USDC Base treasury. */
const DEPOSIT_MP_OPTION_IDS = new Set(['mercadopago_wallet', 'mercado_pago']);

export function isStripeCheckoutRow(row: PaymentCheckoutRow): boolean {
  return row.provider === 'stripe' || STRIPE_OPTION_IDS.has(row.id);
}

export function isPurchaseOnRampRow(row: PaymentCheckoutRow): boolean {
  return PURCHASE_ON_RAMP_METHODS.has(row.method);
}

export function isDirectBaseUsdcRow(row: PaymentCheckoutRow): boolean {
  return (
    row.method === 'USDC_ONCHAIN' &&
    (row.stablecoinNetwork ?? 'BASE').toUpperCase() === 'BASE'
  );
}

function isLocalRailCheckoutRow(row: PaymentCheckoutRow): boolean {
  if (row.method !== 'LOCAL_RAIL') {
    return false;
  }
  // EBANX never worked end to end; Macro is the live local rail.
  return row.provider === 'macro_click';
}

function localRailCheckoutEnabled(row: PaymentCheckoutRow): boolean {
  if (!isLocalRailCheckoutRow(row)) {
    return false;
  }
  /**
   * Macro is a direct integration, not an aggregator, so it must not be gated
   * behind the aggregator flag. It was excluded from checkout for exactly this
   * reason: the rail was built and configured, and the policy still hid it.
   */
  return isMacroClickConfigured();
}

export function checkoutRowAllowedForMode(row: PaymentCheckoutRow, mode: CheckoutFlowMode): boolean {
  if (isStripeCheckoutRow(row) || isRetiredCheckoutRow(row)) {
    return false;
  }

  if (mode === 'purchase') {
    /**
     * Mercado Pago cannot fund a purchase, and the code already says so:
     * `/api/payments/mercadopago/process` answers `MP_CART_DISABLED_USE_ONRAMP`.
     * The reason is structural — a purchase has to land as USDC in the treasury
     * and MP delivers pesos into an MP account, so it needs a converter behind
     * it. Listing it here put a button in front of investors that returns a 400.
     */
    if (DEPOSIT_MP_OPTION_IDS.has(row.id) || row.method === 'MERCADO_PAGO') {
      return false;
    }
    if (row.method === 'CUSTODIAL_STABLECOIN') {
      return false;
    }
    if (row.method === 'LOCAL_RAIL') {
      return localRailCheckoutEnabled(row);
    }
    if (isPurchaseOnRampRow(row)) {
      return true;
    }
    if (PURCHASE_DIRECT_USDC.has(row.method)) {
      return isDirectBaseUsdcRow(row) || row.method === 'COINBASE';
    }
    if (row.id === 'binance_pay' || row.id === 'coinbase_commerce' || row.id === 'coinbase_pay') {
      return true;
    }
    return row.method === 'USDC_ONCHAIN' && isDirectBaseUsdcRow(row);
  }

  /**
   * Deposits through Mercado Pago settle by handing the pesos to Ripio, which
   * sends USDC to the treasury. Without Ripio configured that chain has no
   * second half, and the deposit would sit in an MP account with nothing to
   * convert it.
   */
  if (row.method === 'MERCADO_PAGO' || DEPOSIT_MP_OPTION_IDS.has(row.id)) {
    return ripioConfigured();
  }
  if (isPurchaseOnRampRow(row) || row.method === 'USDC_ONCHAIN') {
    return isDirectBaseUsdcRow(row) || isPurchaseOnRampRow(row);
  }
  if (row.method === 'LOCAL_RAIL') {
    return localRailCheckoutEnabled(row);
  }
  return false;
}

export function paymentRowsForCheckoutMode(country: string, rows: PaymentCheckoutRow[], mode: CheckoutFlowMode) {
  const normalized = country.trim().toUpperCase();
  return rows.filter(
    (row) =>
      checkoutRowAllowedForMode(row, mode) &&
      (!row.countries || row.countries.includes(normalized)) &&
      (!row.excludedCountries || !row.excludedCountries.includes(normalized))
  );
}

export function resolveDepositMethodForUsdcBase(row: PaymentCheckoutRow): {
  method: PaymentCheckoutRow['method'];
  ripioRail?: string | null;
} {
  if (row.method === 'MERCADO_PAGO' || DEPOSIT_MP_OPTION_IDS.has(row.id)) {
    return {
      method: 'RIPIO',
      ripioRail: row.providerRail === 'wallet_embedded' ? 'mercado_pago' : row.providerRail
    };
  }
  return { method: row.method, ripioRail: row.providerRail };
}

export function morphoTreasuryVaultAddress(): string | null {
  return (
    process.env.METAMORPHO_VAULT_ADDRESS?.trim() ||
    process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() ||
    null
  );
}
