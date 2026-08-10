import type { PaymentCheckoutRow, PaymentProviderId } from './paymentCheckoutCatalog';
import {
  isMercadoPagoEmbeddedConfigured,
  isMercadoPagoWalletOnly,
  MERCADOPAGO_WALLET_OPTION_ID
} from './mercadoPagoEmbeddedService';
import { isPrivyOnRampConfigured } from './privyOnRampPolicy';
import { paymentGatewayConfigured } from './paymentConfig';
import { isMacroClickConfigured } from './macroClick/config';

/**
 * Si el cobrador detrás de una fila de checkout está realmente configurado.
 *
 * Este switch tenía ocho ramas más —Stripe, EBANX, AstroPay, Wise, Ramp, Binance,
 * Coinbase Commerce, custodial— y varias devolvían `true` por razones prestadas:
 * Binance se declaraba disponible con solo tener USDC configurado, y Wise con la
 * clave de Bridge. Una fila que se muestra y falla en el último paso le cuesta al
 * inversor el checkout entero, así que ahora cada proveedor responde por sus
 * propias credenciales.
 */
export function isPaymentProviderConfigured(provider: PaymentProviderId): boolean {
  switch (provider) {
    case 'usdc':
      return paymentGatewayConfigured('USDC_ONCHAIN');
    case 'mercado_pago':
      return paymentGatewayConfigured('MERCADO_PAGO');
    case 'bridge':
      return paymentGatewayConfigured('BRIDGE');
    case 'ripio':
      return paymentGatewayConfigured('RIPIO');
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

  if (row.method === 'USDC_ONCHAIN') {
    if (!paymentGatewayConfigured('USDC_ONCHAIN')) {
      return false;
    }
    if (row.id === 'privy_usdc' || row.provider === 'privy') {
      return isPrivyOnRampConfigured();
    }
    // Las demás filas USDC son wallets conectadas (MetaMask, WalletConnect,
    // Coinbase Wallet): no hay cobrador que configurar, paga el inversor.
    return true;
  }

  return isPaymentProviderConfigured(row.provider);
}
