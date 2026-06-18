import { isMarketplaceTradingRole, type SystemRole } from '../auth/roles';

const PLATFORM_OPS_ROLES = new Set<SystemRole>(['ADMIN', 'TREASURY', 'OPERATOR']);

/** KYC + wallet onboarding applies to investors and advisors; platform ops skip it. */
export function requiresInvestorStyleOnboarding(role: SystemRole | string | null | undefined): boolean {
  if (!role) {
    return true;
  }

  return isMarketplaceTradingRole(role as SystemRole);
}

export function canAccessPortalWithoutInvestorOnboarding(
  role: SystemRole | string | null | undefined
): boolean {
  if (!role) {
    return false;
  }

  return PLATFORM_OPS_ROLES.has(role as SystemRole);
}
