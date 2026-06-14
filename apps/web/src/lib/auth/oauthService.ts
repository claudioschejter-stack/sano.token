import { prisma, SystemRole as PrismaSystemRole } from '@sanova/database';
import { SignJWT } from 'jose';
import type { SystemRole } from './roles';
import { hasValidInvestorInviteForEmail } from '../admin/investorInviteService';
import { isPreApprovedInvestorEmail, resolveRoleForEmail, resolveRoleForExistingUser } from './roleAllowlist';

type OAuthLoginInput = {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
  providerAccountId: string;
};

async function resolveInvestorAccessForOAuth(email: string): Promise<boolean> {
  return (
    process.env.INVESTOR_OPEN_REGISTRATION === 'true' ||
    isPreApprovedInvestorEmail(email) ||
    (await hasValidInvestorInviteForEmail(email))
  );
}

export async function handleOAuthLogin(input: OAuthLoginInput) {
  const email = input.email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { systemRole: true, investorAccessEnabled: true }
  });

  const role = existingUser
    ? resolveRoleForExistingUser(email, existingUser.systemRole as SystemRole)
    : resolveRoleForEmail(email);

  const investorAccessForOAuth = await resolveInvestorAccessForOAuth(email);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: input.name ?? undefined,
      image: input.image ?? undefined,
      oauthProvider: input.provider,
      oauthProviderId: input.providerAccountId,
      systemRole: role as PrismaSystemRole,
      investorAccessEnabled: role === 'INVESTOR' ? investorAccessForOAuth : false
    },
    update: {
      name: input.name ?? undefined,
      image: input.image ?? undefined,
      oauthProvider: input.provider,
      oauthProviderId: input.providerAccountId,
      systemRole: role as PrismaSystemRole,
      ...(role === 'INVESTOR' && !existingUser?.investorAccessEnabled && investorAccessForOAuth
        ? { investorAccessEnabled: true }
        : {})
    }
  });

  const roles = [user.systemRole as SystemRole];
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is not configured.');
  }

  const accessToken = await new SignJWT({
    sub: user.id,
    email: user.email,
    roles
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('sanova-global-api')
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(secret));

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 43200,
    roles,
    role: roles[0]
  };
}
