import type { KycStatus } from '@sanova/database';

export type OnboardingProfile = {
  fullName: string | null;
  identification: string | null;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  kycApproved: boolean;
  kycStatus: KycStatus;
};

type UserProfileSource = {
  email: string;
  phone: string | null;
  name: string | null;
  kycFullName: string | null;
  kycDocumentId: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  kycStatus: KycStatus;
  investor?: { fullName: string; cuit: string } | null;
};

export function buildOnboardingProfile(user: UserProfileSource): OnboardingProfile {
  return {
    fullName: user.kycFullName ?? user.name ?? user.investor?.fullName ?? null,
    identification: user.kycDocumentId ?? user.investor?.cuit ?? null,
    email: user.email,
    phone: user.phone,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    kycApproved: user.kycStatus === 'APPROVED',
    kycStatus: user.kycStatus
  };
}
