import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAMES } from '../../../../lib/auth/sessionAutoLogout';

export const dynamic = 'force-dynamic';

/** Best-effort session clear when the tab closes (sendBeacon / keepalive). */
export async function POST() {
  const jar = await cookies();
  const response = NextResponse.json({ ok: true });

  for (const name of SESSION_COOKIE_NAMES) {
    if (jar.get(name)) {
      response.cookies.set(name, '', {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        sameSite: 'lax'
      });
    }
  }

  return response;
}
