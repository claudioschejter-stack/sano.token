import {
  canAccessPortalWithoutInvestorOnboarding,
  requiresInvestorStyleOnboarding
} from '../onboarding/onboardingGate';
import type { SystemRole } from './roles';

const ONBOARDING_GATE_PREFIXES = ['/dashboard', '/mercado-secundario'];

/** Checkout / purchase flows — not browse-only marketplace listing. */
export function isMarketplaceTransactionPath(pathname: string): boolean {
  if (!pathname.startsWith('/marketplace')) {
    return false;
  }

  if (pathname === '/marketplace/carrito') {
    return true;
  }

  return (
    pathname.includes('/checkout') ||
    pathname.includes('/agregar') ||
    pathname.includes('/prestamo')
  );
}

/** Browse-only marketplace paths allowed before account is operational. */
export function allowsMarketplaceBrowse(pathname: string): boolean {
  if (pathname === '/marketplace') {
    return true;
  }

  return pathname.startsWith('/marketplace/') && !isMarketplaceTransactionPath(pathname);
}

export function requiresOnboardingGatePath(pathname: string): boolean {
  if (ONBOARDING_GATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )) {
    return true;
  }

  return isMarketplaceTransactionPath(pathname);
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
