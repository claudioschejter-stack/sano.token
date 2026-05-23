import { prisma, type KycStatus } from '@sanova/database';
import {
  buildKycIdentitySnapshot,
  type KycIdentitySnapshot
} from '../onboarding/extractDiditIdentity';
import { isContactVerificationComplete } from '../onboarding/contactVerification';
import { syncUserAccountStatus } from '../onboarding/syncUserAccount';

export type AdminInvestorRecord = {
  id: string;
  email: string;
  name: string | null;
  kycStatus: KycStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  contactVerified: boolean;
  walletAddress: string | null;
  jurisdiction: string | null;
  createdAt: string;
  incorporatedByAdvisorId: string | null;
  incorporatedByEmail: string | null;
  incorporatedAt: string | null;
  kycIdentity: KycIdentitySnapshot;
  investor: {
    id: string;
    fullName: string;
    cuit: string;
    investorType: string;
    kycStatus: KycStatus;
    totalCapital: number;
    walletAddress: string;
  } | null;
};

export type InvestorListFilter = KycStatus | 'ALL';

type UserWithInvestor = {
  id: string;
  email: string;
  name: string | null;
  kycStatus: KycStatus;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  phone: string | null;
  walletAddress: string | null;
  jurisdiction: string | null;
  kycFullName: string | null;
  kycDocumentId: string | null;
  kycDateOfBirth: string | null;
  kycNationality: string | null;
  kycDocumentType: string | null;
  kycDocumentExpiry: string | null;
  kycGender: string | null;
  createdAt: Date;
  investor: {
    id: string;
    fullName: string;
    cuit: string;
    investorType: string;
    kycStatus: KycStatus;
    totalCapital: { toNumber?: () => number } | number | bigint;
    walletAddress: string;
    incorporatedByAdvisorId: string | null;
    incorporatedAt: Date | null;
    incorporatedBy: { user: { email: string } } | null;
  } | null;
};

function mapAdminInvestorRecord(user: UserWithInvestor): AdminInvestorRecord {
  const emailVerified = Boolean(user.emailVerifiedAt);
  const phoneVerified = Boolean(user.phoneVerifiedAt);
  const kycIdentity = buildKycIdentitySnapshot(user);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    kycStatus: user.kycStatus,
    emailVerified,
    phoneVerified,
    contactVerified: isContactVerificationComplete(user),
    walletAddress: user.walletAddress,
    jurisdiction: user.jurisdiction,
    createdAt: user.createdAt.toISOString(),
    incorporatedByAdvisorId: user.investor?.incorporatedByAdvisorId ?? null,
    incorporatedByEmail: user.investor?.incorporatedBy?.user.email ?? null,
    incorporatedAt: user.investor?.incorporatedAt?.toISOString() ?? null,
    kycIdentity: {
      ...kycIdentity,
      fullName: kycIdentity.fullName ?? user.investor?.fullName ?? null,
      documentId: kycIdentity.documentId ?? user.investor?.cuit ?? null
    },
    investor: user.investor
      ? {
          id: user.investor.id,
          fullName: user.investor.fullName,
          cuit: user.investor.cuit,
          investorType: user.investor.investorType,
          kycStatus: user.investor.kycStatus,
          totalCapital: Number(user.investor.totalCapital),
          walletAddress: user.investor.walletAddress
        }
      : null
  };
}

export async function listAdminInvestors(filter: InvestorListFilter = 'ALL'): Promise<AdminInvestorRecord[]> {
  const users = await prisma.user.findMany({
    where: {
      systemRole: 'INVESTOR',
      emailVerifiedAt: { not: null },
      phoneVerifiedAt: { not: null },
      ...(filter === 'ALL' ? {} : { kycStatus: filter })
    },
    include: {
      investor: {
        include: {
          incorporatedBy: { include: { user: { select: { email: true } } } }
        }
      }
    },
    orderBy: [{ kycStatus: 'asc' }, { createdAt: 'desc' }]
  });

  return users.map((user) => mapAdminInvestorRecord(user));
}

export async function updateInvestorKycStatus(
  userId: string,
  status: Extract<KycStatus, 'APPROVED' | 'REJECTED'>
): Promise<AdminInvestorRecord | null> {
  const existing = await prisma.user.findFirst({
    where: { id: userId, systemRole: 'INVESTOR' },
    include: {
      investor: {
        include: {
          incorporatedBy: { include: { user: { select: { email: true } } } }
        }
      }
    }
  });

  if (!existing) {
    return null;
  }

  if (status === 'APPROVED' && !isContactVerificationComplete(existing)) {
    throw new Error('CONTACT_NOT_VERIFIED');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { kycStatus: status },
      include: {
        investor: {
          include: {
            incorporatedBy: { include: { user: { select: { email: true } } } }
          }
        }
      }
    });

    if (user.investorId) {
      await tx.investor.update({
        where: { id: user.investorId },
        data: {
          kycStatus: status,
          kycVerifiedAt: status === 'APPROVED' ? new Date() : null
        }
      });
    }

    return tx.user.findUnique({
      where: { id: userId },
      include: {
        investor: {
          include: {
            incorporatedBy: { include: { user: { select: { email: true } } } }
          }
        }
      }
    });
  });

  if (!updated) {
    return null;
  }

  await syncUserAccountStatus(userId);

  return mapAdminInvestorRecord(updated);
}
