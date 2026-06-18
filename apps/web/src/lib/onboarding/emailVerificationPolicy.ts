import { isPrivyEnabled } from '../privy/config';
import type { SystemRole } from '../auth/roles';
import { requiresInvestorStyleOnboarding } from './onboardingGate';

/** Privy email OTP replaces Resend for investors only; staff keep Resend when needed. */
export function defersEmailVerificationToPrivy(role?: SystemRole | string | null): boolean {
  if (!isPrivyEnabled()) {
    return false;
  }

  return requiresInvestorStyleOnboarding(role);
}

export function isEmailVerificationSatisfied(input: {
  emailVerifiedAt?: Date | null;
}): boolean {
  return Boolean(input.emailVerifiedAt);
}
