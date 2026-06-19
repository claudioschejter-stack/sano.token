import { isInvestorOpenRegistration } from '../auth/investorAccess';
import { isRwaOperatorConfigured } from '../blockchain/rwaOperatorSigner';

export type IntegrationStatus = {
  id: string;
  label: string;
  configured: boolean;
  envKeys: string[];
};

export function getOnboardingIntegrations(): IntegrationStatus[] {
  return [
    {
      id: 'open-registration',
      label: 'Registro abierto inversores',
      configured: isInvestorOpenRegistration(),
      envKeys: ['INVESTOR_OPEN_REGISTRATION']
    },
    {
      id: 'resend',
      label: 'Email OTP (Resend; omitido si Privy verifica el correo)',
      configured: Boolean(process.env.RESEND_API_KEY && process.env.ONBOARDING_FROM_EMAIL),
      envKeys: ['RESEND_API_KEY', 'ONBOARDING_FROM_EMAIL']
    },
    {
      id: 'twilio-verify',
      label: 'Teléfono OTP (Twilio Verify, opcional — desactivado)',
      configured: Boolean(
        process.env.TWILIO_ACCOUNT_SID?.trim() &&
          process.env.TWILIO_AUTH_TOKEN?.trim() &&
          process.env.TWILIO_VERIFY_SERVICE_SID?.trim()
      ),
      envKeys: [
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_VERIFY_SERVICE_SID',
        'TWILIO_VERIFY_CHANNEL',
        'TWILIO_WHATSAPP_NUMBER',
        'TWILIO_PHONE_NUMBER'
      ]
    },
    {
      id: 'didit',
      label: 'KYC (Didit)',
      configured: Boolean(
        process.env.DIDIT_API_KEY &&
          process.env.DIDIT_WORKFLOW_ID &&
          process.env.DIDIT_WEBHOOK_SECRET
      ),
      envKeys: ['DIDIT_API_KEY', 'DIDIT_WORKFLOW_ID', 'DIDIT_WEBHOOK_SECRET']
    },
    {
      id: 'walletconnect',
      label: 'Wallet checkout (WalletConnect)',
      configured: Boolean(process.env.NEXT_PUBLIC_WC_PROJECT_ID),
      envKeys: ['NEXT_PUBLIC_WC_PROJECT_ID']
    },
    {
      id: 'stablecoin-wallet',
      label: 'Billetera stablecoin multi-red (Base, Polygon, TRON, Solana)',
      configured: Boolean(
        (process.env.BASE_USDC_TOKEN_ADDRESS || process.env.USDC_TOKEN_ADDRESS) &&
          (process.env.BASE_STABLECOIN_TREASURY_ADDRESS ||
            process.env.STABLECOIN_TREASURY_ADDRESS ||
            process.env.TOKEN_TREASURY_ADDRESS ||
            process.env.SANOVA_TREASURY_ADDRESS)
      ),
      envKeys: [
        'STABLECOIN_ENABLED_NETWORKS',
        'BASE_USDC_TOKEN_ADDRESS',
        'POLYGON_USDC_TOKEN_ADDRESS',
        'TRON_USDT_TOKEN_ADDRESS',
        'SOLANA_USDC_MINT_ADDRESS'
      ]
    },
    {
      id: 'stripe-payments',
      label: 'Pasarela Stripe',
      configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      envKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
    },
    {
      id: 'mercadopago-payments',
      label: 'Pasarela Mercado Pago',
      configured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_WEBHOOK_SECRET),
      envKeys: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET']
    },
    {
      id: 'coinbase-payments',
      label: 'Pasarela Coinbase Commerce',
      configured: Boolean(process.env.COINBASE_COMMERCE_API_KEY && process.env.COINBASE_COMMERCE_WEBHOOK_SECRET),
      envKeys: ['COINBASE_COMMERCE_API_KEY', 'COINBASE_COMMERCE_WEBHOOK_SECRET']
    },
    {
      id: 'thirdweb',
      label: 'Emisión on-chain (Thirdweb)',
      configured: Boolean(process.env.THIRDWEB_SECRET_KEY || isRwaOperatorConfigured() || process.env.TOKEN_DEPLOY_PRIVATE_KEY),
      envKeys: ['THIRDWEB_SECRET_KEY', 'PRIVY_OPERATOR_WALLET_ID', 'TOKEN_DEPLOY_PRIVATE_KEY']
    },
    {
      id: 'supabase',
      label: 'Storage de medios (Supabase)',
      configured: Boolean(
        process.env.SUPABASE_URL &&
          (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY)
      ),
      envKeys: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    }
  ];
}

export function allOnboardingIntegrationsConfigured(integrations = getOnboardingIntegrations()) {
  return integrations.every((item) => item.configured);
}
