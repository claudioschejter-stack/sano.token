import type { PaymentCheckoutRow, PaymentProviderId } from './paymentCheckoutCatalog';
import {
  isMercadoPagoEmbeddedConfigured,
  isMercadoPagoWalletOnly,
  MERCADOPAGO_WALLET_OPTION_ID
} from './mercadoPagoEmbeddedService';
import { isPrivyOnRampConfigured } from './privyOnRampPolicy';
import { paymentGatewayConfigured } from './paymentConfig';
import { isMacroClickConfigured } from './macroClick/config';

export function isDLocalConfigured(): boolean {
  return Boolean(process.env.DLOCAL_API_KEY?.trim() || process.env.LOCAL_RAILS_ENABLED === 'true');
}

export function isEbanxConfigured(): boolean {
  return Boolean(process.env.EBANX_API_KEY?.trim() || process.env.LOCAL_RAILS_ENABLED === 'true');
}

export function isLocalRailAggregatorConfigured(): boolean {
  return isDLocalConfigured() || isEbanxConfigured();
}

export function isAstroPayConfigured(): boolean {
  return Boolean(process.env.ASTROPAY_API_KEY?.trim()) || isLocalRailAggregatorConfigured();
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isWiseConfigured(): boolean {
  return Boolean(process.env.WISE_API_KEY?.trim() || process.env.BRIDGE_API_KEY?.trim());
}

export function isBinancePayConfigured(): boolean {
  return Boolean(process.env.BINANCE_PAY_API_KEY?.trim());
}

export function isPaymentProviderConfigured(provider: PaymentProviderId): boolean {
  switch (provider) {
    case 'usdc':
      return paymentGatewayConfigured('USDC_ONCHAIN');
    case 'stripe':
      return isStripeConfigured();
    case 'mercado_pago':
      return paymentGatewayConfigured('MERCADO_PAGO');
    case 'dlocal':
    case 'ebanx':
      return isLocalRailAggregatorConfigured();
    case 'astropay':
      return isAstroPayConfigured();
    case 'bridge':
      return paymentGatewayConfigured('BRIDGE');
    case 'wise':
      return isWiseConfigured();
    case 'transak':
      return paymentGatewayConfigured('TRANSAK');
    case 'ripio':
      return paymentGatewayConfigured('RIPIO');
    case 'ramp':
      return false;
    case 'binance':
      return isBinancePayConfigured() || paymentGatewayConfigured('USDC_ONCHAIN');
    case 'coinbase':
      return paymentGatewayConfigured('COINBASE') || paymentGatewayConfigured('USDC_ONCHAIN');
    case 'custodial':
      return paymentGatewayConfigured('CUSTODIAL_STABLECOIN');
    case 'privy':
      return isPrivyOnRampConfigured();
    case 'macro_click':
      return isMacroClickConfigured();
    default:
      return false;
  }
}

export type DepositRowContext = {
  linkedWalletAddress?: string | null;
};

export function isDepositCheckoutRowConfigured(
  row: PaymentCheckoutRow,
  context?: DepositRowContext
): boolean {
  if (row.method === 'MERCADO_PAGO' || row.id === MERCADOPAGO_WALLET_OPTION_ID || row.id === 'mercado_pago') {
    if (row.id === MERCADOPAGO_WALLET_OPTION_ID) {
      return isMercadoPagoEmbeddedConfigured();
    }
    if (row.id === 'mercado_pago' && isMercadoPagoWalletOnly()) {
      return false;
    }
    return isPaymentProviderConfigured('mercado_pago');
  }

  if (row.provider === 'stripe') {
    return false;
  }

  if (row.method === 'USDC_ONCHAIN') {
    if (!paymentGatewayConfigured('USDC_ONCHAIN')) {
      return false;
    }
    if (row.id === 'privy_usdc' || row.provider === 'privy') {
      return isPrivyOnRampConfigured();
    }
    if (row.id === 'binance_usdc' && isBinancePayConfigured()) {
      return true;
    }
    if (row.id === 'binance_pay') {
      return isBinancePayConfigured();
    }
    if (row.id === 'coinbase_pay' || row.id === 'coinbase_commerce') {
      return isPaymentProviderConfigured('coinbase');
    }
    return true;
  }

  return isPaymentProviderConfigured(row.provider);
}
