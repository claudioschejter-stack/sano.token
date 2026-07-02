import {
  canAccessPortalWithoutInvestorOnboarding,
  requiresInvestorStyleOnboarding
} from '../onboarding/onboardingGate';
import type { SystemRole } from './roles';

const ONBOARDING_GATE_PREFIXES = ['/dashboard', '/marketplace', '/mercado-secundario'];

export function requiresOnboardingGatePath(pathname: string): boolean {
  return ONBOARDING_GATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function shouldRedirectToOnboarding(params: {
  pathname: string;
  role?: SystemRole | string | null;
  accountOperational?: boolean;
}): boolean {
  if (!requiresOnboardingGatePath(params.pathname)) {
    return false;
  }

  if (!requiresInvestorStyleOnboarding(params.role)) {
    return false;
  }

  if (canAccessPortalWithoutInvestorOnboarding(params.role)) {
    return false;
  }

  return params.accountOperational !== true;
}
