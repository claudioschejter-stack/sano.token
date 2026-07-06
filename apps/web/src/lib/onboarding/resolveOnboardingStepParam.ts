import type { OnboardingStepParam } from '../auth/kycPaths';
import type { OnboardingChecklist } from './accountStatus';

export function resolveOnboardingStepParam(
  checklist: OnboardingChecklist,
  investorOnboarding: boolean
): OnboardingStepParam | null {
  if (!checklist.emailVerified || !checklist.contactVerified) {
    return 'email';
  }

  if (!checklist.kycApproved) {
    return 'identity';
  }

  if (investorOnboarding && !checklist.walletLinked) {
    return 'wallet';
  }

  if (investorOnboarding && !checklist.totpEnabled) {
    return 'totp';
  }

  return null;
}
