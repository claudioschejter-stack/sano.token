import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './auth.config';
import { canAccessPath, redirectPathForRole } from './lib/auth/routeAccess';
import type { SystemRole } from './lib/auth/roles';
import { resolveLocaleFromRequest } from './i18n/detectLocaleServer';
import { LOCALE_STORAGE_KEY } from './lib/i18n/mobileLocalePreference';

const { auth } = NextAuth(authConfig);

const LOGIN_GATE_PATHS = new Set(['/marketplace', '/mercado-secundario']);

function withLocaleAndCountryHints(
  response: NextResponse,
  request: { cookies: { get: (name: string) => { value: string } | undefined }; headers: Headers }
) {
  const country = request.headers.get('x-vercel-ip-country');

  if (country && country.length === 2) {
    response.cookies.set('sanova.country', country.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax'
    });
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
      sameSite: 'lax'
    });
  }

  return response;
}

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth?.user?.accessToken);
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
      (pathname.includes('/checkout') || pathname === '/marketplace/carrito'));

  if (!isProtected) {
    return withLocaleAndCountryHints(NextResponse.next(), request);
  }

  if (!isAuthenticated) {
    return withLocaleAndCountryHints(
      NextResponse.redirect(new URL('/acceso', request.url)),
      request
    );
  }

  const role = request.auth?.user?.role as SystemRole | undefined;

  if (pathname.startsWith('/dashboard') && !canAccessPath(role, pathname)) {
    return withLocaleAndCountryHints(
      NextResponse.redirect(new URL(redirectPathForRole(role), request.url)),
      request
    );
  }

  return withLocaleAndCountryHints(NextResponse.next(), request);
});

export const config = {
  matcher: [
    '/',
    '/marketplace',
    '/mercado-secundario',
    '/mercado-secundario/checkout',
    '/acceso',
    '/acceso/:path*',
    '/contacto',
    '/privacidad',
    '/terminos',
    '/dashboard/:path*',
    '/marketplace/:path*/checkout',
    '/marketplace/carrito'
  ]
};
