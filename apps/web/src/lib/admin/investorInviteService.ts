import { createHash, randomBytes } from 'crypto';
import { prisma } from '@sanova/database';
import { buildKycUrl } from '../auth/kycPaths';
import { normalizeEmail } from '../auth/contactValidation';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function resolveSiteUrl(): string {
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://www.sanovacapital.com'
  ).replace(/\/$/, '');
}

export type InvestorInviteRecord = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  emailSent: boolean;
};

export async function hasValidInvestorInviteForEmail(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  const invite = await prisma.teamInvite.findFirst({
    where: {
      email: normalized,
      role: 'INVESTOR',
      status: { in: ['PENDING', 'ACCEPTED'] },
      expiresAt: { gt: new Date() }
    }
  });

  return Boolean(invite);
}

export async function markInvestorInviteAcceptedForEmail(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return;
  }

  await prisma.teamInvite.updateMany({
    where: {
      email: normalized,
      role: 'INVESTOR',
      status: 'PENDING',
      expiresAt: { gt: new Date() }
    },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date()
    }
  });
}

export async function inviteInvestor(input: {
  email: string;
  name?: string | null;
  incorporatedByAdvisorId?: string | null;
  invitedByUserId: string;
}): Promise<InvestorInviteRecord> {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error('INVALID_EMAIL');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { systemRole: true, investorAccessEnabled: true }
  });

  if (
    existingUser &&
    existingUser.systemRole !== 'INVESTOR' &&
    existingUser.systemRole !== 'ADVISOR' &&
    existingUser.systemRole !== 'ADVISOR_MANAGER'
  ) {
    throw new Error('EMAIL_ALREADY_STAFF');
  }

  const pending = await prisma.teamInvite.findFirst({
    where: { email, role: 'INVESTOR', status: 'PENDING', expiresAt: { gt: new Date() } }
  });

  if (pending) {
    throw new Error('INVITE_ALREADY_PENDING');
  }

  if (input.incorporatedByAdvisorId) {
    const advisor = await prisma.advisor.findUnique({ where: { id: input.incorporatedByAdvisorId } });
    if (!advisor) {
      throw new Error('ADVISOR_NOT_FOUND');
    }
  }

  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await prisma.teamInvite.create({
    data: {
      email,
      name: input.name?.trim() || null,
      role: 'INVESTOR',
      uplineAdvisorId: input.incorporatedByAdvisorId ?? null,
      tokenHash: hashToken(rawToken),
      invitedByUserId: input.invitedByUserId,
      expiresAt
    }
  });

  const acceptUrl = `${resolveSiteUrl()}/api/investor/invite/accept?token=${encodeURIComponent(rawToken)}`;

  const emailResult = await sendTransactionalEmail({
    to: email,
    subject: 'Invitación Sanova Global — Inversor',
    text: [
      `Hola${input.name?.trim() ? ` ${input.name.trim()}` : ''},`,
      '',
      'Fuiste invitado a invertir en activos tokenizados de Sanova Global.',
      'Para aceptar la invitación y comenzar tu verificación KYC:',
      acceptUrl,
      '',
      'El enlace vence en 7 días.',
      '',
      'Sanova Global'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:520px">
        <p>Hola${input.name?.trim() ? ` ${input.name.trim()}` : ''},</p>
        <p>Fuiste invitado a unirte a <strong>Sanova Global</strong> como <strong>inversor</strong>.</p>
        <p>Al aceptar, podrás registrarte, completar KYC y acceder al marketplace privado.</p>
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

  if (existingUser?.systemRole === 'INVESTOR') {
    await prisma.user.update({
      where: { email },
      data: { investorAccessEnabled: true }
    });
  }

  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    emailSent: emailResult.ok
  };
}

export async function acceptInvestorInvite(token: string): Promise<{ redirectUrl: string }> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('INVALID_TOKEN');
  }

  const invite = await prisma.teamInvite.findUnique({
    where: { tokenHash: hashToken(trimmed) }
  });

  if (!invite || invite.role !== 'INVESTOR' || invite.status !== 'PENDING') {
    throw new Error('INVITE_NOT_FOUND');
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' }
    });
    throw new Error('INVITE_EXPIRED');
  }

  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date()
    }
  });

  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { passwordHash: true, systemRole: true }
  });

  if (existingUser) {
    await prisma.user.update({
      where: { email: invite.email },
      data: { investorAccessEnabled: true }
    });
  }

  const kycPath = buildKycUrl('/marketplace');
  const accessPath = existingUser?.passwordHash ? '/acceso' : '/acceso/registro';
  const redirectUrl = `${accessPath}?returnTo=${encodeURIComponent(kycPath)}&email=${encodeURIComponent(invite.email)}&investorInvite=1`;

  return { redirectUrl };
}
