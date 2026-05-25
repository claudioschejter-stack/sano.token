import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './auth.config';
const { auth } = NextAuth(authConfig);

/** Public landing at `/` for everyone; marketplace requires authentication (via /acceso). */
const LOGIN_GATE_PATHS = new Set(['/marketplace', '/mercado-secundario']);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth?.user?.accessToken);

  if (LOGIN_GATE_PATHS.has(pathname) && !isAuthenticated) {
    const returnTo = encodeURIComponent(pathname);
    return NextResponse.redirect(new URL(`/acceso?returnTo=${returnTo}`, request.url));
  }

  const isProtected =
    pathname.startsWith('/dashboard') ||
    (pathname.startsWith('/marketplace') && pathname.includes('/checkout'));

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/acceso', request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/', '/marketplace', '/mercado-secundario', '/acceso', '/dashboard/:path*', '/marketplace/:path*/checkout']
};
