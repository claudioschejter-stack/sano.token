import { SignJWT } from 'jose';
import { prisma, SystemRole as PrismaSystemRole } from '@sanova/database';
import type { SystemRole } from './roles';

export type AuthUser = {
  id: string;
  email: string;
  role: SystemRole;
  roles: SystemRole[];
  accessToken: string;
};

const ALL_ROLES = new Set<SystemRole>([
  'ADMIN',
  'ADVISOR_MANAGER',
  'ADVISOR',
  'INVESTOR',
  'TREASURY',
  'OPERATOR'
]);

export async function issueAuthUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, systemRole: true }
  });

  if (!user) {
    return null;
  }

  const role = ALL_ROLES.has(user.systemRole as SystemRole) ? (user.systemRole as SystemRole) : 'INVESTOR';
  return issueAuthUser(user.id, user.email, role);
}

export async function issueAuthUser(userId: string, email: string, role: SystemRole): Promise<AuthUser> {
  const roles = [role];
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is not configured.');
  }

  const accessToken = await new SignJWT({
    sub: userId,
    email,
    roles
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('sanova-global-api')
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(secret));

  return {
    id: userId,
    email,
    role,
    roles,
    accessToken
  };
}

export async function updateUserRoleIfNeeded(userId: string, email: string, currentRole: SystemRole) {
  const roleFromAllowlist = resolveRoleFromAllowlist(email);
  if (!roleFromAllowlist || roleFromAllowlist === currentRole) {
    return currentRole;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { systemRole: roleFromAllowlist as PrismaSystemRole }
  });

  return roleFromAllowlist;
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
