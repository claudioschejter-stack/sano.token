import {
  getAdminPlatformConfig,
  type AdminPlatformConfig
} from '../platform/platformConfigService';
import { isSupabaseStorageConfigured } from '../storage/supabaseAdmin';
import { isRwaOperatorConfigured } from '../blockchain/rwaOperatorSigner';

export type IntegrationStatus = {
  id: string;
  configured: boolean;
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

export async function getAdminSettings(): Promise<AdminSettings> {
  const contact = await getAdminPlatformConfig();

  return {
    contact,
    integrations: [
      { id: 'email', configured: isConfigured(process.env.RESEND_API_KEY) },
      {
        id: 'kyc',
        configured: isConfigured(process.env.DIDIT_API_KEY, process.env.DIDIT_WORKFLOW_ID)
      },
      {
        id: 'googleOAuth',
        configured: isConfigured(process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET)
      },
      {
        id: 'appleOAuth',
        configured: isConfigured(process.env.AUTH_APPLE_ID, process.env.AUTH_APPLE_SECRET)
      },
      {
        id: 'walletConnect',
        configured: isConfigured(process.env.NEXT_PUBLIC_WC_PROJECT_ID)
      },
      {
        id: 'blockchain',
        configured: isConfigured(
          process.env.PRIVATE_KEY,
          process.env.POLYGON_RPC_URL || process.env.BASE_RPC_URL
        )
      },
      {
        id: 'thirdweb',
        configured:
          isConfigured(process.env.THIRDWEB_SECRET_KEY) ||
          isRwaOperatorConfigured() ||
          isConfigured(process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)
      },
      {
        id: 'supabaseStorage',
        configured: isSupabaseStorageConfigured()
      },
      {
        id: 'redis',
        configured:
          process.env.BULL_ENABLED === 'false' ||
          isConfigured(process.env.REDIS_URL)
      },
      {
        id: 'collateralWebhook',
        configured: isConfigured(process.env.COLLATERAL_SUBMISSION_WEBHOOK_URL)
      },
      {
        id: 'morpho',
        configured: isConfigured(process.env.MORPHO_API_KEY, process.env.MORPHO_CURATOR_ADDRESS)
      }
    ],
    access: {
      adminEmails: parseEmailList(process.env.AUTH_ADMIN_EMAILS).map(maskEmail),
      oauthGoogle: isConfigured(process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET),
      oauthApple: isConfigured(process.env.AUTH_APPLE_ID, process.env.AUTH_APPLE_SECRET)
    },
    operations: {
      allowDemoKyc: process.env.ALLOW_DEMO_KYC === 'true',
      bullEnabled: process.env.BULL_ENABLED !== 'false',
      onboardingDevExposeCode: process.env.ONBOARDING_DEV_EXPOSE_CODE === 'true',
      nodeEnv: process.env.NODE_ENV ?? 'development'
    }
  };
}
