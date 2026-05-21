import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './auth.config';

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith('/dashboard') ||
    (pathname.startsWith('/marketplace') && pathname.includes('/checkout'));

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!request.auth?.user?.accessToken) {
    const loginUrl = new URL('/acceso', request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/marketplace/:path*/checkout']
};
