import type { KycStatus } from '@sanova/database';
import {
  buildKycIdentitySnapshot,
  type KycIdentitySnapshot
} from './extractDiditIdentity';

export type OnboardingProfile = {
  fullName: string | null;
  identification: string | null;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  kycApproved: boolean;
  kycStatus: KycStatus;
  identity: KycIdentitySnapshot;
};

type UserProfileSource = {
  email: string;
  phone: string | null;
  name: string | null;
  kycFullName: string | null;
  kycDocumentId: string | null;
  kycDateOfBirth: string | null;
  kycNationality: string | null;
  kycDocumentType: string | null;
  kycDocumentExpiry: string | null;
  kycGender: string | null;
  jurisdiction: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  kycStatus: KycStatus;
  investor?: { fullName: string; cuit: string } | null;
};

export function buildOnboardingProfile(user: UserProfileSource): OnboardingProfile {
  const identity = buildKycIdentitySnapshot(user);

  return {
    fullName: identity.fullName ?? user.investor?.fullName ?? null,
    identification: identity.documentId ?? user.investor?.cuit ?? null,
    email: user.email,
    phone: user.phone,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    kycApproved: user.kycStatus === 'APPROVED',
    kycStatus: user.kycStatus,
    identity: {
      ...identity,
      fullName: identity.fullName ?? user.investor?.fullName ?? null,
      documentId: identity.documentId ?? user.investor?.cuit ?? null
    }
  };
}
