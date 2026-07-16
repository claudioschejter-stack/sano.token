import { isLocaleCode, type Locale } from './localeCodes';
export const LOCALE_PREFIXABLE_PATHS = new Set([
  '/',
  '/acceso',
  '/contacto',
  '/privacidad',
  '/terminos',
  '/blog',
  '/nosotros',
  '/faq',
  '/videos'
]);

export const LOCALE_PREFIXABLE_PREFIXES = [
  '/acceso/',
  '/blog/',
  '/videos/'
] as const;

export { isLocaleCode } from './localeCodes';

export function isLocalePrefixablePath(pathname: string): boolean {
  if (LOCALE_PREFIXABLE_PATHS.has(pathname)) {
    return true;
  }

  return LOCALE_PREFIXABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export type ParsedLocalePath = {
  locale: Locale | null;
  pathname: string;
};

/** `/en/contacto` → locale `en`, path `/contacto`. `/marketplace` → no locale prefix. */
export function parseLocalePath(pathname: string): ParsedLocalePath {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { locale: null, pathname: '/' };
  }

  const head = segments[0];
  if (!isLocaleCode(head)) {
    return { locale: null, pathname: pathname.startsWith('/') ? pathname : `/${pathname}` };
  }

  const rest = segments.slice(1).join('/');
  const stripped = rest ? `/${rest}` : '/';
  return { locale: head, pathname: stripped };
}

export function withLocalePrefix(locale: Locale, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'es') {
    return normalized;
  }
  if (normalized === '/') {
    return `/${locale}`;
  }
  return `/${locale}${normalized}`;
}

export const LOCALE_HEADER = 'x-sanova-locale';
