import { prisma, type KycStatus, type Prisma } from '@sanova/database';
import {
  buildKycIdentitySnapshot,
  type KycIdentitySnapshot
} from '../onboarding/extractDiditIdentity';
import { isContactVerificationComplete } from '../onboarding/contactVerification';
import { syncUserAccountStatus } from '../onboarding/syncUserAccount';
import { provisionInvestorProfileOnKycApproval } from '../investor/provisionInvestorProfile';
import { recordAdminAuditLog } from './assetsService';

export type AdminInvestorRecord = {
  id: string;
  email: string;
  name: string | null;
  kycStatus: KycStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  contactVerified: boolean;
  investorAccessEnabled: boolean;
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
  investorAccessEnabled: boolean;
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
    investorAccessEnabled: user.investorAccessEnabled,
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
      phone: { not: null },
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

  if (status === 'APPROVED') {
    await provisionInvestorProfileOnKycApproval(userId);
  }

  await recordAdminAuditLog({
    action: `KYC_${status}`,
    targetUserId: userId,
    metadata: { status } as Prisma.InputJsonValue
  });

  return mapAdminInvestorRecord(updated);
}

export async function updateInvestorAccessEnabled(
  userId: string,
  enabled: boolean
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

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { investorAccessEnabled: enabled },
    include: {
      investor: {
        include: {
          incorporatedBy: { include: { user: { select: { email: true } } } }
        }
      }
    }
  });

  await recordAdminAuditLog({
    action: enabled ? 'INVESTOR_ACCESS_ENABLED' : 'INVESTOR_ACCESS_DISABLED',
    targetUserId: userId,
    metadata: { enabled } as Prisma.InputJsonValue
  });

  return mapAdminInvestorRecord(updated);
}

export async function getInvestorWallet(userId: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, systemRole: 'INVESTOR' },
    select: {
      walletAddress: true,
      investor: { select: { walletAddress: true } }
    }
  });

  return user?.walletAddress ?? user?.investor?.walletAddress ?? null;
}

export async function upsertInvestorAllowlist(input: {
  userId: string;
  projectId: string;
  walletAddress: string;
  approved: boolean;
  txHash?: string | null;
  chainId?: number | null;
}) {
  const audit = await recordAdminAuditLog({
    action: input.approved ? 'ALLOWLIST_APPROVE' : 'ALLOWLIST_REVOKE',
    targetUserId: input.userId,
    projectId: input.projectId,
    metadata: {
      walletAddress: input.walletAddress,
      txHash: input.txHash,
      chainId: input.chainId,
      approved: input.approved
    } as Prisma.InputJsonValue
  });

  return prisma.investorAllowlist.upsert({
    where: {
      projectId_walletAddress: {
        projectId: input.projectId,
        walletAddress: input.walletAddress.toLowerCase()
      }
    },
    update: {
      userId: input.userId,
      approved: input.approved,
      txHash: input.txHash ?? null,
      chainId: input.chainId ?? null,
      auditHash: audit.auditHash
    },
    create: {
      userId: input.userId,
      projectId: input.projectId,
      walletAddress: input.walletAddress.toLowerCase(),
      approved: input.approved,
      txHash: input.txHash ?? null,
      chainId: input.chainId ?? null,
      auditHash: audit.auditHash
    }
  });
}
