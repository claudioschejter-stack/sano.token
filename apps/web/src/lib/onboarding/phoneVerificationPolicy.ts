import { isMarketplaceTradingRole, type SystemRole } from '../auth/roles';
import { defersEmailVerificationToPrivy } from './emailVerificationPolicy';

/** OTP phone verification is disabled for all roles; phone is captured at registration only. */
export function requiresPhoneVerification(_role: SystemRole | string | null | undefined): boolean {
  return false;
}

export function isPhoneVerificationSatisfied(input: {
  systemRole?: string | null;
  phoneVerifiedAt?: Date | null;
}): boolean {
  if (!requiresPhoneVerification(input.systemRole)) {
    return true;
  }

  return Boolean(input.phoneVerifiedAt);
}

export function isContactStepComplete(user: {
  systemRole?: string | null;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
  phone?: string | null;
}): boolean {
  const emailReady = Boolean(user.emailVerifiedAt) || defersEmailVerificationToPrivy();
  if (!emailReady) {
    return false;
  }

  if (requiresPhoneVerification(user.systemRole)) {
    return Boolean(user.phoneVerifiedAt);
  }

  if (isMarketplaceTradingRole(user.systemRole as SystemRole)) {
    return Boolean(user.phone?.trim());
  }

  return true;
}
