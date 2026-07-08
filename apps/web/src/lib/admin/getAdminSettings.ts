import {
  getAdminPlatformConfig,
  type AdminPlatformConfig
} from '../platform/platformConfigService';
import { isSupabaseStorageConfigured } from '../storage/supabaseAdmin';
import { isRwaOperatorConfigured } from '../blockchain/rwaOperatorSigner';
import {
  isPrivyEnabled,
  isPrivyMorphoLiquidityConfigured,
  resolvePrivyLoginMethods
} from '../privy/config';
import {
  isAppleOAuthConfigured,
  isGoogleOAuthConfigured
} from '../auth/oauthProviders';

export type IntegrationStatus = {
  id: string;
  configured: boolean;
  envKeys: string[];
  /** Not required for core platform operation (e.g. institutional webhook). */
  optional?: boolean;
};

export type AdminSettings = {
  contact: AdminPlatformConfig;
  integrations: IntegrationStatus[];
  access: {
    adminEmails: string[];
    oauthGoogle: boolean;
    oauthApple: boolean;
  };
  operations: {
    allowDemoKyc: boolean;
    bullEnabled: boolean;
    onboardingDevExposeCode: boolean;
    nodeEnv: string;
  };
};

function isConfigured(...values: Array<string | undefined | null>): boolean {
  return values.every((value) => Boolean(value?.trim()));
}

function parseEmailList(raw?: string | null): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return email;
  }

  const visible = local.length <= 2 ? local[0] ?? '*' : `${local[0]}***`;
  return `${visible}@${domain}`;
}

function privyOAuthMethodEnabled(method: 'google' | 'apple'): boolean {
  return (
    isPrivyEnabled() &&
    Boolean(process.env.PRIVY_APP_SECRET?.trim()) &&
    resolvePrivyLoginMethods().includes(method)
  );
}

function isBlockchainRpcConfigured(): boolean {
  const rpcConfigured = isConfigured(
    process.env.BASE_RPC_URL?.trim() || process.env.LENDING_BASE_RPC_URL?.trim()
  );
  const signerConfigured =
    isRwaOperatorConfigured() ||
    isConfigured(process.env.TOKEN_DEPLOY_PRIVATE_KEY) ||
    isConfigured(process.env.THIRDWEB_SECRET_KEY);

  return rpcConfigured && signerConfigured;
}

function isMorphoIntegrationConfigured(): boolean {
  if (isPrivyMorphoLiquidityConfigured()) {
    return true;
  }

  if (isConfigured(process.env.MORPHO_ORACLE_ADDRESS)) {
    return true;
  }

  if (isConfigured(process.env.METAMORPHO_VAULT_ADDRESS)) {
    return true;
  }

  return isConfigured(process.env.MORPHO_API_KEY, process.env.MORPHO_CURATOR_ADDRESS);
}

export async function getAdminSettings(): Promise<AdminSettings> {
  const contact = await getAdminPlatformConfig();

  return {
    contact,
    integrations: [
      {
        id: 'email',
        configured: isConfigured(process.env.RESEND_API_KEY, process.env.ONBOARDING_FROM_EMAIL),
        envKeys: ['RESEND_API_KEY', 'ONBOARDING_FROM_EMAIL']
      },
      {
        id: 'kyc',
        configured: isConfigured(process.env.DIDIT_API_KEY, process.env.DIDIT_WEBHOOK_SECRET),
        envKeys: ['DIDIT_API_KEY', 'DIDIT_WEBHOOK_SECRET']
      },
      {
        id: 'googleOAuth',
        configured:
          isGoogleOAuthConfigured() || privyOAuthMethodEnabled('google'),
        optional: true,
        envKeys: [
          'NEXT_PUBLIC_PRIVY_LOGIN_METHODS',
          'NEXT_PUBLIC_PRIVY_APP_ID',
          'PRIVY_APP_SECRET',
          'AUTH_GOOGLE_ID',
          'AUTH_GOOGLE_SECRET'
        ]
      },
      {
        id: 'appleOAuth',
        configured:
          isAppleOAuthConfigured() || privyOAuthMethodEnabled('apple'),
        optional: true,
        envKeys: [
          'NEXT_PUBLIC_PRIVY_LOGIN_METHODS',
          'NEXT_PUBLIC_PRIVY_APP_ID',
          'PRIVY_APP_SECRET',
          'AUTH_APPLE_ID',
          'AUTH_APPLE_SECRET'
        ]
      },
      {
        id: 'walletConnect',
        configured: isConfigured(process.env.NEXT_PUBLIC_WC_PROJECT_ID),
        envKeys: ['NEXT_PUBLIC_WC_PROJECT_ID']
      },
      {
        id: 'blockchain',
        configured: isBlockchainRpcConfigured(),
        envKeys: [
          'BASE_RPC_URL',
          'PRIVY_OPERATOR_WALLET_ID',
          'RWA_OPERATOR_ADDRESS',
          'PRIVY_APP_SECRET',
          'TOKEN_DEPLOY_PRIVATE_KEY'
        ]
      },
      {
        id: 'thirdweb',
        configured:
          isConfigured(process.env.THIRDWEB_SECRET_KEY) ||
          isRwaOperatorConfigured() ||
          isConfigured(process.env.TOKEN_DEPLOY_PRIVATE_KEY),
        envKeys: ['THIRDWEB_SECRET_KEY', 'PRIVY_OPERATOR_WALLET_ID', 'TOKEN_DEPLOY_PRIVATE_KEY']
      },
      {
        id: 'supabaseStorage',
        configured: isSupabaseStorageConfigured(),
        envKeys: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET']
      },
      {
        id: 'redis',
        configured:
          process.env.BULL_ENABLED === 'false' || isConfigured(process.env.REDIS_URL),
        envKeys: ['REDIS_URL', 'BULL_ENABLED']
      },
      {
        id: 'collateralWebhook',
        configured: isConfigured(process.env.COLLATERAL_SUBMISSION_WEBHOOK_URL),
        optional: true,
        envKeys: ['COLLATERAL_SUBMISSION_WEBHOOK_URL', 'COLLATERAL_WEBHOOK_SECRET']
      },
      {
        id: 'morpho',
        configured: isMorphoIntegrationConfigured(),
        envKeys: [
          'PRIVY_MORPHO_LIQUIDITY_WALLET_ID',
          'MORPHO_LIQUIDITY_ADDRESS',
          'MORPHO_ORACLE_ADDRESS',
          'MORPHO_API_KEY',
          'MORPHO_CURATOR_ADDRESS'
        ]
      }
    ],
    access: {
      adminEmails: parseEmailList(process.env.AUTH_ADMIN_EMAILS).map(maskEmail),
      oauthGoogle: isGoogleOAuthConfigured() || privyOAuthMethodEnabled('google'),
      oauthApple: isAppleOAuthConfigured() || privyOAuthMethodEnabled('apple')
    },
    operations: {
      allowDemoKyc: process.env.ALLOW_DEMO_KYC === 'true',
      bullEnabled: process.env.BULL_ENABLED !== 'false',
      onboardingDevExposeCode: process.env.ONBOARDING_DEV_EXPOSE_CODE === 'true',
      nodeEnv: process.env.NODE_ENV ?? 'development'
    }
  };
}
