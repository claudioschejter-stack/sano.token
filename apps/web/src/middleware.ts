import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './auth.config';
import { canAccessPath, redirectPathForRole } from './lib/auth/routeAccess';
import type { SystemRole } from './lib/auth/roles';
import { resolveLocaleFromRequest } from './i18n/detectLocaleServer';
import { LOCALE_STORAGE_KEY } from './lib/i18n/mobileLocalePreference';
import { applySecurityHeaders } from './lib/security/securityHeaders';
import { resolveGeoLocale } from './lib/i18n/geoLocale';
import { LOCALE_MANUAL_KEY } from './lib/i18n/mobileLocalePreference';
import {
  isLocalePrefixablePath,
  LOCALE_HEADER,
  parseLocalePath
} from './lib/i18n/localeRouting';
import { requiresOnboardingGatePath, shouldRedirectToOnboarding } from './lib/auth/middlewarePolicy';
import { isCountryBlockedForRegistration } from './lib/security/blockedCountries';

const { auth } = NextAuth(authConfig);

const LOGIN_GATE_PATHS = new Set(['/mercado-secundario']);

// Page-level redirect only. The actual server-side enforcement for the API
// itself (including PWA registration, which never hits this page) lives in
// isCountryBlockedForRegistration(), called from /api/auth/register directly.
const GEO_BLOCKED_PATHS = new Set(['/acceso/registro', '/acceso/registro/']);

function withLocaleAndCountryHints(
  response: NextResponse,
  request: { cookies: { get: (name: string) => { value: string } | undefined }; headers: Headers },
  forcedLocale?: string
) {
  const country = request.headers.get('x-vercel-ip-country');

  if (country && country.length === 2) {
    response.cookies.set('sanova.country', country.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax'
    });
  }

  if (forcedLocale) {
    response.cookies.set(LOCALE_STORAGE_KEY, forcedLocale, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax'
    });
    response.cookies.set(LOCALE_MANUAL_KEY, '1', {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax'
    });
    return applySecurityHeaders(response);
  }

  const storedLocale = request.cookies.get(LOCALE_STORAGE_KEY)?.value;
  const manualLocale = request.cookies.get(LOCALE_MANUAL_KEY)?.value === '1';
  const acceptLanguage = request.headers.get('accept-language');
  const browserLanguages = acceptLanguage
    ? acceptLanguage
        .split(',')
        .map((part) => part.split(';')[0]?.trim())
        .filter((value): value is string => Boolean(value))
    : [];

  const countryCode = country?.toUpperCase() ?? null;
  // A manual choice is never recalculated automatically — once the user (or a past
  // detection) picks a language on purpose, it sticks across the whole platform.
  const shouldRefreshLocale = !manualLocale;

  if (!storedLocale || shouldRefreshLocale) {
    const detected = resolveGeoLocale({
      stored: storedLocale,
      countryHint: countryCode,
      browserLanguages,
      manual: manualLocale
    });
    response.cookies.set(LOCALE_STORAGE_KEY, detected, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax'
    });
    if (!manualLocale) {
      response.cookies.delete(LOCALE_MANUAL_KEY);
    }
  }

  return applySecurityHeaders(response);
}

function maybeRewriteLocalePrefix(request: {
  nextUrl: URL;
  headers: Headers;
  cookies: { get: (name: string) => { value: string } | undefined };
}): NextResponse | null {
  const parsed = parseLocalePath(request.nextUrl.pathname);
  if (!parsed.locale) {
    return null;
  }

  if (!isLocalePrefixablePath(parsed.pathname)) {
    const redirectUrl = new URL(parsed.pathname, request.nextUrl);
    return withLocaleAndCountryHints(NextResponse.redirect(redirectUrl), request, parsed.locale);
  }

  const rewriteUrl = new URL(parsed.pathname, request.nextUrl);
  request.headers.set(LOCALE_HEADER, parsed.locale);

  const response = NextResponse.rewrite(rewriteUrl, {
    request: { headers: request.headers }
  });

  return withLocaleAndCountryHints(response, request, parsed.locale);
}

export default auth((request) => {
  const localeRewrite = maybeRewriteLocalePrefix(request);
  if (localeRewrite) {
    return localeRewrite;
  }

  const { pathname } = request.nextUrl;

  if (
    pathname === '/acceso' &&
    request.nextUrl.searchParams.get('tab') === 'register'
  ) {
    const redirectUrl = new URL('/acceso/registro', request.url);
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== 'tab') {
        redirectUrl.searchParams.set(key, value);
      }
    });
    return withLocaleAndCountryHints(NextResponse.redirect(redirectUrl), request);
  }

  if (GEO_BLOCKED_PATHS.has(pathname)) {
    const country = request.headers.get('x-vercel-ip-country');
    if (isCountryBlockedForRegistration(country)) {
      return withLocaleAndCountryHints(
        NextResponse.redirect(new URL('/acceso?error=REGION_NOT_AVAILABLE', request.url)),
        request
      );
    }
  }

  const sessionUser = request.auth?.user;
  const totpPending = Boolean(sessionUser?.totpPending && sessionUser?.pendingTotpToken);

  if (totpPending && pathname !== '/acceso/verificar-2fa') {
    const callbackUrl = encodeURIComponent(pathname + request.nextUrl.search);
    const totpUrl = new URL('/acceso/verificar-2fa', request.url);
    totpUrl.searchParams.set('t', sessionUser!.pendingTotpToken!);
    totpUrl.searchParams.set('callbackUrl', callbackUrl);
    return withLocaleAndCountryHints(NextResponse.redirect(totpUrl), request);
  }

  const isAuthenticated = Boolean(sessionUser?.accessToken);

  if (LOGIN_GATE_PATHS.has(pathname) && !isAuthenticated) {
    const returnTo = encodeURIComponent(pathname);
    return withLocaleAndCountryHints(
      NextResponse.redirect(new URL(`/acceso?returnTo=${returnTo}`, request.url)),
      request
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

  if (!isProtected && !requiresOnboardingGatePath(pathname)) {
    return withLocaleAndCountryHints(
      NextResponse.next({ request: { headers: request.headers } }),
      request
    );
  }

  if (!isAuthenticated) {
    return withLocaleAndCountryHints(
      NextResponse.redirect(new URL('/acceso', request.url)),
      request
    );
  }

  const role = sessionUser?.role as SystemRole | undefined;

  if (pathname.startsWith('/dashboard') && !canAccessPath(role, pathname)) {
    return withLocaleAndCountryHints(
      NextResponse.redirect(new URL(redirectPathForRole(role), request.url)),
      request
    );
  }

  if (
    shouldRedirectToOnboarding({
      pathname,
      role,
      accountOperational: sessionUser?.accountOperational
    })
  ) {
    const returnTo = encodeURIComponent(pathname + request.nextUrl.search);
    return withLocaleAndCountryHints(
      NextResponse.redirect(new URL(`/kyc?returnTo=${returnTo}`, request.url)),
      request
    );
  }

  return withLocaleAndCountryHints(
    NextResponse.next({ request: { headers: request.headers } }),
    request
  );
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|images/|brand/|logos/|maps/|uploads/|sw.js|manifest.json|api/).*)'
  ]
};
