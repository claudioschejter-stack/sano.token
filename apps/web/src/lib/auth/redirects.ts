import type { SystemRole } from './roles';
import { buildKycUrl, DEFAULT_POST_ONBOARDING_PATH } from './kycPaths';
import { normalizeReturnPath } from './returnPath';
import { resolvePostLoginPath } from './roles';
import { canAccessPortalWithoutInvestorOnboarding } from '../onboarding/onboardingGate';
import { isMarketplaceTradingRole } from './roles';
import { MOBILE_INVESTOR_HOME_PATH } from './mobileDestinations';

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
  accountOperational = false,
  options?: { registered?: boolean; isMobile?: boolean; registrationChannel?: string | null }
): string {
  if (canAccessPortalWithoutInvestorOnboarding(role)) {
    const home = resolveRoleHomePath(role, true);

    if (!shouldHonorReturnTo(role, returnTo)) {
      return home;
    }

    return safeReturnTo(returnTo, home);
  }

  if (!accountOperational) {
    const channel = options?.registrationChannel;
    const isDesktopRegistration = channel === 'desktop-web';
    const onMobile = options?.isMobile === true;

    if (isDesktopRegistration && !onMobile) {
      return `/kyc/continuar-en-celular?returnTo=${encodeURIComponent(
        safeReturnTo(returnTo, DEFAULT_POST_ONBOARDING_PATH)
      )}${options?.registered ? '&registered=1' : ''}`;
    }

    return buildKycUrl(returnTo, DEFAULT_POST_ONBOARDING_PATH, undefined, {
      registered: options?.registered
    });
  }

  const home =
    options?.isMobile && role && isMarketplaceTradingRole(role)
      ? MOBILE_INVESTOR_HOME_PATH
      : resolveRoleHomePath(role, accountOperational);

  if (!shouldHonorReturnTo(role, returnTo)) {
    return home;
  }

  if (options?.isMobile && role && isMarketplaceTradingRole(role)) {
    return MOBILE_INVESTOR_HOME_PATH;
  }

  return safeReturnTo(returnTo, home);
}
