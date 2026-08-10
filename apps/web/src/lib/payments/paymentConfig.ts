import { enabledStablecoinNetworks, getStablecoinNetwork } from './stablecoinNetworks';
import { isMacroClickConfigured } from './macroClick/config';

export type PaymentMethodId =
  | 'INTERNAL_BALANCE'
  | 'USDC_ONCHAIN'
  | 'LOCAL_RAIL'
  | 'BRIDGE'
  | 'PRIVY_ONRAMP'
  | 'RIPIO'
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

  /**
   * Macro is a direct bank integration, not one of the aggregators, so its own
   * credentials are enough. Measuring the rail only by the aggregator flag left
   * a fully configured Macro checkout throwing `PAYMENT_METHOD_NOT_CONFIGURED`.
   */
  /**
   * El carril local es Macro. Los agregadores (EBANX, AstroPay) se retiraron, así
   * que sus claves ya no lo habilitan — antes bastaba una de ellas para declarar
   * el carril configurado sin que hubiera nadie cobrando.
   */
  if (method === 'LOCAL_RAIL') {
    return Boolean(isMacroClickConfigured() || process.env.LOCAL_RAILS_ENABLED === 'true');
  }

  if (method === 'BRIDGE') {
    return Boolean(process.env.BRIDGE_API_KEY);
  }

  /** The card on-ramp is provisioned by Privy, so the Privy app id is the key. */
  if (method === 'PRIVY_ONRAMP') {
    return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim());
  }

  if (method === 'RIPIO') {
    return Boolean(process.env.RIPIO_CLIENT_ID && process.env.RIPIO_CLIENT_SECRET);
  }

  if (method === 'MERCADO_PAGO') {
    return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
  }

  // Métodos retirados (STRIPE, RAMP, COINBASE, CUSTODIAL_STABLECOIN): sin
  // cobrador detrás, así que nunca están configurados.
  return false;
}

export function checkoutBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}

export function paymentMinimumConfirmations(): number {
  const raw = Number(process.env.PAYMENT_MIN_CONFIRMATIONS ?? process.env.AUTOMATION_TX_CONFIRMATIONS ?? 2);
  return Number.isInteger(raw) && raw > 0 ? Math.min(raw, 64) : 2;
}
