import bcrypt from 'bcryptjs';
import { prisma, SystemRole as PrismaSystemRole } from '@sanova/database';
import { issueVerificationCode, normalizePhoneE164 } from '../onboarding/verification';

const MIN_PASSWORD_LENGTH = 8;

export type RegisterInput = {
  email: string;
  password: string;
  phone: string;
  fullName: string;
  taxId: string;
};

export async function registerInvestor(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const phoneE164 = normalizePhoneE164(input.phone);
  const fullName = input.fullName.trim();
  const taxId = input.taxId.trim().replace(/\s/g, '');

  if (!email || !password || !fullName || !taxId) {
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
      name: fullName,
      kycFullName: fullName,
      kycDocumentId: taxId,
      systemRole: defaultRole
    },
    update: {
      passwordHash,
      phone: phoneE164,
      name: fullName,
      kycFullName: fullName,
      kycDocumentId: taxId,
      systemRole: defaultRole
    }
  });

  const emailOtp = await issueVerificationCode(user.id, 'EMAIL', email);
  const phoneOtp = await issueVerificationCode(user.id, 'PHONE', phoneE164);

  return {
    userId: user.id,
    email,
    phone: phoneE164,
    delivery: {
      email: emailOtp.delivered,
      phone: phoneOtp.delivered
    },
    devCodes: {
      email: emailOtp.devCode,
      phone: phoneOtp.devCode
    }
  };
}
