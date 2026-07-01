import type { SystemRole } from './roles';
import { ROLE_HOME_PATH } from './roles';

const ADMIN_ROUTE_PREFIXES = [
  '/dashboard/investors',
  '/dashboard/assets',
  '/dashboard/loans',
  '/dashboard/treasury',
  '/dashboard/settings',
  '/dashboard/cobrar',
  '/dashboard/account-audit'
] as const;

const ADMIN_ONLY_ROUTE_PREFIXES = [] as const;

const ADVISOR_STAFF_ROUTE_PREFIXES = ['/dashboard/clients'] as const;

const ADVISOR_COMMISSIONS_PREFIX = '/dashboard/commissions';

const MANAGER_TEAM_PREFIX = '/dashboard/team';

const INVESTOR_ROUTE_PREFIXES = ['/dashboard/portfolio', '/dashboard/inversiones'] as const;

const CASH_FLOW_PREFIX = '/dashboard/cash-flow';

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function matchesAnyPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => matchesPrefix(pathname, prefix));
}

/** Returns allowed roles for a dashboard path, or null if any authenticated role may access. */
export function getRequiredRolesForPath(pathname: string): SystemRole[] | null {
  if (matchesAnyPrefix(pathname, ADMIN_ROUTE_PREFIXES)) {
    return ['ADMIN'];
  }

  if (matchesAnyPrefix(pathname, ADMIN_ONLY_ROUTE_PREFIXES)) {
    return ['ADMIN'];
  }

  if (matchesPrefix(pathname, MANAGER_TEAM_PREFIX)) {
    return ['ADMIN', 'ADVISOR_MANAGER'];
  }

  if (matchesPrefix(pathname, ADVISOR_COMMISSIONS_PREFIX)) {
    return ['ADMIN', 'ADVISOR', 'ADVISOR_MANAGER'];
  }

  if (matchesAnyPrefix(pathname, ADVISOR_STAFF_ROUTE_PREFIXES)) {
    return ['ADVISOR', 'ADVISOR_MANAGER'];
  }

  if (matchesPrefix(pathname, CASH_FLOW_PREFIX)) {
    return ['INVESTOR', 'TREASURY'];
  }

  if (matchesAnyPrefix(pathname, INVESTOR_ROUTE_PREFIXES)) {
    return ['INVESTOR', 'ADVISOR', 'ADVISOR_MANAGER'];
  }

  return null;
}

export function canAccessPath(role: SystemRole | undefined, pathname: string): boolean {
  const requiredRoles = getRequiredRolesForPath(pathname);

  if (!requiredRoles) {
    return true;
  }

  if (!role) {
    return false;
  }

  return requiredRoles.includes(role);
}

export function redirectPathForRole(role: SystemRole | undefined): string {
  return ROLE_HOME_PATH[role ?? 'INVESTOR'] ?? '/marketplace';
}
