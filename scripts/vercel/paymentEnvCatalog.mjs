/** Catálogo de variables para cartera y pasarela de pagos. */
export const MAINNET_STABLECOIN_DEFAULTS = {
  BASE_USDC_TOKEN_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  POLYGON_USDC_TOKEN_ADDRESS: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  TRON_USDT_TOKEN_ADDRESS: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  SOLANA_USDC_MINT_ADDRESS: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
};

export const PAYMENT_ENV_GROUPS = [
  {
    id: 'core',
    label: 'Límites y TTL de pagos',
    required: false,
    keys: [
      'PAYMENT_ORDER_TTL_MINUTES',
      'PAYMENT_MIN_CONFIRMATIONS',
      'PAYMENT_DAILY_USER_LIMIT_USD',
      'PAYMENT_DAILY_PROJECT_LIMIT_USD',
      'PAYMENT_DAILY_WALLET_LIMIT_USD'
    ]
  },
  {
    id: 'treasury-base',
    label: 'Treasury Base (USDC)',
    required: true,
    keys: ['BASE_STABLECOIN_TREASURY_ADDRESS', 'BASE_USDC_TOKEN_ADDRESS', 'BASE_STABLECOIN_CHAIN_ID', 'BASE_RPC_URL']
  },
  {
    id: 'treasury-polygon',
    label: 'Treasury Polygon (USDC)',
    required: false,
    keys: ['POLYGON_STABLECOIN_TREASURY_ADDRESS', 'POLYGON_USDC_TOKEN_ADDRESS', 'POLYGON_RPC_URL']
  },
  {
    id: 'treasury-tron',
    label: 'Treasury TRON (USDT)',
    required: false,
    keys: ['TRON_STABLECOIN_TREASURY_ADDRESS', 'TRON_USDT_TOKEN_ADDRESS', 'TRON_GRID_API_URL']
  },
  {
    id: 'treasury-solana',
    label: 'Treasury Solana (USDC)',
    required: false,
    keys: ['SOLANA_STABLECOIN_TREASURY_ADDRESS', 'SOLANA_USDC_MINT_ADDRESS', 'SOLANA_RPC_URL']
  },
  {
    id: 'stripe',
    label: 'Stripe',
    required: false,
    keys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
  },
  {
    id: 'mercadopago',
    label: 'Mercado Pago',
    required: false,
    keys: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET']
  },
  {
    id: 'macro-click',
    label: 'Click de Pago (Banco Macro)',
    required: false,
    keys: [
      'MACRO_CLICK_GUID',
      'MACRO_CLICK_FRASE',
      'MACRO_CLICK_SECRET_KEY',
      'MACRO_CLICK_ENV',
      'MACRO_CLICK_SUCURSAL',
      'MACRO_CLICK_FX_ARS'
    ]
  },
  {
    id: 'coinbase',
    label: 'Coinbase Commerce',
    required: false,
    keys: ['COINBASE_COMMERCE_API_KEY', 'COINBASE_COMMERCE_WEBHOOK_SECRET']
  },
  {
    id: 'transak',
    label: 'Transak on/off-ramp',
    required: false,
    keys: ['TRANSAK_API_KEY', 'TRANSAK_WEBHOOK_SECRET', 'TRANSAK_ENV']
  },
  {
    id: 'ripio',
    label: 'Ripio on-ramp (ARS → USDC)',
    required: false,
    keys: [
      'RIPIO_CLIENT_ID',
      'RIPIO_CLIENT_SECRET',
      'RIPIO_WEBHOOK_SECRET',
      'RIPIO_API_BASE_URL',
      'RIPIO_ENV',
      'RIPIO_CHAIN',
      'RIPIO_FX_ARS'
    ]
  },
  {
    id: 'bridge',
    label: 'Bridge on-ramp (VA)',
    required: false,
    keys: ['BRIDGE_API_KEY', 'BRIDGE_WEBHOOK_PUBLIC_KEY', 'BRIDGE_WEBHOOK_SECRET']
  },
  {
    id: 'bridge-payouts',
    label: 'Bridge fiat offramp (gated)',
    required: false,
    keys: ['BRIDGE_PAYOUTS_ENABLED', 'BRIDGE_WALLET_ID', 'BRIDGE_WALLET_CURRENCY', 'BRIDGE_PAYOUT_DEVELOPER_FEE']
  },
  {
    id: 'local-rails',
    label: 'Rails locales (dLocal / EBANX)',
    required: false,
    keys: [
      'LOCAL_RAILS_ENABLED',
      'DLOCAL_API_KEY',
      'DLOCAL_X_TRANS_KEY',
      'DLOCAL_SECRET_KEY',
      'DLOCAL_NOTIFICATION_SECRET',
      'DLOCAL_API_BASE_URL',
      'DLOCAL_CHECKOUT_BASE_URL',
      'DLOCAL_DEFAULT_COUNTRY',
      'EBANX_API_KEY'
    ]
  },
  {
    id: 'astropay',
    label: 'AstroPay',
    required: false,
    keys: ['ASTROPAY_API_KEY']
  },
  {
    id: 'wise',
    label: 'Wise / transferencias internacionales',
    required: false,
    keys: ['WISE_API_KEY']
  },
  {
    id: 'binance',
    label: 'Binance Pay',
    required: false,
    keys: ['BINANCE_PAY_API_KEY']
  },
  {
    id: 'ramp',
    label: 'Ramp Network',
    required: false,
    keys: ['RAMP_API_KEY', 'RAMP_WEBHOOK_SECRET']
  },
  {
    id: 'privy',
    label: 'Privy (embedded wallet + on-ramp)',
    required: false,
    keys: [
      'NEXT_PUBLIC_PRIVY_APP_ID',
      'PRIVY_APP_SECRET',
      'PRIVY_VAULT_ID',
      'PRIVY_TREASURY_WALLET_ID',
      'PRIVY_SAFE_OWNER_WALLET_ID',
      'TREASURY_OWNER_ADDRESS',
      'PRIVY_MORPHO_LIQUIDITY_WALLET_ID',
      'MORPHO_LIQUIDITY_ADDRESS',
      'PRIVY_OPERATOR_WALLET_ID',
      'RWA_OPERATOR_ADDRESS'
    ]
  },
  {
    id: 'paypal',
    label: 'PayPal (vía Stripe u opcional)',
    required: false,
    keys: ['PAYPAL_CLIENT_ID', 'PAYPAL_SECRET']
  }
];

export const SHARED_TREASURY_KEYS = ['STABLECOIN_TREASURY_ADDRESS', 'TOKEN_TREASURY_ADDRESS', 'SANOVA_TREASURY_ADDRESS'];

export function resolvePaymentEnv(env) {
  const sharedTreasury =
    env.STABLECOIN_TREASURY_ADDRESS?.trim() ||
    env.TOKEN_TREASURY_ADDRESS?.trim() ||
    env.SANOVA_TREASURY_ADDRESS?.trim() ||
    '';

  const resolved = { ...env };

  if (sharedTreasury) {
    resolved.STABLECOIN_TREASURY_ADDRESS = sharedTreasury;
    if (!resolved.BASE_STABLECOIN_TREASURY_ADDRESS?.trim()) {
      resolved.BASE_STABLECOIN_TREASURY_ADDRESS = sharedTreasury;
    }
    if (!resolved.POLYGON_STABLECOIN_TREASURY_ADDRESS?.trim()) {
      resolved.POLYGON_STABLECOIN_TREASURY_ADDRESS = sharedTreasury;
    }
  }

  for (const [key, value] of Object.entries(MAINNET_STABLECOIN_DEFAULTS)) {
    if (!resolved[key]?.trim()) {
      resolved[key] = value;
    }
  }

  if (!resolved.STABLECOIN_DEFAULT_NETWORK?.trim()) resolved.STABLECOIN_DEFAULT_NETWORK = 'BASE';
  if (!resolved.STABLECOIN_ENABLED_NETWORKS?.trim()) {
    resolved.STABLECOIN_ENABLED_NETWORKS = 'BASE,POLYGON,TRON,SOLANA';
  }
  if (!resolved.BASE_STABLECOIN_CHAIN_ID?.trim()) resolved.BASE_STABLECOIN_CHAIN_ID = '8453';
  if (!resolved.BASE_RPC_URL?.trim()) resolved.BASE_RPC_URL = 'https://mainnet.base.org';
  if (!resolved.TRANSAK_ENV?.trim()) resolved.TRANSAK_ENV = 'PRODUCTION';
  if (!resolved.DLOCAL_DEFAULT_COUNTRY?.trim()) resolved.DLOCAL_DEFAULT_COUNTRY = 'AR';
  if (!resolved.DLOCAL_CHECKOUT_BASE_URL?.trim()) {
    resolved.DLOCAL_CHECKOUT_BASE_URL = 'https://checkout.dlocal.com';
  }

  return resolved;
}

export function evaluatePaymentEnv(envInput) {
  const env = resolvePaymentEnv(envInput);
  const missing = [];
  const configured = [];

  for (const group of PAYMENT_ENV_GROUPS) {
    const groupMissing = [];
    for (const key of group.keys) {
      if (env[key]?.trim()) {
        configured.push(key);
      } else {
        groupMissing.push(key);
      }
    }
    if (group.required && groupMissing.length > 0) {
      missing.push({ group: group.id, label: group.label, keys: groupMissing });
    }
  }

  const hasAnyGateway =
    [
      'STRIPE_SECRET_KEY',
      'MERCADOPAGO_ACCESS_TOKEN',
      'MACRO_CLICK_GUID',
      'COINBASE_COMMERCE_API_KEY',
      'TRANSAK_API_KEY',
      'BRIDGE_API_KEY',
      'DLOCAL_API_KEY',
      'EBANX_API_KEY',
      'ASTROPAY_API_KEY',
      'WISE_API_KEY',
      'BINANCE_PAY_API_KEY',
      'RAMP_API_KEY'
    ].some((key) => Boolean(env[key]?.trim())) || env.LOCAL_RAILS_ENABLED === 'true';

  const networksReady = ['BASE', 'POLYGON', 'TRON', 'SOLANA'].filter((network) => {
    if (network === 'BASE') return Boolean(env.BASE_USDC_TOKEN_ADDRESS && env.BASE_STABLECOIN_TREASURY_ADDRESS);
    if (network === 'POLYGON') return Boolean(env.POLYGON_USDC_TOKEN_ADDRESS && env.POLYGON_STABLECOIN_TREASURY_ADDRESS);
    if (network === 'TRON') return Boolean(env.TRON_USDT_TOKEN_ADDRESS && env.TRON_STABLECOIN_TREASURY_ADDRESS);
    if (network === 'SOLANA') return Boolean(env.SOLANA_USDC_MINT_ADDRESS && env.SOLANA_STABLECOIN_TREASURY_ADDRESS);
    return false;
  });

  return {
    env,
    missingRequired: missing,
    configuredKeys: configured,
    hasAnyGateway,
    networksReady,
    productionReady: networksReady.includes('BASE') && hasAnyGateway
  };
}

export const WEBHOOK_PATHS = {
  STRIPE: '/api/webhooks/stripe',
  MERCADOPAGO: '/api/webhooks/mercadopago',
  COINBASE: '/api/webhooks/coinbase',
  TRANSAK: '/api/webhooks/transak',
  BRIDGE: '/api/webhooks/bridge',
  RIPIO: '/api/webhooks/ripio',
  MACRO_CLICK: '/api/webhooks/macro-click'
};
