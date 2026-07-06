import { issueAuthUserById } from './issueAuthUser';

/** Re-issue API JWT 1h before the 12h expiry so long onboarding sessions keep working. */
const ACCESS_TOKEN_REFRESH_AFTER_MS = 11 * 60 * 60 * 1000;

type SessionToken = {
  sub?: string;
  accessToken?: string;
  accessTokenIssuedAt?: number;
  role?: string;
  roles?: string[];
};

export async function maybeRefreshSessionAccessToken<T extends SessionToken>(token: T): Promise<T> {
  if (!token.sub) {
    return token;
  }

  const issuedAt = token.accessTokenIssuedAt ?? 0;
  const stale =
    !token.accessToken || Date.now() - issuedAt >= ACCESS_TOKEN_REFRESH_AFTER_MS;

  if (!stale) {
    return token;
  }

  const authUser = await issueAuthUserById(token.sub);
  if (!authUser) {
    return token;
  }

  return {
    ...token,
    accessToken: authUser.accessToken,
    accessTokenIssuedAt: Date.now(),
    role: authUser.role,
    roles: authUser.roles
  };
}
