/** Shared mobile / portable device constants for Sanova web + PWA. */

export const MOBILE_TOUCH_TARGET_PX = 44;

export const PORTAL_MOBILE_HEADER_HEIGHT = '4rem';

export const PORTAL_MOBILE_BOTTOM_NAV_HEIGHT = '4.5rem';

/** Routes where the floating WhatsApp button should not overlap primary CTAs. */
export const WHATSAPP_FAB_HIDDEN_PATH_SNIPPETS = [
  '/checkout',
  '/prestamo',
  '/kyc',
  '/carrito'
] as const;

export function shouldHideWhatsAppFab(pathname: string): boolean {
  return WHATSAPP_FAB_HIDDEN_PATH_SNIPPETS.some((snippet) => pathname.includes(snippet));
}

export function isPortalRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/marketplace') ||
    pathname.startsWith('/mercado-secundario')
  );
}

/** Coarse mobile detection for layout and session locale sync. */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const narrowViewport = window.matchMedia('(max-width: 767px)').matches;

  return coarsePointer || narrowViewport;
}
