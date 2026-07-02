import { normalizeReturnPath } from './returnPath';

export const DEFAULT_POST_ONBOARDING_PATH = '/marketplace';

export type OnboardingStepParam = 'contact' | 'phone' | 'email' | 'identity' | 'wallet' | 'totp';

export function buildKycUrl(
  returnTo: string | null | undefined,
  fallback = DEFAULT_POST_ONBOARDING_PATH,
  step?: OnboardingStepParam
): string {
  const destination = normalizeReturnPath(returnTo, fallback);
  const params = new URLSearchParams({ returnTo: destination });

  if (step) {
    params.set('step', step);
  }

  return `/kyc?${params.toString()}`;
}
