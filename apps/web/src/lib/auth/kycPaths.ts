import { normalizeReturnPath } from './returnPath';

export const DEFAULT_POST_ONBOARDING_PATH = '/marketplace';

export function buildKycUrl(
  returnTo: string | null | undefined,
  fallback = DEFAULT_POST_ONBOARDING_PATH
): string {
  const destination = normalizeReturnPath(returnTo, fallback);
  return `/kyc?returnTo=${encodeURIComponent(destination)}`;
}
