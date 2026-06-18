import { isStaffRole, type SystemRole } from '../auth/roles';

/** KYC + wallet onboarding gate applies to retail investors only, not platform staff. */
export function requiresInvestorStyleOnboarding(role: SystemRole | string | null | undefined): boolean {
  if (!role) {
    return true;
  }

  return !isStaffRole(role as SystemRole);
}

export function canAccessPortalWithoutInvestorOnboarding(
  role: SystemRole | string | null | undefined
): boolean {
  return !requiresInvestorStyleOnboarding(role);
}
