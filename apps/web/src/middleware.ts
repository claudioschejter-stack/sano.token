import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './auth.config';
import { canAccessPath, redirectPathForRole } from './lib/auth/routeAccess';
import type { SystemRole } from './lib/auth/roles';

const { auth } = NextAuth(authConfig);

const LOGIN_GATE_PATHS = new Set(['/marketplace', '/mercado-secundario']);

function withCountryHint(response: NextResponse, country: string | null) {
  if (country && country.length === 2) {
    response.cookies.set('sanova.country', country.toUpperCase(), {
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
  const country = request.headers.get('x-vercel-ip-country');

  if (LOGIN_GATE_PATHS.has(pathname) && !isAuthenticated) {
    const returnTo = encodeURIComponent(pathname);
    return withCountryHint(
      NextResponse.redirect(new URL(`/acceso?returnTo=${returnTo}`, request.url)),
      country
    );
  }

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/mercado-secundario/checkout') ||
    (pathname.startsWith('/marketplace') &&
      (pathname.includes('/checkout') || pathname === '/marketplace/carrito'));

  if (!isProtected) {
    return withCountryHint(NextResponse.next(), country);
  }

  if (!isAuthenticated) {
    return withCountryHint(NextResponse.redirect(new URL('/acceso', request.url)), country);
  }

  const role = request.auth?.user?.role as SystemRole | undefined;

  if (pathname.startsWith('/dashboard') && !canAccessPath(role, pathname)) {
    return withCountryHint(
      NextResponse.redirect(new URL(redirectPathForRole(role), request.url)),
      country
    );
  }

  return withCountryHint(NextResponse.next(), country);
});

export const config = {
  matcher: [
    '/',
    '/marketplace',
    '/mercado-secundario',
    '/mercado-secundario/checkout',
    '/acceso',
    '/dashboard/:path*',
    '/marketplace/:path*/checkout',
    '/marketplace/carrito'
  ]
};
