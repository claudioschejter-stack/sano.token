import { NextResponse } from 'next/server';
import { buildDepositPaymentOptions } from '../../../../lib/payments/depositPaymentOptions';
import { paymentGatewayConfigured } from '../../../../lib/payments/paymentConfig';
import { getPaymentsProductionSummary } from '../../../../lib/payments/paymentsIntegrationStatus';

export const dynamic = 'force-dynamic';

export async function GET() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://sano-token-web.vercel.app');

  const summary = getPaymentsProductionSummary(siteUrl);
  const arQuote = buildDepositPaymentOptions(100, 'AR', 1050, { linkedWalletAddress: '0x0000000000000000000000000000000000000001' });
  const configuredCheckoutOptions = arQuote.options.filter((row) => row.configured);
  const unavailableCheckoutOptions = arQuote.options.filter((row) => !row.configured);

  return NextResponse.json({
    ok: summary.productionReady,
    productionReady: summary.productionReady,
    networksReady: summary.networksReady,
    localRailsEnabled: process.env.LOCAL_RAILS_ENABLED === 'true',
    gateways: {
      usdcOnchain: paymentGatewayConfigured('USDC_ONCHAIN'),
      localRail: paymentGatewayConfigured('LOCAL_RAIL'),
      stripe: paymentGatewayConfigured('STRIPE'),
      mercadoPago: paymentGatewayConfigured('MERCADO_PAGO'),
      astropay: Boolean(process.env.ASTROPAY_API_KEY?.trim()),
      bridge: paymentGatewayConfigured('BRIDGE'),
      transak: paymentGatewayConfigured('TRANSAK')
    },
    checkoutArgentina: {
      totalOptions: arQuote.options.length,
      configuredCount: configuredCheckoutOptions.length,
      unavailableCount: unavailableCheckoutOptions.length,
      groups: arQuote.groups.map((group) => ({
        id: group.id,
        configured: group.available.length,
        unavailable: group.unavailable.length
      })),
      configuredLabels: configuredCheckoutOptions.map((row) => row.label)
    },
    configuredIntegrations: summary.integrations.filter((item) => item.configured).map((item) => item.id),
    missingIntegrations: summary.missing.map((item) => item.id),
    userActionRequired: summary.missing
      .filter((item) => !['stablecoin-tron', 'stablecoin-solana'].includes(item.id))
      .map((item) => ({ id: item.id, label: item.label, envKeys: item.envKeys }))
  });
}
