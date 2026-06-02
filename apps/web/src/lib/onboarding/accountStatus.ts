import type { AccountStatus, KycStatus } from '@sanova/database';

export type OnboardingChecklist = {
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Email verified and phone captured — required before phone OTP. */
  contactVerified: boolean;
  /** KYC (Didit / manual review) is allowed after email and phone OTP verification. */
  kycEnabled: boolean;
  kycApproved: boolean;
  operational: boolean;
  accountStatus: AccountStatus;
  kycStatus: KycStatus;
  phone: string | null;
  email: string;
  diditEnabled: boolean;
  walletLinked: boolean;
  walletAddress: string | null;
};

type UserOnboardingFields = {
  email: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  kycStatus: KycStatus;
  accountStatus: AccountStatus;
  walletAddress?: string | null;
};

export function isAccountOperational(user: UserOnboardingFields): boolean {
  return (
    Boolean(user.emailVerifiedAt) &&
    Boolean(user.phoneVerifiedAt) &&
    Boolean(user.phone) &&
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
  const contactVerified = Boolean(user.phone) && emailVerified;
  const kycEnabled = contactVerified && phoneVerified;
  const kycApproved = user.kycStatus === 'APPROVED';
  const operational = isAccountOperational(user);
  const accountStatus = deriveAccountStatus(user);
  const walletAddress = user.walletAddress?.trim() || null;
  const walletLinked = Boolean(walletAddress);

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
    diditEnabled: diditEnabled && kycEnabled,
    walletLinked,
    walletAddress
  };
}
