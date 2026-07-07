import type { SystemRole } from './roles';
import { isMarketplaceTradingRole } from './roles';

/** Mercado Pago-style PWA home for investors on mobile (browser, PWA, or in-app WebView). */
export const MOBILE_INVESTOR_HOME_PATH = '/dashboard';

const MOBILE_ENTRY_REDIRECT_PATHS = new Set(['/', '/marketplace', '/acceso']);

export function isMobileEntryRedirectPath(pathname: string): boolean {
  return MOBILE_ENTRY_REDIRECT_PATHS.has(pathname);
}

export function resolveMobileInvestorHome(role: SystemRole | undefined): string {
  if (role && isMarketplaceTradingRole(role)) {
    return MOBILE_INVESTOR_HOME_PATH;
  }

  return MOBILE_INVESTOR_HOME_PATH;
}
