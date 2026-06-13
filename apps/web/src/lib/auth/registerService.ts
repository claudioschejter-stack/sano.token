import bcrypt from 'bcryptjs';
import { prisma, SystemRole as PrismaSystemRole } from '@sanova/database';
import { normalizeEmail, normalizePhoneE164 } from './contactValidation';
import { resolveInvestorAccessOnRegister } from './investorAccess';
import {
  isPreApprovedInvestorEmail,
  resolveRoleForEmail,
  resolveRoleFromAllowlist
} from './roleAllowlist';
import { isStaffRole, type SystemRole } from './roles';

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

  const existing = await prisma.user.findUnique({ where: { email } });
  const allowlistRole = resolveRoleFromAllowlist(email);

  if (
    !existing &&
    (allowlistRole === 'ADVISOR' || allowlistRole === 'ADVISOR_MANAGER')
  ) {
    throw new Error('STAFF_INVITE_REQUIRED');
  }

  const selfRegisterStaffRole =
    allowlistRole === 'ADMIN' ||
    allowlistRole === 'TREASURY' ||
    allowlistRole === 'OPERATOR';

  const staffOnboarding =
    (existing && isStaffRole(existing.systemRole as SystemRole) && !existing.passwordHash) ||
    selfRegisterStaffRole;

  const investorAccessEnabled =
    staffOnboarding ||
    isPreApprovedInvestorEmail(email) ||
    resolveInvestorAccessOnRegister(input.inviteCode);

  if (
    !staffOnboarding &&
    process.env.INVESTOR_OPEN_REGISTRATION !== 'true' &&
    !investorAccessEnabled
  ) {
    throw new Error('INVALID_INVITE_CODE');
  }

  const termsAcceptedAt = new Date();

  if (existing?.passwordHash) {
    throw new Error('EMAIL_IN_USE');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const defaultRole = (process.env.AUTH_DEFAULT_ROLE ?? 'INVESTOR') as SystemRole;
  const preserveStaffRole =
    existing && isStaffRole(existing.systemRole as SystemRole);

  const systemRole = preserveStaffRole
    ? (existing.systemRole as PrismaSystemRole)
    : (resolveRoleForEmail(email, defaultRole) as PrismaSystemRole);

  const sharedProfile = {
    passwordHash,
    phone: phoneE164,
    name: fullName ?? email.split('@')[0],
    kycFullName: fullName,
    kycDocumentId: taxId,
    systemRole,
    termsAcceptedAt
  };

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      ...sharedProfile,
      investorAccessEnabled
    },
    update: preserveStaffRole
      ? {
          ...sharedProfile,
          investorAccessEnabled: existing.investorAccessEnabled
        }
      : {
          ...sharedProfile,
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          accountStatus: 'ONBOARDING',
          kycStatus: 'PENDING',
          investorAccessEnabled: existing.investorAccessEnabled || investorAccessEnabled
        }
  });

  return {
    userId: user.id,
    email,
    phone: phoneE164
  };
}
