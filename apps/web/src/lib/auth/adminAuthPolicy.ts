import type { SystemRole } from './roles';

/** Admin panel access uses email + password only — no TOTP, passkey, or investor onboarding gates. */
export function bypassesTotpGateForRole(role: SystemRole | string | null | undefined): boolean {
  return role === 'ADMIN';
}
