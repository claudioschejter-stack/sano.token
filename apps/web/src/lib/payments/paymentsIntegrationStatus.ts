import { paymentGatewayConfigured } from './paymentConfig';
import { enabledStablecoinNetworks } from './stablecoinNetworks';

export type PaymentIntegrationItem = {
  id: string;
  label: string;
  configured: boolean;
  envKeys: string[];
};

export const WEBHOOK_PATHS = {
  stripe: '/api/webhooks/stripe',
  mercadopago: '/api/webhooks/mercadopago',
  coinbase: '/api/webhooks/coinbase',
  transak: '/api/webhooks/transak',
  bridge: '/api/webhooks/bridge',
  ripio: '/api/webhooks/ripio',
  dlocal: '/api/webhooks/dlocal',
  ebanx: '/api/webhooks/ebanx',
  astropay: '/api/webhooks/astropay'
} as const;

export function getPaymentsIntegrationStatus(): PaymentIntegrationItem[] {
  return [
    {
      id: 'stablecoin-base',
      label: 'USDC Base (treasury + token)',
      configured: Boolean(
        (process.env.BASE_USDC_TOKEN_ADDRESS || process.env.USDC_TOKEN_ADDRESS) &&
          (process.env.BASE_STABLECOIN_TREASURY_ADDRESS ||
            process.env.STABLECOIN_TREASURY_ADDRESS ||
            process.env.TOKEN_TREASURY_ADDRESS)
      ),
      envKeys: ['BASE_USDC_TOKEN_ADDRESS', 'BASE_STABLECOIN_TREASURY_ADDRESS']
    },
    {
      id: 'stripe',
      label: 'Stripe',
      configured: paymentGatewayConfigured('STRIPE'),
      envKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
    },
    {
      id: 'mercadopago',
      label: 'Mercado Pago',
      configured: paymentGatewayConfigured('MERCADO_PAGO'),
      envKeys: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET']
    },
    {
      id: 'coinbase',
      label: 'Coinbase Commerce',
      configured: paymentGatewayConfigured('COINBASE'),
      envKeys: ['COINBASE_COMMERCE_API_KEY', 'COINBASE_COMMERCE_WEBHOOK_SECRET']
    },
    {
      id: 'transak',
      label: 'Transak on-ramp',
      configured: paymentGatewayConfigured('TRANSAK'),
      envKeys: ['TRANSAK_API_KEY', 'TRANSAK_WEBHOOK_SECRET']
    },
    {
      id: 'bridge',
      label: 'Bridge VA / on-ramp (USDC Base)',
      configured:
        paymentGatewayConfigured('BRIDGE') &&
        Boolean(process.env.BRIDGE_WEBHOOK_PUBLIC_KEY?.trim() || process.env.BRIDGE_WEBHOOK_SECRET?.trim()),
      envKeys: ['BRIDGE_API_KEY', 'BRIDGE_WEBHOOK_PUBLIC_KEY', 'BRIDGE_WEBHOOK_SECRET']
    },
    {
      id: 'ripio',
      label: 'Ripio on-ramp (ARS → USDC)',
      configured: paymentGatewayConfigured('RIPIO'),
      envKeys: ['RIPIO_CLIENT_ID', 'RIPIO_CLIENT_SECRET', 'RIPIO_WEBHOOK_SECRET']
    },
    {
      id: 'local-rails',
      label: 'Rails locales (dLocal / EBANX)',
      configured: paymentGatewayConfigured('LOCAL_RAIL'),
      envKeys: ['LOCAL_RAILS_ENABLED', 'DLOCAL_API_KEY', 'EBANX_API_KEY', 'ASTROPAY_API_KEY']
    },
    {
      id: 'astropay',
      label: 'AstroPay',
      configured: Boolean(process.env.ASTROPAY_API_KEY?.trim()),
      envKeys: ['ASTROPAY_API_KEY']
    },
    {
      id: 'wise',
      label: 'Wise',
      configured: Boolean(process.env.WISE_API_KEY?.trim() || process.env.BRIDGE_API_KEY?.trim()),
      envKeys: ['WISE_API_KEY', 'BRIDGE_API_KEY']
    },
    {
      id: 'binance-pay',
      label: 'Binance Pay',
      configured: Boolean(process.env.BINANCE_PAY_API_KEY?.trim()),
      envKeys: ['BINANCE_PAY_API_KEY']
    }
  ];
}

export function getPaymentsProductionSummary(siteUrl: string) {
  const integrations = getPaymentsIntegrationStatus();
  const networksReady = enabledStablecoinNetworks().map((network) => network.id);
  const configuredCount = integrations.filter((item) => item.configured).length;
  const missing = integrations.filter((item) => !item.configured);

  return {
    siteUrl,
    networksReady,
    configuredCount,
    totalIntegrations: integrations.length,
    productionReady:
      networksReady.includes('BASE') &&
      integrations.some(
        (item) =>
          ['stripe', 'transak', 'mercadopago', 'ripio', 'local-rails', 'astropay', 'bridge', 'coinbase'].includes(item.id) &&
          item.configured
      ),
    integrations,
    missing,
    webhooks: Object.fromEntries(
      Object.entries(WEBHOOK_PATHS).map(([key, path]) => [key, `${siteUrl.replace(/\/$/, '')}${path}`])
    )
  };
}
