import type { SystemRole } from './roles';
import { isMarketplaceTradingRole } from './roles';

/** Mercado Pago-style PWA home for investors on mobile (browser, PWA, or in-app WebView). */
export const MOBILE_INVESTOR_HOME_PATH = '/dashboard';

/**
 * Only the app's true "entry points" (root and login) get redirected to the
 * PWA home. `/marketplace` must NOT be here — it's a real destination
 * ("Propiedades" tab, "Ver marketplace" links, etc.), and redirecting it away
 * would make the properties list unreachable for logged-in mobile investors.
 */
const MOBILE_ENTRY_REDIRECT_PATHS = new Set(['/', '/acceso']);

export function isMobileEntryRedirectPath(pathname: string): boolean {
  return MOBILE_ENTRY_REDIRECT_PATHS.has(pathname);
}

export function resolveMobileInvestorHome(role: SystemRole | undefined): string {
  if (role && isMarketplaceTradingRole(role)) {
    return MOBILE_INVESTOR_HOME_PATH;
  }

  return MOBILE_INVESTOR_HOME_PATH;
}
