import {
  prisma,
  type AdvisorNominationStatus,
  type AdvisorTier,
  type SystemRole as PrismaSystemRole
} from '@sanova/database';
import type { AccountStatus, KycStatus } from '@sanova/database';
import { normalizeEmail, normalizePhoneE164 } from '../auth/contactValidation';
import type { SystemRole } from '../auth/roles';

export type PlatformTeamMember = {
  userId: string;
  email: string;
  systemRole: SystemRole;
  fullName: string | null;
  identification: string | null;
  phone: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
  kycStatus: KycStatus;
  accountStatus: AccountStatus;
  advisorId: string | null;
  uplineEmail: string | null;
  incorporatedInvestors: number | null;
  downlineCount: number | null;
  createdAt: string;
};

export type AdvisorTeamMember = {
  advisorId: string;
  userId: string;
  email: string;
  name: string | null;
  systemRole: SystemRole;
  tier: AdvisorTier;
  uplineId: string | null;
  uplineEmail: string | null;
  downlineCount: number;
  incorporatedInvestors: number;
  createdAt: string;
};

export type AdvisorNominationRecord = {
  id: string;
  email: string;
  name: string | null;
  status: AdvisorNominationStatus;
  suggestedByEmail: string;
  suggestedByName: string | null;
  proposedUplineEmail: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type UpdatePlatformTeamMemberInput = {
  userId: string;
  email: string;
  fullName?: string | null;
  identification?: string | null;
  phone?: string | null;
  systemRole: SystemRole;
};

const EDITABLE_SYSTEM_ROLES = new Set<SystemRole>([
  'ADMIN',
  'ADVISOR_MANAGER',
  'ADVISOR',
  'INVESTOR',
  'TREASURY',
  'OPERATOR'
]);

async function ensureAdvisorRecord(
  userId: string,
  uplineId: string | null | undefined,
  tier: AdvisorTier = 'JUNIOR'
) {
  return prisma.advisor.upsert({
    where: { userId },
    create: { userId, uplineId: uplineId ?? null, tier },
    update: { uplineId: uplineId ?? null }
  });
}

export async function listPlatformTeamMembers(): Promise<PlatformTeamMember[]> {
  const users = await prisma.user.findMany({
    include: {
      investor: { select: { fullName: true, cuit: true } },
      advisor: {
        include: {
          upline: { include: { user: { select: { email: true } } } },
          _count: { select: { downline: true, incorporatedInvestors: true } }
        }
      }
    },
    orderBy: [{ systemRole: 'asc' }, { createdAt: 'desc' }]
  });

  return users.map((row) => ({
    userId: row.id,
    email: row.email,
    systemRole: row.systemRole as SystemRole,
    fullName: row.kycFullName ?? row.name ?? row.investor?.fullName ?? null,
    identification: row.kycDocumentId ?? row.investor?.cuit ?? null,
    phone: row.phone,
    emailVerified: Boolean(row.emailVerifiedAt),
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
    phoneVerified: Boolean(row.phoneVerifiedAt),
    phoneVerifiedAt: row.phoneVerifiedAt?.toISOString() ?? null,
    kycStatus: row.kycStatus,
    accountStatus: row.accountStatus,
    advisorId: row.advisor?.id ?? null,
    uplineEmail: row.advisor?.upline?.user.email ?? null,
    incorporatedInvestors: row.advisor?._count.incorporatedInvestors ?? null,
    downlineCount: row.advisor?._count.downline ?? null,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function updatePlatformTeamMember(
  input: UpdatePlatformTeamMemberInput
): Promise<PlatformTeamMember> {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error('INVALID_EMAIL');
  }

  if (!EDITABLE_SYSTEM_ROLES.has(input.systemRole)) {
    throw new Error('INVALID_ROLE');
  }

  const phoneInput = input.phone?.trim() ?? '';
  const phone = phoneInput ? normalizePhoneE164(phoneInput) : null;
  if (phoneInput && !phone) {
    throw new Error('INVALID_PHONE');
  }

  const fullName = input.fullName?.trim() || null;
  const identification = input.identification?.trim() || null;

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      email,
      name: fullName,
      kycFullName: fullName,
      kycDocumentId: identification,
      phone,
      systemRole: input.systemRole as PrismaSystemRole
    }
  });

  const members = await listPlatformTeamMembers();
  const updated = members.find((member) => member.userId === input.userId);
  if (!updated) {
    throw new Error('USER_NOT_FOUND');
  }

  return updated;
}

export async function deletePlatformTeamMembers(
  userIds: string[],
  currentAdminUserId: string
): Promise<{ deletedCount: number }> {
  const uniqueIds = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    throw new Error('NO_USERS_SELECTED');
  }

  if (uniqueIds.includes(currentAdminUserId)) {
    throw new Error('CANNOT_DELETE_SELF');
  }

  const result = await prisma.user.deleteMany({
    where: {
      id: { in: uniqueIds }
    }
  });

  return { deletedCount: result.count };
}

export async function listAdvisorTeam(): Promise<AdvisorTeamMember[]> {
  const advisors = await prisma.advisor.findMany({
    include: {
      user: { select: { id: true, email: true, name: true, systemRole: true } },
      upline: { include: { user: { select: { email: true } } } },
      _count: { select: { downline: true, incorporatedInvestors: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return advisors.map((row) => ({
    advisorId: row.id,
    userId: row.user.id,
    email: row.user.email,
    name: row.user.name,
    systemRole: row.user.systemRole as SystemRole,
    tier: row.tier,
    uplineId: row.uplineId,
    uplineEmail: row.upline?.user.email ?? null,
    downlineCount: row._count.downline,
    incorporatedInvestors: row._count.incorporatedInvestors,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function designateAdvisor(input: {
  email: string;
  name?: string | null;
  role: 'ADVISOR' | 'ADVISOR_MANAGER';
  uplineAdvisorId?: string | null;
  tier?: AdvisorTier;
}): Promise<AdvisorTeamMember> {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('INVALID_EMAIL');
  }

  if (input.uplineAdvisorId) {
    const upline = await prisma.advisor.findUnique({
      where: { id: input.uplineAdvisorId },
      include: { user: { select: { systemRole: true } } }
    });

    if (!upline) {
      throw new Error('UPLINE_NOT_FOUND');
    }

    if (input.role === 'ADVISOR_MANAGER' && upline.user.systemRole !== 'ADVISOR_MANAGER') {
      throw new Error('MANAGER_CANNOT_HAVE_UPLINE');
    }
  } else if (input.role === 'ADVISOR') {
    throw new Error('ADVISOR_REQUIRES_UPLINE');
  }

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      name: input.name ?? undefined,
      systemRole: input.role as PrismaSystemRole
    },
    update: {
      name: input.name ?? undefined,
      systemRole: input.role as PrismaSystemRole
    }
  });

  const advisor = await ensureAdvisorRecord(
    user.id,
    input.role === 'ADVISOR_MANAGER' ? null : input.uplineAdvisorId,
    input.tier
  );

  const full = await prisma.advisor.findUniqueOrThrow({
    where: { id: advisor.id },
    include: {
      user: { select: { id: true, email: true, name: true, systemRole: true } },
      upline: { include: { user: { select: { email: true } } } },
      _count: { select: { downline: true, incorporatedInvestors: true } }
    }
  });

  return {
    advisorId: full.id,
    userId: full.user.id,
    email: full.user.email,
    name: full.user.name,
    systemRole: full.user.systemRole as SystemRole,
    tier: full.tier,
    uplineId: full.uplineId,
    uplineEmail: full.upline?.user.email ?? null,
    downlineCount: full._count.downline,
    incorporatedInvestors: full._count.incorporatedInvestors,
    createdAt: full.createdAt.toISOString()
  };
}

export async function listAdvisorNominations(
  status?: AdvisorNominationStatus
): Promise<AdvisorNominationRecord[]> {
  const rows = await prisma.advisorNomination.findMany({
    where: status ? { status } : undefined,
    include: {
      suggestedBy: { include: { user: { select: { email: true, name: true } } } },
      proposedUpline: { include: { user: { select: { email: true } } } }
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
  });

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    suggestedByEmail: row.suggestedBy.user.email,
    suggestedByName: row.suggestedBy.user.name,
    proposedUplineEmail: row.proposedUpline?.user.email ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null
  }));
}

export async function reviewAdvisorNomination(
  nominationId: string,
  adminUserId: string,
  decision: 'APPROVED' | 'REJECTED',
  rejectionReason?: string
): Promise<AdvisorNominationRecord> {
  const nomination = await prisma.advisorNomination.findUnique({
    where: { id: nominationId },
    include: { suggestedBy: true }
  });

  if (!nomination || nomination.status !== 'PENDING') {
    throw new Error('NOMINATION_NOT_FOUND');
  }

  if (decision === 'REJECTED') {
    const updated = await prisma.advisorNomination.update({
      where: { id: nominationId },
      data: {
        status: 'REJECTED',
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason ?? null
      },
      include: {
        suggestedBy: { include: { user: { select: { email: true, name: true } } } },
        proposedUpline: { include: { user: { select: { email: true } } } }
      }
    });

    return mapNomination(updated);
  }

  await designateAdvisor({
    email: nomination.email,
    name: nomination.name,
    role: 'ADVISOR',
    uplineAdvisorId: nomination.proposedUplineId ?? nomination.suggestedByAdvisorId
  });

  const updated = await prisma.advisorNomination.update({
    where: { id: nominationId },
    data: {
      status: 'APPROVED',
      reviewedByUserId: adminUserId,
      reviewedAt: new Date()
    },
    include: {
      suggestedBy: { include: { user: { select: { email: true, name: true } } } },
      proposedUpline: { include: { user: { select: { email: true } } } }
    }
  });

  return mapNomination(updated);
}

export async function suggestAdvisor(input: {
  email: string;
  name?: string | null;
  suggestedByAdvisorId: string;
}): Promise<AdvisorNominationRecord> {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('INVALID_EMAIL');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { systemRole: true }
  });

  if (existingUser && existingUser.systemRole !== 'INVESTOR') {
    throw new Error('EMAIL_ALREADY_STAFF');
  }

  const pending = await prisma.advisorNomination.findFirst({
    where: { email: normalizedEmail, status: 'PENDING' }
  });

  if (pending) {
    throw new Error('NOMINATION_ALREADY_PENDING');
  }

  const created = await prisma.advisorNomination.create({
    data: {
      email: normalizedEmail,
      name: input.name ?? null,
      suggestedByAdvisorId: input.suggestedByAdvisorId,
      proposedUplineId: input.suggestedByAdvisorId
    },
    include: {
      suggestedBy: { include: { user: { select: { email: true, name: true } } } },
      proposedUpline: { include: { user: { select: { email: true } } } }
    }
  });

  return mapNomination(created);
}

export async function assignInvestorToAdvisor(investorId: string, advisorId: string): Promise<void> {
  const advisor = await prisma.advisor.findUnique({ where: { id: advisorId } });
  if (!advisor) {
    throw new Error('ADVISOR_NOT_FOUND');
  }

  await prisma.investor.update({
    where: { id: investorId },
    data: {
      incorporatedByAdvisorId: advisorId,
      incorporatedAt: new Date()
    }
  });
}

function mapNomination(
  row: Awaited<ReturnType<typeof prisma.advisorNomination.findFirst>> & {
    suggestedBy: { user: { email: string; name: string | null } };
    proposedUpline: { user: { email: string } } | null;
  }
): AdvisorNominationRecord {
  if (!row) {
    throw new Error('NOMINATION_NOT_FOUND');
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    suggestedByEmail: row.suggestedBy.user.email,
    suggestedByName: row.suggestedBy.user.name,
    proposedUplineEmail: row.proposedUpline?.user.email ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null
  };
}
