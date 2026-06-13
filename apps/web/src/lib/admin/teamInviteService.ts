import { createHash, randomBytes } from 'crypto';
import { prisma, type SystemRole as PrismaSystemRole } from '@sanova/database';
import { buildKycUrl } from '../auth/kycPaths';
import { normalizeEmail } from '../auth/contactValidation';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';
import { designateAdvisor } from './teamService';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function resolveSiteUrl(): string {
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://sano-token-web.vercel.app'
  ).replace(/\/$/, '');
}

function roleLabel(role: 'ADVISOR' | 'ADVISOR_MANAGER'): string {
  return role === 'ADVISOR_MANAGER' ? 'Gerente' : 'Asesor';
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
};

export async function inviteTeamMember(input: {
  email: string;
  name?: string | null;
  role: 'ADVISOR' | 'ADVISOR_MANAGER';
  uplineAdvisorId?: string | null;
  invitedByUserId: string;
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
    where: { email, status: 'PENDING', expiresAt: { gt: new Date() } }
  });

  if (pending) {
    throw new Error('INVITE_ALREADY_PENDING');
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
  const roleText = roleLabel(input.role);

  const emailResult = await sendTransactionalEmail({
    to: email,
    subject: `Invitación Sanova Global — ${roleText}`,
    text: [
      `Hola${input.name?.trim() ? ` ${input.name.trim()}` : ''},`,
      '',
      `Fuiste invitado a unirte a Sanova Global como ${roleText}.`,
      'Para aceptar la invitación y continuar con la verificación KYC, abrí este enlace:',
      acceptUrl,
      '',
      'El enlace vence en 7 días.',
      '',
      'Sanova Global'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:520px">
        <p>Hola${input.name?.trim() ? ` ${input.name.trim()}` : ''},</p>
        <p>Fuiste invitado a unirte a <strong>Sanova Global</strong> como <strong>${roleText}</strong>.</p>
        <p>Al aceptar, serás dirigido al proceso de verificación KYC con el rol asignado.</p>
        <p style="margin:28px 0">
          <a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px">
            Aceptar invitación
          </a>
        </p>
        <p style="color:#64748b;font-size:14px">El enlace vence en 7 días. Si no esperabas este correo, podés ignorarlo.</p>
        <p style="color:#64748b;font-size:14px">Sanova Global</p>
      </div>
    `
  });

  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    role: input.role,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    emailSent: emailResult.ok
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

  const kycPath = buildKycUrl(postOnboardingPath(role));
  const redirectUrl = `/acceso/registro?returnTo=${encodeURIComponent(kycPath)}&email=${encodeURIComponent(invite.email)}&staffInvite=1`;

  return { redirectUrl };
}
