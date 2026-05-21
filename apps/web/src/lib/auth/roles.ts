export type SystemRole =
  | 'ADMIN'
  | 'ADVISOR_MANAGER'
  | 'ADVISOR'
  | 'INVESTOR'
  | 'TREASURY'
  | 'OPERATOR';

export const ROLE_HOME_PATH: Record<SystemRole, string> = {
  ADMIN: '/dashboard',
  ADVISOR_MANAGER: '/dashboard',
  ADVISOR: '/dashboard',
  INVESTOR: '/marketplace',
  TREASURY: '/dashboard/cash-flow',
  OPERATOR: '/dashboard'
};

export function resolvePostLoginPath(role: SystemRole, kycApproved = false): string {
  if (role === 'INVESTOR' && !kycApproved) {
    return '/kyc?returnTo=/marketplace';
  }

  return ROLE_HOME_PATH[role] ?? '/marketplace';
}

export function isStaffRole(role: SystemRole): boolean {
  return role === 'ADMIN' || role === 'ADVISOR_MANAGER' || role === 'ADVISOR' || role === 'TREASURY' || role === 'OPERATOR';
}
