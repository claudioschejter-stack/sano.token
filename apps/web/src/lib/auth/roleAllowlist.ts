import type { SystemRole } from './roles';

export const ALL_SYSTEM_ROLES = new Set<SystemRole>([
  'ADMIN',
  'ADVISOR_MANAGER',
  'ADVISOR',
  'INVESTOR',
  'TREASURY',
  'OPERATOR'
]);

const ROLE_ALLOWLIST_ENV_MAP: Array<{ envKey: string; role: SystemRole }> = [
  { envKey: 'AUTH_ADMIN_EMAILS', role: 'ADMIN' },
  { envKey: 'AUTH_ADVISOR_MANAGER_EMAILS', role: 'ADVISOR_MANAGER' },
  { envKey: 'AUTH_ADVISOR_EMAILS', role: 'ADVISOR' },
  { envKey: 'AUTH_TREASURY_EMAILS', role: 'TREASURY' },
  { envKey: 'AUTH_OPERATOR_EMAILS', role: 'OPERATOR' },
  { envKey: 'AUTH_INVESTOR_EMAILS', role: 'INVESTOR' }
];

export function parseEmailAllowlist(raw?: string | null): Set<string> {
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

export function resolveRoleFromAllowlist(email: string): SystemRole | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const { envKey, role } of ROLE_ALLOWLIST_ENV_MAP) {
    if (parseEmailAllowlist(process.env[envKey]).has(normalized)) {
      return role;
    }
  }

  const legacyAdminEmail = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase();
  if (legacyAdminEmail && legacyAdminEmail === normalized) {
    return 'ADMIN';
  }

  return null;
}

export function resolveRoleForEmail(email: string, fallbackRole?: SystemRole): SystemRole {
  const fromAllowlist = resolveRoleFromAllowlist(email);
  if (fromAllowlist) {
    return fromAllowlist;
  }

  if (fallbackRole && ALL_SYSTEM_ROLES.has(fallbackRole)) {
    return fallbackRole;
  }

  const defaultRole = (process.env.AUTH_DEFAULT_ROLE ?? 'INVESTOR') as SystemRole;
  return ALL_SYSTEM_ROLES.has(defaultRole) ? defaultRole : 'INVESTOR';
}

export function resolveRoleForExistingUser(email: string, currentRole: SystemRole): SystemRole {
  return resolveRoleForEmail(email, currentRole);
}

export function isPreApprovedInvestorEmail(email: string): boolean {
  return resolveRoleFromAllowlist(email) === 'INVESTOR';
}
