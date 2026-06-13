import bcrypt from 'bcryptjs';
import { prisma, SystemRole as PrismaSystemRole } from '@sanova/database';
import type { SystemRole } from './roles';
import {
  parseEmailAllowlist,
  resolveRoleForEmail,
  resolveRoleForExistingUser
} from './roleAllowlist';
import { issueAuthUser, type AuthUser } from './issueAuthUser';

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

    const role = resolveRoleForExistingUser(normalizedEmail, existingUser.systemRole as SystemRole);
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

  const role = resolveRoleForEmail(normalizedEmail);
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

  return parseEmailAllowlist(process.env.AUTH_ADMIN_EMAILS).has(email);
}
