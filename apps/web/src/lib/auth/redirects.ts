import type { SystemRole } from './roles';
import { buildKycUrl, DEFAULT_POST_ONBOARDING_PATH } from './kycPaths';
import { normalizeReturnPath } from './returnPath';
import { resolvePostLoginPath } from './roles';

export function safeReturnTo(value: string | null | undefined, fallback: string): string {
  return normalizeReturnPath(value, fallback);
}

/** Marketing entry points that should resolve to the role home, not a generic returnTo. */
const GENERIC_RETURN_PATHS = new Set(['/', '/marketplace']);

function shouldHonorReturnTo(role: SystemRole | undefined, returnTo: string | null | undefined): boolean {
  if (!returnTo || GENERIC_RETURN_PATHS.has(returnTo)) {
    return false;
  }

  return true;
}

export function resolveRoleHomePath(role: SystemRole | undefined, accountOperational = false): string {
  return resolvePostLoginPath(role ?? 'INVESTOR', accountOperational);
}

export function resolveAuthenticatedDestination(
  role: SystemRole | undefined,
  returnTo: string | null | undefined,
  accountOperational = false
): string {
  if (role === 'INVESTOR' && !accountOperational) {
    return buildKycUrl(returnTo, DEFAULT_POST_ONBOARDING_PATH);
  }

  const home = resolveRoleHomePath(role, accountOperational);

  if (!shouldHonorReturnTo(role, returnTo)) {
    return home;
  }

  return safeReturnTo(returnTo, home);
}
