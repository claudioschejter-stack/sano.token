import type { PaymentCheckoutRow } from './paymentCheckoutCatalog';

export type CheckoutFlowMode = 'purchase' | 'deposit';

const STRIPE_OPTION_IDS = new Set([
  'apple_pay',
  'google_pay',
  'debit_card',
  'credit_card',
  'paypal'
]);

const PURCHASE_ON_RAMP_METHODS = new Set(['RIPIO', 'TRANSAK', 'BRIDGE']);
const PURCHASE_DIRECT_USDC = new Set(['USDC_ONCHAIN', 'COINBASE']);

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

export function checkoutRowAllowedForMode(row: PaymentCheckoutRow, mode: CheckoutFlowMode): boolean {
  if (isStripeCheckoutRow(row)) {
    return false;
  }

  if (mode === 'purchase') {
    if (DEPOSIT_MP_OPTION_IDS.has(row.id) || row.method === 'MERCADO_PAGO') {
      return false;
    }
    if (row.method === 'LOCAL_RAIL' || row.method === 'CUSTODIAL_STABLECOIN') {
      return false;
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

  // deposit: on-ramps + USDC Base + MP (vía Ripio en backend)
  if (row.method === 'MERCADO_PAGO' || DEPOSIT_MP_OPTION_IDS.has(row.id)) {
    return true;
  }
  if (isPurchaseOnRampRow(row) || row.method === 'USDC_ONCHAIN') {
    return isDirectBaseUsdcRow(row) || isPurchaseOnRampRow(row);
  }
  if (row.method === 'LOCAL_RAIL') {
    return false;
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
