export type SystemRole =
  | 'ADMIN'
  | 'ADVISOR_MANAGER'
  | 'ADVISOR'
  | 'INVESTOR'
  | 'TREASURY'
  | 'OPERATOR';

/** Roles principales visibles en la plataforma (4 roles operativos). */
export const CORE_PLATFORM_ROLES = [
  'ADMIN',
  'ADVISOR_MANAGER',
  'ADVISOR',
  'INVESTOR'
] as const satisfies readonly SystemRole[];

/** Roles assignable from the admin team panel. */
export const ADMIN_ASSIGNABLE_ROLES = [
  'ADMIN',
  'ADVISOR_MANAGER',
  'ADVISOR',
  'INVESTOR',
  'TREASURY',
  'OPERATOR'
] as const satisfies readonly SystemRole[];

export type CorePlatformRole = (typeof CORE_PLATFORM_ROLES)[number];

export const ROLE_HOME_PATH: Record<SystemRole, string> = {
  ADMIN: '/dashboard',
  ADVISOR_MANAGER: '/dashboard',
  ADVISOR: '/dashboard',
  INVESTOR: '/marketplace',
  TREASURY: '/dashboard/cash-flow',
  OPERATOR: '/dashboard'
};

export function resolvePostLoginPath(role: SystemRole, accountOperational = false): string {
  if (!accountOperational) {
    return '/kyc';
  }

  return ROLE_HOME_PATH[role] ?? '/marketplace';
}

export function isStaffRole(role: SystemRole): boolean {
  return role === 'ADMIN' || role === 'ADVISOR_MANAGER' || role === 'ADVISOR' || role === 'TREASURY' || role === 'OPERATOR';
}

export function isCorePlatformRole(role: SystemRole): role is CorePlatformRole {
  return (CORE_PLATFORM_ROLES as readonly SystemRole[]).includes(role);
}
