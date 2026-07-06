import bcrypt from 'bcryptjs';
import { prisma, SystemRole as PrismaSystemRole } from '@sanova/database';
import { normalizeEmail, normalizePhoneE164 } from './contactValidation';
import { isInvestorOpenRegistration, resolveInvestorAccessOnRegister } from './investorAccess';
import {
  hasValidInvestorInviteForEmail,
  markInvestorInviteAcceptedForEmail,
  resolveInvestorInvitePhoneForEmail
} from '../admin/investorInviteService';
import { applyInvestorInviteAdvisorForUser } from '../invite/applyInvestorInviteAdvisor';
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
  phone?: string;
  fullName?: string;
  taxId?: string;
  termsAccepted?: boolean;
  inviteCode?: string;
};

export async function registerInvestor(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const phoneRaw = input.phone?.trim() ?? '';
  const invitePhone = await resolveInvestorInvitePhoneForEmail(email);
  const phoneE164 = phoneRaw
    ? normalizePhoneE164(phoneRaw)
    : invitePhone
      ? normalizePhoneE164(invitePhone)
      : null;
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

  if (phoneRaw && !phoneE164) {
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

  const openRegistration = isInvestorOpenRegistration();

  const explicitAccessGrant =
    staffOnboarding ||
    isPreApprovedInvestorEmail(email) ||
    (await hasValidInvestorInviteForEmail(email));

  const inviteCodeGrant =
    !openRegistration && resolveInvestorAccessOnRegister(input.inviteCode);

  const investorAccessEnabled =
    staffOnboarding ||
    (!existing && openRegistration) ||
    explicitAccessGrant ||
    inviteCodeGrant ||
    Boolean(existing?.investorAccessEnabled);

  if (!staffOnboarding && !openRegistration && !investorAccessEnabled && !existing) {
    throw new Error('INVALID_INVITE_CODE');
  }

  if (
    shouldRejectDisabledAccountRegistration({
      existing,
      staffOnboarding,
      explicitAccessGrant,
      inviteCodeGrant
    })
  ) {
    throw new Error('INVESTOR_ACCESS_NOT_ENABLED');
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
    ...(phoneE164 ? { phone: phoneE164 } : {}),
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
          phone: phoneE164 ?? existing.phone,
          emailVerifiedAt: existing.emailVerifiedAt,
          phoneVerifiedAt: existing.phoneVerifiedAt,
          accountStatus:
            existing.accountStatus === 'SUSPENDED' ? 'SUSPENDED' : existing.accountStatus,
          kycStatus: existing.kycStatus,
          investorAccessEnabled: existing.investorAccessEnabled || explicitAccessGrant || inviteCodeGrant
        }
  });

  if (user.systemRole === 'INVESTOR' && (await hasValidInvestorInviteForEmail(email))) {
    await markInvestorInviteAcceptedForEmail(email);
    await applyInvestorInviteAdvisorForUser(user.id, email);
  }

  return {
    userId: user.id,
    email,
    phone: user.phone
  };
}

/** Pure policy helper — mirrors investorAccessEnabled resolution in registerInvestor(). */
export function resolveInvestorAccessForRegistration(input: {
  existing: { investorAccessEnabled: boolean } | null;
  openRegistration: boolean;
  explicitAccessGrant: boolean;
  inviteCodeGrant: boolean;
  staffOnboarding?: boolean;
}): boolean {
  if (input.staffOnboarding) {
    return true;
  }

  return (
    (!input.existing && input.openRegistration) ||
    input.explicitAccessGrant ||
    input.inviteCodeGrant ||
    Boolean(input.existing?.investorAccessEnabled)
  );
}

export function shouldRejectDisabledAccountRegistration(input: {
  existing: { investorAccessEnabled: boolean; passwordHash: string | null } | null;
  staffOnboarding: boolean;
  explicitAccessGrant: boolean;
  inviteCodeGrant: boolean;
}): boolean {
  return Boolean(
    input.existing &&
      !input.staffOnboarding &&
      !input.existing.investorAccessEnabled &&
      !input.explicitAccessGrant &&
      !input.inviteCodeGrant
  );
}
