import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './auth.config';
import { canAccessPath, redirectPathForRole } from './lib/auth/routeAccess';
import type { SystemRole } from './lib/auth/roles';
import { resolveLocaleFromRequest } from './i18n/detectLocaleServer';
import { LOCALE_STORAGE_KEY } from './lib/i18n/mobileLocalePreference';
import { applySecurityHeaders, getCspHeader } from './lib/security/securityHeaders';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
import {
  isLocalePrefixablePath,
  LOCALE_HEADER,
  parseLocalePath
} from './lib/i18n/localeRouting';

const { auth } = NextAuth(authConfig);

const LOGIN_GATE_PATHS = new Set(['/marketplace', '/mercado-secundario']);

/**
 * ISO 3166-1 alpha-2 country codes blocked from registration per OFAC SDN / FATF high-risk list.
 * Env override: BLOCKED_REGISTRATION_COUNTRIES (comma-separated, e.g. "IR,RU,KP")
 */
const DEFAULT_BLOCKED_COUNTRIES = 'IR,RU,KP,SY,CU,VE,MM,SD,BY,AF,SO,YE,LY,SS';

function buildBlockedCountriesSet(): Set<string> {
  const raw =
    process.env.BLOCKED_REGISTRATION_COUNTRIES?.trim() || DEFAULT_BLOCKED_COUNTRIES;
  return new Set(raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean));
}

const BLOCKED_REGISTRATION_COUNTRIES = buildBlockedCountriesSet();

/** Routes where geographic blocking applies (registration + first login step). */
const GEO_BLOCKED_PATHS = new Set(['/acceso/registro', '/acceso/registro/']);

function withLocaleAndCountryHints(
  response: NextResponse,
  request: { cookies: { get: (name: string) => { value: string } | undefined }; headers: Headers },
  forcedLocale?: string,
  nonce?: string
) {
  const country = request.headers.get('x-vercel-ip-country');

  if (country && country.length === 2) {
    response.cookies.set('sanova.country', country.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      secure: IS_PRODUCTION,
      httpOnly: true
    });
  }

  if (forcedLocale) {
    response.cookies.set(LOCALE_STORAGE_KEY, forcedLocale, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      secure: IS_PRODUCTION,
      httpOnly: true
    });
    return applySecurityHeaders(response, nonce);
  }

  const storedLocale = request.cookies.get(LOCALE_STORAGE_KEY)?.value;
  if (!storedLocale) {
    const detected = resolveLocaleFromRequest({
      stored: null,
      countryHint: country,
      acceptLanguage: request.headers.get('accept-language')
    });
    response.cookies.set(LOCALE_STORAGE_KEY, detected, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      secure: IS_PRODUCTION,
      httpOnly: true
    });
  }

  return applySecurityHeaders(response, nonce);
}

function maybeRewriteLocalePrefix(request: {
  nextUrl: URL;
  headers: Headers;
  cookies: { get: (name: string) => { value: string } | undefined };
}, nonce: string): NextResponse | null {
  const parsed = parseLocalePath(request.nextUrl.pathname);
  if (!parsed.locale) {
    return null;
  }

  if (!isLocalePrefixablePath(parsed.pathname)) {
    const redirectUrl = new URL(parsed.pathname, request.nextUrl);
    return withLocaleAndCountryHints(NextResponse.redirect(redirectUrl), request, parsed.locale, nonce);
  }

  const rewriteUrl = new URL(parsed.pathname, request.nextUrl);
  request.headers.set(LOCALE_HEADER, parsed.locale);
  
  const response = NextResponse.rewrite(rewriteUrl, {
    request: { headers: request.headers }
  });

  return withLocaleAndCountryHints(response, request, parsed.locale, nonce);
}

export default auth((request) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  request.headers.set('x-nonce', nonce);
  request.headers.set('Content-Security-Policy', getCspHeader(nonce));

  const localeRewrite = maybeRewriteLocalePrefix(request, nonce);
  if (localeRewrite) {
    return localeRewrite;
  }

  const { pathname } = request.nextUrl;

  // OFAC / FATF geographic block — applies to registration paths only
  if (GEO_BLOCKED_PATHS.has(pathname)) {
    const country = request.headers.get('x-vercel-ip-country')?.toUpperCase();
    if (country && BLOCKED_REGISTRATION_COUNTRIES.has(country)) {
      return withLocaleAndCountryHints(
        NextResponse.redirect(new URL('/acceso?error=REGION_NOT_AVAILABLE', request.url)),
        request,
        undefined,
        nonce
      );
    }
  }

  const isAuthenticated = Boolean(request.auth?.user?.accessToken);

  if (LOGIN_GATE_PATHS.has(pathname) && !isAuthenticated) {
    const returnTo = encodeURIComponent(pathname);
    return withLocaleAndCountryHints(
      NextResponse.redirect(new URL(`/acceso?returnTo=${returnTo}`, request.url)),
      request,
      undefined,
      nonce
    );
  }

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/mercado-secundario/checkout') ||
    (pathname.startsWith('/marketplace') &&
      (pathname.includes('/checkout') ||
        pathname.includes('/agregar') ||
        pathname.includes('/prestamo') ||
        pathname === '/marketplace/carrito'));

  if (!isProtected) {
    return withLocaleAndCountryHints(
      NextResponse.next({ request: { headers: request.headers } }),
      request,
      undefined,
      nonce
    );
  }

  if (!isAuthenticated) {
    return withLocaleAndCountryHints(
      NextResponse.redirect(new URL('/acceso', request.url)),
      request,
      undefined,
      nonce
    );
  }

  const role = request.auth?.user?.role as SystemRole | undefined;

  if (pathname.startsWith('/dashboard') && !canAccessPath(role, pathname)) {
    return withLocaleAndCountryHints(
      NextResponse.redirect(new URL(redirectPathForRole(role), request.url)),
      request,
      undefined,
      nonce
    );
  }

  return withLocaleAndCountryHints(
    NextResponse.next({ request: { headers: request.headers } }),
    request,
    undefined,
    nonce
  );
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|images/|brand/|logos/|maps/|uploads/|sw.js|manifest.json|api/).*)'
  ]
};
