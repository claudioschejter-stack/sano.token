import { checkoutBaseUrl } from './paymentConfig';
import { paymentGatewayConfigured } from './paymentConfig';

export type BinancePayCheckoutResult = {
  provider: string;
  providerPaymentId?: string;
  providerCheckoutUrl?: string;
  metadata?: Record<string, unknown>;
};

function binancePayConfigured(): boolean {
  return Boolean(
    process.env.BINANCE_PAY_API_KEY?.trim() && process.env.BINANCE_PAY_SECRET_KEY?.trim()
  );
}

/**
 * Binance Pay checkout — redirects to Binance Pay when merchant credentials are configured.
 * Otherwise falls back to direct USDC transfer instructions.
 */
export function createBinancePayCheckout(input: {
  referenceId: string;
  amountUsd: number;
  redirectPath?: string | null;
}): BinancePayCheckoutResult {
  if (!binancePayConfigured()) {
    return {
      provider: 'binance',
      metadata: {
        configured: paymentGatewayConfigured('USDC_ONCHAIN'),
        mode: 'usdc_wallet_fallback',
        reason: 'BINANCE_PAY_NOT_CONFIGURED'
      }
    };
  }

  const merchantId = process.env.BINANCE_PAY_MERCHANT_ID?.trim() ?? '';
  const returnUrl = input.redirectPath
    ? `${checkoutBaseUrl()}${input.redirectPath}`
    : `${checkoutBaseUrl()}/marketplace/carrito?status=success`;

  const params = new URLSearchParams({
    merchantId,
    referenceGoodsId: input.referenceId,
    fiatAmount: input.amountUsd.toFixed(2),
    fiatCurrency: 'USD',
    returnUrl
  });

  return {
    provider: 'binance',
    providerPaymentId: input.referenceId,
    providerCheckoutUrl: `https://bpay.binanceapi.com/checkout?${params.toString()}`,
    metadata: {
      configured: true,
      mode: 'binance_pay',
      referenceId: input.referenceId
    }
  };
}
