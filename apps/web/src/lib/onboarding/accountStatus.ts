import type { AccountStatus, KycStatus } from '@sanova/database';
import { isPendingInvestorWallet } from '../investor/provisionInvestorProfile';
import type { SystemRole } from '../auth/roles';
import { isMarketplaceTradingRole, isStaffRole } from '../auth/roles';
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

function resolveLinkedWallet(walletAddress?: string | null): string | null {
  const trimmed = walletAddress?.trim();
  if (!trimmed || isPendingInvestorWallet(trimmed)) {
    return null;
  }

  return trimmed;
}

export function isAccountOperational(user: UserOnboardingFields): boolean {
  const identityVerified =
    Boolean(user.emailVerifiedAt) &&
    Boolean(user.phoneVerifiedAt) &&
    user.kycStatus === 'APPROVED' &&
    user.accountStatus !== 'SUSPENDED';

  if (isMarketplaceTradingRole(user.systemRole as SystemRole)) {
    return identityVerified && Boolean(resolveLinkedWallet(user.walletAddress));
  }

  return identityVerified;
}

/** KYC + contact + wallet (investors and advisors) — required before marketplace checkout. */
export function canAccessMarketplaceCheckout(user: UserOnboardingFields): boolean {
  const identityReady =
    Boolean(user.emailVerifiedAt) &&
    Boolean(user.phoneVerifiedAt) &&
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
    Boolean(user.emailVerifiedAt) &&
    Boolean(user.phoneVerifiedAt) &&
    user.kycStatus === 'APPROVED' &&
    user.accountStatus !== 'SUSPENDED';

  if (!identityReady) {
    return false;
  }

  if (user.systemRole === 'TREASURY') {
    return true;
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
  const emailVerified = Boolean(user.emailVerifiedAt);
  const phoneVerified = Boolean(user.phoneVerifiedAt);
  const contactVerified = phoneVerified && emailVerified;
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
