import { enabledStablecoinNetworks, getStablecoinNetwork } from './stablecoinNetworks';

export type PaymentMethodId =
  | 'INTERNAL_BALANCE'
  | 'USDC_ONCHAIN'
  | 'LOCAL_RAIL'
  | 'BRIDGE'
  | 'TRANSAK'
  | 'RAMP'
  | 'STRIPE'
  | 'MERCADO_PAGO'
  | 'COINBASE'
  | 'CUSTODIAL_STABLECOIN';

export function paymentOrderTtlMinutes(): number {
  const raw = Number(process.env.PAYMENT_ORDER_TTL_MINUTES ?? 30);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 24 * 60) : 30;
}

export function stablecoinChainId(): number {
  return getStablecoinNetwork().chainId ?? 8453;
}

export function usdcTokenAddress(): string | null {
  return getStablecoinNetwork().tokenAddress;
}

export function usdcDecimals(): number {
  return getStablecoinNetwork().decimals;
}

export function stablecoinTreasuryAddress(): string | null {
  return getStablecoinNetwork().treasuryAddress;
}

export function custodialWalletAddress(): string | null {
  return process.env.STABLECOIN_CUSTODIAL_WALLET_ADDRESS?.trim() || stablecoinTreasuryAddress();
}

export function paymentGatewayConfigured(method: PaymentMethodId): boolean {
  if (method === 'INTERNAL_BALANCE') {
    return true;
  }

  if (method === 'USDC_ONCHAIN') {
    return enabledStablecoinNetworks().length > 0;
  }

  if (method === 'LOCAL_RAIL') {
    return Boolean(process.env.LOCAL_RAILS_ENABLED === 'true' || process.env.DLOCAL_API_KEY || process.env.EBANX_API_KEY);
  }

  if (method === 'BRIDGE') {
    return Boolean(process.env.BRIDGE_API_KEY);
  }

  if (method === 'TRANSAK') {
    return Boolean(process.env.TRANSAK_API_KEY);
  }

  if (method === 'RAMP') {
    return Boolean(process.env.RAMP_API_KEY);
  }

  if (method === 'STRIPE') {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  if (method === 'MERCADO_PAGO') {
    return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
  }

  if (method === 'COINBASE') {
    return Boolean(process.env.COINBASE_COMMERCE_API_KEY);
  }

  return Boolean(custodialWalletAddress());
}

export function checkoutBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}

export function paymentMinimumConfirmations(): number {
  const raw = Number(process.env.PAYMENT_MIN_CONFIRMATIONS ?? process.env.AUTOMATION_TX_CONFIRMATIONS ?? 2);
  return Number.isInteger(raw) && raw > 0 ? Math.min(raw, 64) : 2;
}
