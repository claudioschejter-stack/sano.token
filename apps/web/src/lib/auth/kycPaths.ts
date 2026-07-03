import { normalizeReturnPath } from './returnPath';

export const DEFAULT_POST_ONBOARDING_PATH = '/marketplace';

export type OnboardingStepParam = 'contact' | 'phone' | 'email' | 'identity' | 'wallet' | 'totp';

export function buildKycUrl(
  returnTo: string | null | undefined,
  fallback = DEFAULT_POST_ONBOARDING_PATH,
  step?: OnboardingStepParam,
  options?: { totpMode?: 'confirm' }
): string {
  const destination = normalizeReturnPath(returnTo, fallback);
  const params = new URLSearchParams({ returnTo: destination });

  if (step) {
    params.set('step', step);
  }

  if (options?.totpMode === 'confirm') {
    params.set('totpMode', 'confirm');
  }

  return `/kyc?${params.toString()}`;
}
