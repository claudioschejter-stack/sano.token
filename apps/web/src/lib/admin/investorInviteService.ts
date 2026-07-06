import { createHash, randomBytes } from 'crypto';
import { prisma } from '@sanova/database';
import { buildKycUrl } from '../auth/kycPaths';
import { normalizeEmail, normalizePhoneE164 } from '../auth/contactValidation';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';
import { resolveSiteUrl } from '../invite/resolveSiteUrl';
import { buildInvestorInviteWhatsAppMessage } from '../invite/whatsappInvite';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type InvestorInviteRecord = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  emailSent: boolean;
  whatsappSent: boolean;
  acceptUrl: string;
  whatsappMessage: string;
};

export async function resolveInvestorInvitePhoneForEmail(email: string): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const invite = await prisma.teamInvite.findFirst({
    where: {
      email: normalized,
      role: 'INVESTOR',
      OR: [
        { status: 'ACCEPTED' },
        { status: 'PENDING', expiresAt: { gt: new Date() } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    select: { phone: true }
  });

  return invite?.phone?.trim() || null;
}

export async function applyInvestorInvitePhoneForUser(userId: string, email: string): Promise<void> {
  const phone = await resolveInvestorInvitePhoneForEmail(email);
  if (!phone) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true }
  });

  if (user?.phone?.trim()) {
    return;
  }

  const normalized = normalizePhoneE164(phone);
  if (!normalized) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { phone: normalized }
  });
}

export async function hasValidInvestorInviteForEmail(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  const invite = await prisma.teamInvite.findFirst({
    where: {
      email: normalized,
      role: 'INVESTOR',
      OR: [
        { status: 'ACCEPTED' },
        { status: 'PENDING', expiresAt: { gt: new Date() } }
      ]
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
  phone?: string | null;
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

  let invitePhone: string | null = null;
  if (input.phone?.trim()) {
    invitePhone = normalizePhoneE164(input.phone);
    if (!invitePhone) {
      throw new Error('INVALID_PHONE');
    }
  }

  const invite = await prisma.teamInvite.create({
    data: {
      email,
      name: input.name?.trim() || null,
      phone: invitePhone,
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

  const whatsappMessage = buildInvestorInviteWhatsAppMessage({ acceptUrl, name: input.name });

  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    emailSent: emailResult.ok,
    whatsappSent: false,
    acceptUrl,
    whatsappMessage
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
    select: { passwordHash: true, systemRole: true, phone: true }
  });

  if (existingUser) {
    await prisma.user.update({
      where: { email: invite.email },
      data: {
        investorAccessEnabled: true,
        ...(invite.phone?.trim() && !existingUser.phone
          ? { phone: normalizePhoneE164(invite.phone) ?? undefined }
          : {})
      }
    });
  }

  const kycPath = buildKycUrl('/marketplace');
  const accessPath = existingUser?.passwordHash ? '/acceso' : '/acceso/registro';
  const redirectUrl = `${accessPath}?returnTo=${encodeURIComponent(kycPath)}&email=${encodeURIComponent(invite.email)}&investorInvite=1`;

  return { redirectUrl };
}

export async function listPendingInvestorInvites(): Promise<
  Array<{
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    status: string;
    expiresAt: string;
    createdAt: string;
    invitedByEmail: string;
    incorporatedByAdvisorId: string | null;
  }>
> {
  const rows = await prisma.teamInvite.findMany({
    where: {
      role: 'INVESTOR',
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
    phone: row.phone,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    invitedByEmail: row.invitedBy.email,
    incorporatedByAdvisorId: row.uplineAdvisorId
  }));
}

export async function cancelInvestorInvite(inviteId: string): Promise<void> {
  const result = await prisma.teamInvite.updateMany({
    where: { id: inviteId, role: 'INVESTOR', status: 'PENDING' },
    data: { status: 'CANCELLED' }
  });

  if (result.count === 0) {
    throw new Error('INVITE_NOT_FOUND');
  }
}

export async function resendInvestorInvite(inviteId: string): Promise<InvestorInviteRecord> {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId }
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

  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: {
      tokenHash: hashToken(rawToken),
      expiresAt
    }
  });

  const acceptUrl = `${resolveSiteUrl()}/api/investor/invite/accept?token=${encodeURIComponent(rawToken)}`;

  const emailResult = await sendTransactionalEmail({
    to: invite.email,
    subject: 'Invitación Sanova Global — Inversor',
    text: [
      `Hola${invite.name?.trim() ? ` ${invite.name.trim()}` : ''},`,
      '',
      'Recordatorio: fuiste invitado a invertir en activos tokenizados de Sanova Global.',
      acceptUrl,
      '',
      'El enlace vence en 7 días.',
      '',
      'Sanova Global'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:520px">
        <p>Hola${invite.name?.trim() ? ` ${invite.name.trim()}` : ''},</p>
        <p>Recordatorio: fuiste invitado a unirte a <strong>Sanova Global</strong> como <strong>inversor</strong>.</p>
        <p style="margin:28px 0">
          <a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px">
            Aceptar invitación
          </a>
        </p>
        <p style="color:#64748b;font-size:14px">El enlace vence en 7 días.</p>
      </div>
    `
  });

  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    status: invite.status,
    expiresAt: expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    emailSent: emailResult.ok,
    whatsappSent: false,
    acceptUrl,
    whatsappMessage: buildInvestorInviteWhatsAppMessage({ acceptUrl, name: invite.name })
  };
}
