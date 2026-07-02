const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    return false;
  }
  return MOBILE_UA.test(userAgent);
}

export function isMobileMarketingEntryPath(pathname: string): boolean {
  if (pathname === '/') {
    return true;
  }

  const mobileOnlyPrefixes = ['/nosotros', '/faq', '/contacto', '/blog'];
  return mobileOnlyPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
