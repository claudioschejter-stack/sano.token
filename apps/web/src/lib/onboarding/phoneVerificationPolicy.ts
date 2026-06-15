import { isMarketplaceTradingRole, type SystemRole } from '../auth/roles';

/** OTP phone verification is required only for platform admins. */
export function requiresPhoneVerification(role: SystemRole | string | null | undefined): boolean {
  return role === 'ADMIN';
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
  if (!user.emailVerifiedAt) {
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
