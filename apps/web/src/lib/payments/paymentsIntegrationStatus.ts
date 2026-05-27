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
  bridge: '/api/webhooks/bridge'
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
      id: 'stablecoin-polygon',
      label: 'USDC Polygon',
      configured: Boolean(process.env.POLYGON_USDC_TOKEN_ADDRESS && process.env.POLYGON_STABLECOIN_TREASURY_ADDRESS),
      envKeys: ['POLYGON_USDC_TOKEN_ADDRESS', 'POLYGON_STABLECOIN_TREASURY_ADDRESS']
    },
    {
      id: 'stablecoin-tron',
      label: 'USDT TRON',
      configured: Boolean(process.env.TRON_USDT_TOKEN_ADDRESS && process.env.TRON_STABLECOIN_TREASURY_ADDRESS),
      envKeys: ['TRON_USDT_TOKEN_ADDRESS', 'TRON_STABLECOIN_TREASURY_ADDRESS']
    },
    {
      id: 'stablecoin-solana',
      label: 'USDC Solana',
      configured: Boolean(process.env.SOLANA_USDC_MINT_ADDRESS && process.env.SOLANA_STABLECOIN_TREASURY_ADDRESS),
      envKeys: ['SOLANA_USDC_MINT_ADDRESS', 'SOLANA_STABLECOIN_TREASURY_ADDRESS']
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
      label: 'Bridge on-ramp',
      configured: paymentGatewayConfigured('BRIDGE'),
      envKeys: ['BRIDGE_API_KEY', 'BRIDGE_WEBHOOK_SECRET']
    },
    {
      id: 'local-rails',
      label: 'Rails locales',
      configured: paymentGatewayConfigured('LOCAL_RAIL'),
      envKeys: ['LOCAL_RAILS_ENABLED', 'DLOCAL_API_KEY', 'EBANX_API_KEY']
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
        (item) => (item.id === 'stripe' || item.id === 'transak' || item.id === 'mercadopago') && item.configured
      ),
    integrations,
    missing,
    webhooks: Object.fromEntries(
      Object.entries(WEBHOOK_PATHS).map(([key, path]) => [key, `${siteUrl.replace(/\/$/, '')}${path}`])
    )
  };
}
