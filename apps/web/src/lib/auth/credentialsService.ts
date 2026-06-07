import bcrypt from 'bcryptjs';
import { prisma, SystemRole as PrismaSystemRole } from '@sanova/database';
import type { SystemRole } from './roles';
import { issueAuthUser, type AuthUser } from './issueAuthUser';

const ALL_ROLES = new Set<SystemRole>([
  'ADMIN',
  'ADVISOR_MANAGER',
  'ADVISOR',
  'INVESTOR',
  'TREASURY',
  'OPERATOR'
]);

export type { AuthUser };

export async function verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return null;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser?.passwordHash) {
    const isValid = await bcrypt.compare(password, existingUser.passwordHash);
    if (!isValid) {
      return null;
    }

    const role = await resolveRolesForEmail(normalizedEmail, existingUser.systemRole as SystemRole);
    const updatedUser =
      role === existingUser.systemRole
        ? existingUser
        : await prisma.user.update({
            where: { id: existingUser.id },
            data: { systemRole: role as PrismaSystemRole }
          });

    return issueAuthUser(updatedUser.id, updatedUser.email, role);
  }

  if (!canBootstrapWithEnvPassword(normalizedEmail, password)) {
    return null;
  }

  const role = await resolveRolesForEmail(normalizedEmail);
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      passwordHash,
      systemRole: role as PrismaSystemRole
    },
    update: {
      passwordHash,
      systemRole: role as PrismaSystemRole
    }
  });

  return issueAuthUser(user.id, user.email, role);
}

function canBootstrapWithEnvPassword(email: string, password: string): boolean {
  const bootstrapPassword = process.env.AUTH_ADMIN_PASSWORD;
  if (!bootstrapPassword || password !== bootstrapPassword) {
    return false;
  }

  return parseEmailList(process.env.AUTH_ADMIN_EMAILS).has(email);
}

async function resolveRolesForEmail(email: string, currentRole?: SystemRole): Promise<SystemRole> {
  const roleFromAllowlist = resolveRoleFromAllowlist(email);
  if (roleFromAllowlist) {
    return roleFromAllowlist;
  }

  if (currentRole) {
    return currentRole;
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
