import { createHash, randomBytes } from 'crypto';
import { prisma, type SystemRole as PrismaSystemRole } from '@sanova/database';
import { buildKycUrl } from '../auth/kycPaths';
import { normalizeEmail } from '../auth/contactValidation';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';
import { renderEmailShell, renderEmailButton } from '../email/emailTemplate';
import { getEmailMessages, applyEmailTemplate } from '../email/emailMessages';
import { resolveSiteUrl } from '../invite/resolveSiteUrl';
import { buildTeamInviteWhatsAppMessage } from '../invite/whatsappInvite';
import { designateAdvisor } from './teamService';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function roleLabel(role: 'ADVISOR' | 'ADVISOR_MANAGER', locale?: string | null): string {
  const m = getEmailMessages(locale);
  return role === 'ADVISOR_MANAGER' ? m.invite.roleAdvisorManager : m.invite.roleAdvisor;
}

function postOnboardingPath(role: 'ADVISOR' | 'ADVISOR_MANAGER'): string {
  return role === 'ADVISOR' ? '/dashboard/clients' : '/dashboard';
}

export type TeamInviteRecord = {
  id: string;
  email: string;
  name: string | null;
  role: 'ADVISOR' | 'ADVISOR_MANAGER';
  status: string;
  expiresAt: string;
  createdAt: string;
  emailSent: boolean;
  whatsappSent: boolean;
  acceptUrl: string;
  whatsappMessage: string;
};

export async function inviteTeamMember(input: {
  email: string;
  name?: string | null;
  phone?: string | null;
  role: 'ADVISOR' | 'ADVISOR_MANAGER';
  uplineAdvisorId?: string | null;
  invitedByUserId: string;
  locale?: string | null;
}): Promise<TeamInviteRecord> {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error('INVALID_EMAIL');
  }

  if (input.role === 'ADVISOR' && !input.uplineAdvisorId) {
    throw new Error('ADVISOR_REQUIRES_UPLINE');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { systemRole: true }
  });

  if (
    existingUser &&
    existingUser.systemRole !== 'INVESTOR' &&
    existingUser.systemRole !== 'ADVISOR' &&
    existingUser.systemRole !== 'ADVISOR_MANAGER'
  ) {
    throw new Error('EMAIL_ALREADY_STAFF');
  }

  if (existingUser?.systemRole === 'ADVISOR' || existingUser?.systemRole === 'ADVISOR_MANAGER') {
    throw new Error('EMAIL_ALREADY_ADVISOR');
  }

  const pending = await prisma.teamInvite.findFirst({
    where: {
      email,
      role: { in: ['ADVISOR', 'ADVISOR_MANAGER'] },
      status: 'PENDING',
      expiresAt: { gt: new Date() }
    }
  });

  if (pending) {
    throw new Error('INVITE_ALREADY_PENDING');
  }

  if (input.role === 'ADVISOR_MANAGER' && input.uplineAdvisorId) {
    throw new Error('MANAGER_CANNOT_HAVE_UPLINE');
  }

  if (input.uplineAdvisorId) {
    const upline = await prisma.advisor.findUnique({
      where: { id: input.uplineAdvisorId },
      include: { user: { select: { systemRole: true } } }
    });

    if (!upline) {
      throw new Error('UPLINE_NOT_FOUND');
    }
  }

  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await prisma.teamInvite.create({
    data: {
      email,
      name: input.name?.trim() || null,
      role: input.role as PrismaSystemRole,
      uplineAdvisorId: input.role === 'ADVISOR_MANAGER' ? null : input.uplineAdvisorId ?? null,
      tokenHash: hashToken(rawToken),
      invitedByUserId: input.invitedByUserId,
      expiresAt
    }
  });

  const acceptUrl = `${resolveSiteUrl()}/api/team/invite/accept?token=${encodeURIComponent(rawToken)}`;
  const roleText = roleLabel(input.role, input.locale);
  const m = getEmailMessages(input.locale);
  const namePart = input.name?.trim() ? ` ${input.name.trim()}` : '';
  const greeting = applyEmailTemplate(m.invite.greeting, { name: namePart });
  const subject = applyEmailTemplate(m.invite.teamSubject, { roleLabel: roleText });
  const body = applyEmailTemplate(m.invite.teamBody, { roleLabel: roleText });

  const emailResult = await sendTransactionalEmail({
    to: email,
    subject,
    text: [
      greeting,
      '',
      body,
      acceptUrl,
      '',
      m.invite.expiry,
      '',
      m.common.brand
    ].join('\n'),
    html: renderEmailShell({
      locale: input.locale,
      bodyHtml: `
        <p>${greeting}</p>
        <p>${body}</p>
        ${renderEmailButton(acceptUrl, m.invite.cta)}
        <p style="color:#64748b;font-size:14px">${m.invite.expiry} ${m.invite.ignore}</p>
      `
    })
  });

  const whatsappMessage = buildTeamInviteWhatsAppMessage({
    acceptUrl,
    roleLabel: roleText,
    name: input.name
  });

  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    role: input.role,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    emailSent: emailResult.ok,
    whatsappSent: false,
    acceptUrl,
    whatsappMessage
  };
}

export async function acceptTeamInvite(token: string): Promise<{ redirectUrl: string }> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('INVALID_TOKEN');
  }

  const invite = await prisma.teamInvite.findUnique({
    where: { tokenHash: hashToken(trimmed) }
  });

  if (!invite || invite.status !== 'PENDING') {
    throw new Error('INVITE_NOT_FOUND');
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' }
    });
    throw new Error('INVITE_EXPIRED');
  }

  if (invite.role !== 'ADVISOR' && invite.role !== 'ADVISOR_MANAGER') {
    throw new Error('INVITE_ROLE_MISMATCH');
  }

  const role = invite.role as 'ADVISOR' | 'ADVISOR_MANAGER';

  await designateAdvisor({
    email: invite.email,
    name: invite.name,
    role,
    uplineAdvisorId: invite.uplineAdvisorId
  });

  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date()
    }
  });

  const onboardedUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { passwordHash: true }
  });

  const kycPath = buildKycUrl(postOnboardingPath(role));
  const accessPath = onboardedUser?.passwordHash ? '/acceso' : '/acceso/registro';
  const redirectUrl = `${accessPath}?returnTo=${encodeURIComponent(kycPath)}&email=${encodeURIComponent(invite.email)}&staffInvite=1`;

  return { redirectUrl };
}

export type PendingInviteRecord = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedByEmail: string;
};

export async function listPendingTeamInvites(): Promise<PendingInviteRecord[]> {
  const rows = await prisma.teamInvite.findMany({
    where: {
      role: { in: ['ADVISOR', 'ADVISOR_MANAGER'] },
      status: 'PENDING',
      expiresAt: { gt: new Date() }
    },
    include: { invitedBy: { select: { email: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    invitedByEmail: row.invitedBy.email
  }));
}

export async function cancelPendingInvite(inviteId: string): Promise<void> {
  const result = await prisma.teamInvite.updateMany({
    where: { id: inviteId, status: 'PENDING' },
    data: { status: 'CANCELLED' }
  });

  if (result.count === 0) {
    throw new Error('INVITE_NOT_FOUND');
  }
}

export async function resendTeamInvite(inviteId: string, locale?: string | null): Promise<TeamInviteRecord> {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
    include: { upline: true }
  });

  if (!invite || invite.status !== 'PENDING' || invite.role === 'INVESTOR') {
    throw new Error('INVITE_NOT_FOUND');
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' }
    });
    throw new Error('INVITE_EXPIRED');
  }

  const role = invite.role as 'ADVISOR' | 'ADVISOR_MANAGER';
  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: {
      tokenHash: hashToken(rawToken),
      expiresAt
    }
  });

  const acceptUrl = `${resolveSiteUrl()}/api/team/invite/accept?token=${encodeURIComponent(rawToken)}`;
  const roleText = roleLabel(role, locale);
  const m = getEmailMessages(locale);
  const namePart = invite.name?.trim() ? ` ${invite.name.trim()}` : '';
  const greeting = applyEmailTemplate(m.invite.greeting, { name: namePart });
  const subject = applyEmailTemplate(m.invite.teamSubject, { roleLabel: roleText });
  const body = applyEmailTemplate(m.invite.teamBody, { roleLabel: roleText });

  const emailResult = await sendTransactionalEmail({
    to: invite.email,
    subject,
    text: [
      greeting,
      '',
      `${m.invite.reminderPrefix}${body}`,
      acceptUrl,
      '',
      m.invite.expiry,
      '',
      m.common.brand
    ].join('\n'),
    html: renderEmailShell({
      locale,
      bodyHtml: `
        <p>${greeting}</p>
        <p>${m.invite.reminderPrefix}${body}</p>
        ${renderEmailButton(acceptUrl, m.invite.cta)}
        <p style="color:#64748b;font-size:14px">${m.invite.expiry}</p>
      `
    })
  });

  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    role,
    status: invite.status,
    expiresAt: expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    emailSent: emailResult.ok,
    whatsappSent: false,
    acceptUrl,
    whatsappMessage: buildTeamInviteWhatsAppMessage({
      acceptUrl,
      roleLabel: roleText,
      name: invite.name
    })
  };
}
