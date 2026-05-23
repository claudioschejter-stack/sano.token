import type { AccountStatus, KycStatus } from '@sanova/database';

export type OnboardingChecklist = {
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Email and phone verified — required before KYC can start. */
  contactVerified: boolean;
  /** KYC (Didit / manual review) is allowed only after contact verification. */
  kycEnabled: boolean;
  kycApproved: boolean;
  operational: boolean;
  accountStatus: AccountStatus;
  kycStatus: KycStatus;
  phone: string | null;
  email: string;
  diditEnabled: boolean;
};

type UserOnboardingFields = {
  email: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  kycStatus: KycStatus;
  accountStatus: AccountStatus;
};

export function isAccountOperational(user: UserOnboardingFields): boolean {
  return (
    Boolean(user.emailVerifiedAt) &&
    Boolean(user.phoneVerifiedAt) &&
    user.kycStatus === 'APPROVED' &&
    user.accountStatus !== 'SUSPENDED'
  );
}

export function deriveAccountStatus(user: UserOnboardingFields): AccountStatus {
  if (user.accountStatus === 'SUSPENDED') {
    return 'SUSPENDED';
  }

  return isAccountOperational(user) ? 'OPERATIONAL' : 'ONBOARDING';
}

export function buildOnboardingChecklist(
  user: UserOnboardingFields,
  diditEnabled: boolean
): OnboardingChecklist {
  const emailVerified = Boolean(user.emailVerifiedAt);
  const phoneVerified = Boolean(user.phoneVerifiedAt);
  const contactVerified =
    Boolean(user.phone) && emailVerified && phoneVerified;
  const kycEnabled = contactVerified;
  const kycApproved = user.kycStatus === 'APPROVED';
  const operational = isAccountOperational(user);
  const accountStatus = deriveAccountStatus(user);

  return {
    emailVerified,
    phoneVerified,
    contactVerified,
    kycEnabled,
    kycApproved,
    operational,
    accountStatus,
    kycStatus: user.kycStatus,
    phone: user.phone,
    email: user.email,
    diditEnabled: diditEnabled && kycEnabled
  };
}
