export type IntegrationStatus = {
  id: string;
  label: string;
  configured: boolean;
  envKeys: string[];
};

export function getOnboardingIntegrations(): IntegrationStatus[] {
  const otpProvider = process.env.ONBOARDING_OTP_PROVIDER?.trim().toLowerCase();
  const supabaseOtpActive = otpProvider === 'supabase';

  return [
    {
      id: 'otp-provider',
      label: `Proveedor OTP teléfono (${supabaseOtpActive ? 'Supabase Auth' : 'Twilio directo'})`,
      configured: true,
      envKeys: ['ONBOARDING_OTP_PROVIDER']
    },
    {
      id: 'resend',
      label: 'Email OTP (Resend)',
      configured: Boolean(process.env.RESEND_API_KEY && process.env.ONBOARDING_FROM_EMAIL),
      envKeys: ['RESEND_API_KEY', 'ONBOARDING_FROM_EMAIL']
    },
    {
      id: 'twilio',
      label: 'SMS OTP (Twilio)',
      configured: Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
          process.env.TWILIO_AUTH_TOKEN &&
          process.env.TWILIO_PHONE_NUMBER
      ),
      envKeys: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']
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
      id: 'thirdweb',
      label: 'Emisión on-chain (Thirdweb)',
      configured: Boolean(process.env.THIRDWEB_SECRET_KEY || process.env.TOKEN_DEPLOY_PRIVATE_KEY),
      envKeys: ['THIRDWEB_SECRET_KEY', 'TOKEN_DEPLOY_PRIVATE_KEY']
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
