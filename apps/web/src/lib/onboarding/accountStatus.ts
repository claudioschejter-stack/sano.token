import type { AccountStatus, KycStatus } from '@sanova/database';
import { isPendingInvestorWallet } from '../investor/provisionInvestorProfile';
import type { SystemRole } from '../auth/roles';
import { isMarketplaceTradingRole, isStaffRole } from '../auth/roles';
import { allowDemoKyc } from '../runtime/environment';
import {
  isContactStepComplete,
  isPhoneVerificationSatisfied,
  requiresPhoneVerification
} from './phoneVerificationPolicy';
import { isEmailVerificationSatisfied } from './emailVerificationPolicy';

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

function resolveLinkedWallet(walletAddress?: string | null): string | null {
  const trimmed = walletAddress?.trim();
  if (!trimmed || isPendingInvestorWallet(trimmed)) {
    return null;
  }

  return trimmed;
}

export function isAccountOperational(user: UserOnboardingFields): boolean {
  const identityVerified =
    isEmailVerificationSatisfied(user) &&
    isPhoneVerificationSatisfied(user) &&
    user.kycStatus === 'APPROVED' &&
    user.accountStatus !== 'SUSPENDED';

  return identityVerified && Boolean(resolveLinkedWallet(user.walletAddress));
}

/** KYC + contact + wallet (investors and advisors) — required before marketplace checkout. */
export function canAccessMarketplaceCheckout(user: UserOnboardingFields): boolean {
  const identityReady =
    isEmailVerificationSatisfied(user) &&
    isPhoneVerificationSatisfied(user) &&
    user.kycStatus === 'APPROVED' &&
    user.accountStatus !== 'SUSPENDED';

  if (!identityReady) {
    return false;
  }

  if (isMarketplaceTradingRole(user.systemRole as SystemRole)) {
    return Boolean(resolveLinkedWallet(user.walletAddress));
  }

  if (user.systemRole && isStaffRole(user.systemRole as SystemRole)) {
    return false;
  }

  return true;
}

/** Cash-flow dashboard: trading roles need wallet; treasury staff need verified identity only. */
export function canAccessCashFlowDashboard(user: UserOnboardingFields): boolean {
  const identityReady =
    isEmailVerificationSatisfied(user) &&
    isPhoneVerificationSatisfied(user) &&
    user.kycStatus === 'APPROVED' &&
    user.accountStatus !== 'SUSPENDED';

  if (!identityReady) {
    return false;
  }

  if (user.systemRole === 'TREASURY') {
    return Boolean(resolveLinkedWallet(user.walletAddress));
  }

  return canAccessMarketplaceCheckout(user);
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
  const emailVerified = isEmailVerificationSatisfied(user);
  const phoneVerified = requiresPhoneVerification(user.systemRole as SystemRole)
    ? Boolean(user.phoneVerifiedAt)
    : true;
  const contactVerified = isContactStepComplete(user);
  const kycEnabled = contactVerified;
  const kycApproved = user.kycStatus === 'APPROVED';
  const walletAddress = resolveLinkedWallet(user.walletAddress);
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
