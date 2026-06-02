import bcrypt from 'bcryptjs';
import { prisma, SystemRole as PrismaSystemRole } from '@sanova/database';
import { normalizeEmail, normalizePhoneE164 } from './contactValidation';
import { resolveInvestorAccessOnRegister } from './investorAccess';

const MIN_PASSWORD_LENGTH = 8;

export type RegisterInput = {
  email: string;
  password: string;
  phone: string;
  fullName?: string;
  taxId?: string;
  termsAccepted?: boolean;
  inviteCode?: string;
};

export async function registerInvestor(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const phoneE164 = normalizePhoneE164(input.phone);
  const fullName = input.fullName?.trim() || null;
  const taxId = input.taxId?.trim().replace(/\s/g, '') || null;

  if (!email) {
    throw new Error('INVALID_EMAIL');
  }

  if (!password) {
    throw new Error('INVALID_INPUT');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('WEAK_PASSWORD');
  }

  if (!phoneE164) {
    throw new Error('INVALID_PHONE');
  }

  if (!input.termsAccepted) {
    throw new Error('TERMS_NOT_ACCEPTED');
  }

  const investorAccessEnabled = resolveInvestorAccessOnRegister(input.inviteCode);
  if (input.inviteCode?.trim() && !investorAccessEnabled && process.env.INVESTOR_OPEN_REGISTRATION !== 'true') {
    throw new Error('INVALID_INVITE_CODE');
  }

  const termsAcceptedAt = new Date();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.passwordHash) {
    throw new Error('EMAIL_IN_USE');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const defaultRole = (process.env.AUTH_DEFAULT_ROLE ?? 'INVESTOR') as PrismaSystemRole;
  const preserveStaffRole =
    existing &&
    (existing.systemRole === 'ADVISOR' ||
      existing.systemRole === 'ADVISOR_MANAGER' ||
      existing.systemRole === 'ADMIN' ||
      existing.systemRole === 'TREASURY' ||
      existing.systemRole === 'OPERATOR');

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      phone: phoneE164,
      name: fullName ?? email.split('@')[0],
      kycFullName: fullName,
      kycDocumentId: taxId,
      systemRole: defaultRole,
      termsAcceptedAt,
      investorAccessEnabled
    },
    update: {
      passwordHash,
      phone: phoneE164,
      name: fullName ?? email.split('@')[0],
      kycFullName: fullName,
      kycDocumentId: taxId,
      systemRole: preserveStaffRole ? existing.systemRole : defaultRole,
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      accountStatus: 'ONBOARDING',
      kycStatus: 'PENDING',
      termsAcceptedAt,
      investorAccessEnabled: preserveStaffRole
        ? existing.investorAccessEnabled
        : existing.investorAccessEnabled || investorAccessEnabled
    }
  });

  return {
    userId: user.id,
    email,
    phone: phoneE164
  };
}
