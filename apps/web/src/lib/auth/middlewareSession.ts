import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { SystemRole } from './roles';

export type MiddlewareSession = {
  accessToken?: string;
  role?: SystemRole;
  accountOperational?: boolean;
  totpPending?: boolean;
  pendingTotpToken?: string;
};

export async function readMiddlewareSession(
  request: NextRequest
): Promise<MiddlewareSession | null> {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: request.nextUrl.protocol === 'https:'
  });

  if (!token) {
    return null;
  }

  return {
    accessToken: token.accessToken as string | undefined,
    role: token.role as SystemRole | undefined,
    accountOperational: token.accountOperational as boolean | undefined,
    totpPending: token.totpPending as boolean | undefined,
    pendingTotpToken: token.pendingTotpToken as string | undefined
  };
}
