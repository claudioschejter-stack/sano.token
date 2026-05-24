import bcrypt from 'bcryptjs';
import { prisma, SystemRole as PrismaSystemRole } from '@sanova/database';
import { normalizeEmail, normalizePhoneE164 } from './contactValidation';
import { issueVerificationCode } from '../onboarding/verification';

const MIN_PASSWORD_LENGTH = 8;

export type RegisterInput = {
  email: string;
  password: string;
  phone: string;
  fullName?: string;
  taxId?: string;
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

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.passwordHash) {
    throw new Error('EMAIL_IN_USE');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const defaultRole = (process.env.AUTH_DEFAULT_ROLE ?? 'INVESTOR') as PrismaSystemRole;

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      phone: phoneE164,
      name: fullName ?? email.split('@')[0],
      kycFullName: fullName,
      kycDocumentId: taxId,
      systemRole: defaultRole
    },
    update: {
      passwordHash,
      phone: phoneE164,
      name: fullName ?? email.split('@')[0],
      kycFullName: fullName,
      kycDocumentId: taxId,
      systemRole: defaultRole
    }
  });

  const emailOtp = await issueVerificationCode(user.id, 'EMAIL', email);

  if (!emailOtp.delivered) {
    if (!existing) {
      await prisma.user.delete({ where: { id: user.id } });
    }

    throw new Error('EMAIL_DELIVERY_FAILED');
  }

  return {
    userId: user.id,
    email,
    phone: phoneE164,
    delivery: {
      email: emailOtp.delivered,
      phone: false
    },
    devCodes: {
      email: emailOtp.devCode,
      phone: undefined
    }
  };
}
