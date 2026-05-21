import { prisma, SystemRole as PrismaSystemRole } from '@sanova/database';
import { SignJWT } from 'jose';
import type { SystemRole } from './roles';

type OAuthLoginInput = {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
  providerAccountId: string;
};

const ALL_ROLES = new Set<SystemRole>([
  'ADMIN',
  'ADVISOR_MANAGER',
  'ADVISOR',
  'INVESTOR',
  'TREASURY',
  'OPERATOR'
]);

export async function handleOAuthLogin(input: OAuthLoginInput) {
  const email = input.email.trim().toLowerCase();
  const role = await resolveRolesForEmail(email);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: input.name ?? undefined,
      image: input.image ?? undefined,
      oauthProvider: input.provider,
      oauthProviderId: input.providerAccountId,
      systemRole: role as PrismaSystemRole
    },
    update: {
      name: input.name ?? undefined,
      image: input.image ?? undefined,
      oauthProvider: input.provider,
      oauthProviderId: input.providerAccountId,
      systemRole: role as PrismaSystemRole
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

async function resolveRolesForEmail(email: string): Promise<SystemRole> {
  const roleFromAllowlist = resolveRoleFromAllowlist(email);
  if (roleFromAllowlist) {
    return roleFromAllowlist;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { systemRole: true }
  });

  if (existingUser?.systemRole) {
    return existingUser.systemRole as SystemRole;
  }

  const defaultRole = (process.env.AUTH_DEFAULT_ROLE ?? 'INVESTOR') as SystemRole;
  return ALL_ROLES.has(defaultRole) ? defaultRole : 'INVESTOR';
}

function resolveRoleFromAllowlist(email: string): SystemRole | null {
  const roleMaps: Array<{ envKey: string; role: SystemRole }> = [
    { envKey: 'AUTH_ADMIN_EMAILS', role: 'ADMIN' },
    { envKey: 'AUTH_ADVISOR_MANAGER_EMAILS', role: 'ADVISOR_MANAGER' },
    { envKey: 'AUTH_ADVISOR_EMAILS', role: 'ADVISOR' },
    { envKey: 'AUTH_INVESTOR_EMAILS', role: 'INVESTOR' }
  ];

  for (const { envKey, role } of roleMaps) {
    if (parseEmailList(process.env[envKey]).has(email)) {
      return role;
    }
  }

  const legacyAdminEmail = process.env.AUTH_ADMIN_EMAIL;
  if (legacyAdminEmail && legacyAdminEmail.toLowerCase() === email) {
    return 'ADMIN';
  }

  return null;
}

function parseEmailList(raw?: string | null): Set<string> {
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}
