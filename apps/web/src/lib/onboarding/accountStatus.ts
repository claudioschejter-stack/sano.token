import type { AccountStatus, KycStatus } from '@sanova/database';
import { allowDemoKyc } from '../runtime/environment';

export type OnboardingChecklist = {
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Email verified and phone captured. */
  contactVerified: boolean;
  /** KYC (Didit / manual review) is allowed after contact step. */
  kycEnabled: boolean;
  kycApproved: boolean;
  operational: boolean;
  accountStatus: AccountStatus;
  kycStatus: KycStatus;
  phone: string | null;
  email: string;
  diditEnabled: boolean;
  allowDemoKyc: boolean;
  walletLinked: boolean;
  walletAddress: string | null;
  walletProvider: string | null;
};

type UserOnboardingFields = {
  email: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  kycStatus: KycStatus;
  accountStatus: AccountStatus;
  walletAddress?: string | null;
  walletProvider?: string | null;
  systemRole?: string | null;
};

export function isAccountOperational(user: UserOnboardingFields): boolean {
  const identityVerified =
    Boolean(user.emailVerifiedAt) &&
    Boolean(user.phone?.trim()) &&
    user.kycStatus === 'APPROVED' &&
    user.accountStatus !== 'SUSPENDED';

  if (user.systemRole === 'INVESTOR') {
    return identityVerified && Boolean(user.walletAddress?.trim());
  }

  return identityVerified;
}

/** KYC + contact + wallet (investors) — required before marketplace checkout. */
export function canAccessMarketplaceCheckout(user: UserOnboardingFields): boolean {
  const identityReady =
    Boolean(user.emailVerifiedAt) &&
    Boolean(user.phone?.trim()) &&
    user.kycStatus === 'APPROVED' &&
    user.accountStatus !== 'SUSPENDED';

  if (!identityReady) {
    return false;
  }

  if (user.systemRole === 'INVESTOR') {
    return Boolean(user.walletAddress?.trim());
  }

  return true;
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
  const phoneVerified = Boolean(user.phone?.trim());
  const contactVerified = phoneVerified && emailVerified;
  const kycEnabled = contactVerified;
  const kycApproved = user.kycStatus === 'APPROVED';
  const walletAddress = user.walletAddress?.trim() || null;
  const walletLinked = Boolean(walletAddress);
  const operational = isAccountOperational({ ...user, walletAddress });
  const accountStatus = deriveAccountStatus({ ...user, walletAddress });

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
    allowDemoKyc: allowDemoKyc(),
    walletLinked,
    walletAddress,
    walletProvider: user.walletProvider?.trim() || null
  };
}
